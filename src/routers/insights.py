
import os
import json
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from schemas import MomentCheckin, DailyMoodCheckin
from auth_middleware import require_auth, require_auth_for_user, require_user_id
from services import db_manager, memory_service, groq_client
from utils import LOCAL_TZ
from facts_parser import get_facts_parser

router = APIRouter(tags=["Insights"])

GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
ENABLE_FACTS_DEBUG_ENDPOINTS = os.environ.get("ENABLE_FACTS_DEBUG_ENDPOINTS", "").lower() == "true"

_MOOD_SCORE_PATTERN = re.compile(r"^[^:\n]{1,40}:\s*(\d{1,2})\s*/\s*10", re.IGNORECASE)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _extract_mood_score(summary_text: Optional[str]) -> Optional[int]:
    if not isinstance(summary_text, str):
        return None

    match = _MOOD_SCORE_PATTERN.search(summary_text.strip())
    if not match:
        return None

    try:
        score = int(match.group(1))
    except ValueError:
        return None

    if 1 <= score <= 10:
        return score
    return None


def _load_mood_checkins(db, user_id: str, days: Optional[int] = None, limit: int = 120) -> List[dict]:
    user = db.get_or_create_user(user_id)
    if not user:
        return []

    query = (
        db.supabase.table("session_summaries")
        .select("id, created_at, summary_text")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
    )

    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.gte("created_at", cutoff.isoformat())

    if limit:
        query = query.limit(limit)

    response = query.execute()
    mood_entries = []

    for item in response.data or []:
        score = _extract_mood_score(item.get("summary_text"))
        if score is None:
            continue

        mood_entries.append(
            {
                "id": item.get("id"),
                "created_at": item.get("created_at"),
                "summary_text": item.get("summary_text"),
                "emotion_score": score,
            }
        )

    return mood_entries

# ==================== Facts-Based Analytics ====================

@router.get("/api/insights/facts/sessions")
async def list_fact_sessions(request: Request):
    """List all available fact sessions"""
    try:
        await require_auth(request)
        if not ENABLE_FACTS_DEBUG_ENDPOINTS:
            raise HTTPException(status_code=404, detail="Not found")
        parser = get_facts_parser()
        sessions = parser.list_sessions()
        return {"success": True, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/insights/facts/{session_id}")
async def get_facts_insights(session_id: str, request: Request):
    """Get parsed facts for a specific session"""
    try:
        await require_auth(request)
        if not ENABLE_FACTS_DEBUG_ENDPOINTS:
            raise HTTPException(status_code=404, detail="Not found")
        parser = get_facts_parser()
        data = parser.parse_session(session_id)
        if "error" in data:
            raise HTTPException(status_code=404, detail=data["error"])
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Original Endpoints ====================


@router.get("/api/insights/timeline/{user_id}")
async def get_conversation_timeline(user_id: str, request: Request, days: int = 30, limit: int = 10):
    """Get conversation timeline with AI-generated titles"""
    try:
        await require_auth_for_user(request, user_id)
        user = db_manager.get_or_create_user(user_id)
        user_db_id = user['id']
        
        # Calculate cutoff
        cutoff_datetime = datetime.now(timezone.utc) - timedelta(days=days)
        
        # 1. Fetch raw summaries
        sessions_response = db_manager.supabase.table('session_summaries')\
            .select('id, summary_text, created_at')\
            .eq('user_id', user_db_id)\
            .gte('created_at', cutoff_datetime.isoformat())\
            .order('created_at', desc=True)\
            .limit(limit)\
            .execute()
            
        if not sessions_response.data:
            return {"success": True, "timeline": []}
            
        # 2. Fetch analysis data
        session_ids = [s['id'] for s in sessions_response.data]
        analysis_response = db_manager.supabase.table('analyzed_sessions')\
            .select('*')\
            .in_('session_id', session_ids)\
            .execute()
            
        analysis_map = {a['session_id']: a for a in analysis_response.data} if analysis_response.data else {}
        
        timeline_items = []
        
        for item in sessions_response.data:
            session_id = item['id']
            raw_summary = item['summary_text']
            created_str = item.get('created_at')
            
            if not created_str:
                continue
                
            dt = datetime.fromisoformat(created_str.replace('Z', '+00:00')).astimezone(LOCAL_TZ)
            date_str = dt.strftime("%Y-%m-%d")
            
            # Check analysis
            analysis = analysis_map.get(session_id)
            
            if analysis:
                title = analysis.get('ai_title') or "Phiên trò chuyện"
                summary = analysis.get('ai_summary') or raw_summary
            else:
                # Fallback & Cleanup
                clean_summary = raw_summary
                for noise in ["Đã tìm thấy các ký ức", "User:", "AI:", "TRÍ NHỚ LIÊN QUAN", "THỜI GIAN:", "Đã tìm thấy"]:
                    clean_summary = clean_summary.replace(noise, "")
                
                # Remove system lines
                clean_lines = [line for line in clean_summary.split('\n') if not line.strip().startswith('[') and len(line.strip()) > 10]
                summary = " ".join(clean_lines[:2]) if clean_lines else "Nội dung phiên trò chuyện..."
                
                title = summary[:50] + "..." if len(summary) > 50 else summary
            
            timeline_items.append({
                "date": date_str,
                "title": title,
                "summary": summary
            })
        
        return {"success": True, "timeline": timeline_items}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Timeline] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/insights/emotions/{user_id}")
async def get_emotion_timeline(user_id: str, request: Request, days: int = 7):
    """Get emotion timeline from analyzed_sessions"""
    try:
        await require_auth_for_user(request, user_id)
        data = db_manager.get_emotion_timeline(user_id, days)
        
        formatted_data = []
        for item in data:
            if item.get('emotion_score'):
                dt = datetime.fromisoformat(item['analyzed_at'].replace('Z', '+00:00')).astimezone(LOCAL_TZ)
                formatted_data.append({
                    "timestamp": dt.isoformat(),
                    "score": item['emotion_score'],
                    "emotion": item.get('dominant_emotion')
                })
        
        return {"success": True, "data": formatted_data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting emotion data: {e}")
        return {"success": False, "error": str(e), "data": []}

@router.get("/api/insights/analysis/{user_id}")
async def get_insights_analysis(user_id: str, request: Request, days: int = 7):
    """Get comprehensive insights analysis"""
    try:
        await require_auth_for_user(request, user_id)
        # Get emotion data for the period
        emotion_data = db_manager.get_emotion_timeline(user_id, days)
        
        # Get memories for AI analysis
        memories = memory_service.get_all_memories(user_id) if memory_service else []
        recent_memories = memories[:20] if memories else []
        
        # Calculate average energy/emotion score
        valid_scores = [item.get('emotion_score', 0) for item in emotion_data if item.get('emotion_score')]
        avg_energy = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 5.0
        
        # Calculate week-over-week change
        prev_week_data = db_manager.get_emotion_timeline(user_id, days * 2)
        prev_scores = [item.get('emotion_score', 0) for item in prev_week_data[len(emotion_data):] if item.get('emotion_score')]
        prev_avg = sum(prev_scores) / len(prev_scores) if prev_scores else avg_energy
        change_percent = round(((avg_energy - prev_avg) / prev_avg) * 100) if prev_avg > 0 else 0
        
        # Calculate emotion spectrum from memories
        emotion_counts = {"calm": 0, "happy": 0, "sad": 0, "anxious": 0, "neutral": 0}
        total_analyzed = 0
        
        for m in recent_memories:
            text = str(m.get('memory', m.get('text', ''))).lower()
            total_analyzed += 1
            
            if any(w in text for w in ["binh yen", "bình yên", "thu gian", "thư giãn", "yen tinh", "yên tĩnh"]):
                emotion_counts["calm"] += 1
            elif any(w in text for w in ["vui", "hạnh phúc", "hanh phuc", "yeu", "yêu", "thich", "thích", "tuyet voi", "tuyệt vời"]):
                emotion_counts["happy"] += 1
            elif any(w in text for w in ["buon", "buồn", "khoc", "khóc", "mat mat", "mất mát", "co don", "cô đơn"]):
                emotion_counts["sad"] += 1
            elif any(w in text for w in ["lo lang", "lo lắng", "stress", "ap luc", "áp lực", "so", "sợ", "lo au", "lo âu"]):
                emotion_counts["anxious"] += 1
            else:
                emotion_counts["neutral"] += 1
        
        # Convert to percentages
        if total_analyzed > 0:
            emotion_spectrum = {
                "calmness": round((emotion_counts["calm"] / total_analyzed) * 100),
                "optimism": round((emotion_counts["happy"] / total_analyzed) * 100),
                "melancholy": round((emotion_counts["sad"] / total_analyzed) * 100),
                "anxiety": round((emotion_counts["anxious"] / total_analyzed) * 100)
            }
        else:
            emotion_spectrum = {"calmness": 25, "optimism": 25, "melancholy": 25, "anxiety": 25}
        
        # Detect patterns
        patterns = []
        if emotion_data:
            weekend_scores = []
            weekday_scores = []
            for item in emotion_data:
                if item.get('emotion_score') and item.get('analyzed_at'):
                    dt = datetime.fromisoformat(item['analyzed_at'].replace('Z', '+00:00'))
                    if dt.weekday() >= 5:  # Saturday, Sunday
                        weekend_scores.append(item['emotion_score'])
                    else:
                        weekday_scores.append(item['emotion_score'])
            
            if weekend_scores and weekday_scores:
                weekend_avg = sum(weekend_scores) / len(weekend_scores)
                weekday_avg = sum(weekday_scores) / len(weekday_scores)
                diff = round(((weekend_avg - weekday_avg) / weekday_avg) * 100) if weekday_avg > 0 else 0
                
                if diff > 5:
                    patterns.append({
                        "title": "Weekend Recovery",
                        "description": f"Cam xuc cua ban thuong tot hon {abs(diff)}% vao cuoi tuan so voi ngay thuong.",
                        "icon": "weekend"
                    })
                elif diff < -5:
                    patterns.append({
                        "title": "Weekday Momentum",
                        "description": f"Ban co ve nang dong hon {abs(diff)}% trong tuan lam viec.",
                        "icon": "work"
                    })
        
        # Generate AI Summary using Groq
        ai_summary = "Đang phân tích dữ liệu cảm xúc của bạn..."
        tags = []
        
        if recent_memories and groq_client:
            try:
                memory_texts = [str(m.get('memory', m.get('text', '')))[:100] for m in recent_memories[:5]]
                summary_prompt = f"""Dựa trên các ký ức gần đây của người dùng, viết một đoạn tóm tắt ngắn gọn (2-3 câu) về trạng thái cảm xúc của họ trong tuần qua. Viết bằng tiếng Việt, giọng văn ấm áp và động viên.

Ký ức gần đây:
{chr(10).join(memory_texts)}

Điểm cảm xúc trung bình: {avg_energy}/10
Thay đổi so với tuần trước: {change_percent:+}%

Chỉ trả về đoạn tóm tắt, không có tiêu đề hay giải thích."""

                response = groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": summary_prompt}],
                    temperature=0.7,
                    max_tokens=200
                )
                ai_summary = response.choices[0].message.content.strip()
                
                if avg_energy >= 7:
                    tags.append({"label": "Nang luong tot", "color": "emerald"})
                if emotion_spectrum.get("calmness", 0) > 30:
                    tags.append({"label": "Binh yen", "color": "purple"})
                if emotion_spectrum.get("optimism", 0) > 30:
                    tags.append({"label": "Lac quan", "color": "orange"})
                    
            except Exception as e:
                print(f"[Insights AI] Error: {e}")
                
        return {
            "success": True,
            "energy": {
                "level": avg_energy,
                "change_percent": change_percent,
                "trend": "up" if change_percent > 0 else "down" if change_percent < 0 else "stable"
            },
            "emotion_spectrum": emotion_spectrum,
            "ai_summary": {
                "text": ai_summary,
                "tags": tags
            },
            "patterns": patterns,
            "data_points": len(emotion_data)
        }
        
    except Exception as e:
        print(f"[Insights Analysis] Error: {e}")
        return {
            "success": False,
            "error": str(e),
            "energy": {"level": 5.0, "change_percent": 0, "trend": "stable"},
            "emotion_spectrum": {"calmness": 25, "optimism": 25, "melancholy": 25, "anxiety": 25},
            "ai_summary": {"text": "Không thể phân tích dữ liệu. Hãy trò chuyện thêm với Miru!", "tags": []},
            "patterns": []
        }

@router.delete("/api/history/session/{session_id}")
async def delete_session(session_id: int, request: Request):
    """Delete a specific session from history"""
    try:
        current_user_id = await require_user_id(request)
        db_manager.supabase.table('session_summaries')\
            .delete()\
            .eq('id', session_id)\
            .eq('user_id', current_user_id)\
            .execute()
        return {"success": True, "message": "Session deleted successfully"}
    except Exception as e:
        print(f"[History Delete] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/insights/seed/{user_id}")
async def seed_sample_insights(user_id: str, request: Request):
    """Seed sample emotion data for testing"""
    try:
        await require_auth_for_user(request, user_id)
        import random
        sample_data = []
        now = datetime.now(timezone.utc)
        
        for i in range(7):
            day_offset = 6 - i
            for j in range(random.randint(1, 3)):
                timestamp = now - timedelta(days=day_offset, hours=random.randint(8, 20))
                emotions = ["happy", "calm", "neutral", "anxious", "sad"]
                score = random.uniform(4.0, 9.0)
                sample_data.append({
                    "user_id": user_id,
                    "emotion_score": round(score, 1),
                    "dominant_emotion": random.choice(emotions),
                    "analyzed_at": timestamp.isoformat(),
                    "summary": "Sample data for testing"
                })
        
        result = db_manager.supabase.table('analyzed_sessions').insert(sample_data).execute()
        return {"success": True, "message": f"Seeded {len(sample_data)} sample entries"}
    except Exception as e:
        print(f"[Seed Data] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/moment")
async def save_moment(moment: MomentCheckin, request: Request):
    """Save a moment check-in"""
    try:
        await require_auth_for_user(request, moment.user_id)
        tags_str = ", ".join([f"#{tag}" for tag in moment.context_tags])
        note_str = f" - {moment.note}" if moment.note else ""
        summary = f"Cảm xúc: {moment.emotion_score}/10. Ngữ cảnh: {tags_str}{note_str}"
        
        result = db_manager.add_session_summary(moment.user_id, summary)
        return {"success": True, "message": "Đã lưu khoảnh khắc của bạn", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Mood Check-in Daily Endpoints ====================

@router.get("/api/moment/checkin-status/{user_id}")
async def get_checkin_status(user_id: str, request: Request):
    """Lấy trạng thái check-in hôm nay của user"""
    try:
        await require_auth_for_user(request, user_id)
        from database import DatabaseManager
        from datetime import datetime, timedelta

        db = DatabaseManager()
        today = datetime.now(LOCAL_TZ).date()
        mood_entries = _load_mood_checkins(db, user_id, days=90)

        today_checkin = None
        for item in mood_entries:
            created_at = _parse_iso_datetime(item.get("created_at"))
            if created_at and created_at.astimezone(LOCAL_TZ).date() == today:
                today_checkin = item
                break

        streak = await calculate_mood_streak(user_id, db)
        last_checkin = mood_entries[0] if mood_entries else None

        return {
            "success": True,
            "has_checked_in_today": today_checkin is not None,
            "streak": streak,
            "last_score": last_checkin.get("emotion_score") if last_checkin else None,
            "last_checkin_time": last_checkin.get("created_at") if last_checkin else None
        }

        mood_dates = set()
        for item in _load_mood_checkins(db, user_id, days=45):
            created_at = _parse_iso_datetime(item.get("created_at"))
            if created_at:
                mood_dates.add(created_at.astimezone(LOCAL_TZ).date())

        if not mood_dates:
            return 0

        streak = 0
        today = datetime.now(LOCAL_TZ).date()

        if today in mood_dates:
            streak += 1
            check_date = today - timedelta(days=1)
        else:
            check_date = today

        while check_date in mood_dates:
            streak += 1
            check_date -= timedelta(days=1)

        return streak
        
        db = DatabaseManager()
        today = datetime.now(LOCAL_TZ).date()
        mood_entries = _load_mood_checkins(db, user_id, days=90)

        today_checkin = None
        for item in mood_entries:
            created_at = _parse_iso_datetime(item.get("created_at"))
            if created_at and created_at.astimezone(LOCAL_TZ).date() == today:
                today_checkin = item
                break

        streak = await calculate_mood_streak(user_id, db)
        last_checkin = mood_entries[0] if mood_entries else None

        return {
            "success": True,
            "has_checked_in_today": today_checkin is not None,
            "streak": streak,
            "last_score": last_checkin.get("emotion_score") if last_checkin else None,
            "last_checkin_time": last_checkin.get("created_at") if last_checkin else None
        }

        today = datetime.now().date()
        
        # Get today's check-in
        today_checkin = None
        try:
            response = db.supabase.table('analyzed_sessions') \
                .select('id, analyzed_at, summary_text') \
                .eq('user_id', db.get_or_create_user(user_id)['id']) \
                .execute()
            
            if response.data:
                for item in response.data:
                    if item.get('summary_text') and 'Cảm xúc:' in item['summary_text']:
                        analyzed_at = datetime.fromisoformat(item['analyzed_at'].replace('Z', '+00:00'))
                        if analyzed_at.date() == today:
                            today_checkin = item
                            break
        except Exception as e:
            print(f"[Checkin Status] Error getting data: {e}")
        
        # Calculate streak
        streak = await calculate_mood_streak(user_id, db)
        
        # Get last check-in
        last_checkin = None
        if response.data:
            for item in response.data:
                if item.get('summary_text') and 'Cảm xúc:' in item['summary_text']:
                    last_checkin = item
                    break
        
        last_score = None
        if last_checkin and last_checkin.get('summary_text'):
            try:
                # Extract score from summary
                import re
                match = re.search(r'Cảm xúc: (\d+)/10', last_checkin['summary_text'])
                if match:
                    last_score = int(match.group(1))
            except:
                pass
        
        return {
            "success": True,
            "has_checked_in_today": today_checkin is not None,
            "streak": streak,
            "last_score": last_score,
            "last_checkin_time": last_checkin['analyzed_at'] if last_checkin else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Checkin Status] Error: {e}")
        return {"success": False, "error": str(e)}


async def calculate_mood_streak(user_id: str, db) -> int:
    """Tính số ngày liên tiếp user đã check-in"""
    try:
        from datetime import datetime, timedelta
        
        user = db.get_or_create_user(user_id)
        if not user:
            return 0
        
        # Get last 30 days of check-ins
        response = db.supabase.table('analyzed_sessions') \
            .select('analyzed_at, summary_text') \
            .eq('user_id', user['id']) \
            .order('analyzed_at', desc=False) \
            .execute()
        
        if not response.data:
            return 0
        
        # Filter mood check-ins and extract dates
        mood_dates = set()
        for item in response.data:
            if item.get('summary_text') and 'Cảm xúc:' in item['summary_text']:
                try:
                    analyzed_at = datetime.fromisoformat(item['analyzed_at'].replace('Z', '+00:00'))
                    mood_dates.add(analyzed_at.date())
                except:
                    continue
        
        if not mood_dates:
            return 0
        
        # Calculate streak
        streak = 0
        today = datetime.now().date()
        
        # Check if today is included
        if today in mood_dates:
            streak += 1
            check_date = today - timedelta(days=1)
        else:
            check_date = today
        
        # Count consecutive days
        while check_date in mood_dates:
            streak += 1
            check_date -= timedelta(days=1)
        
        return streak
        
    except Exception as e:
        print(f"[Calculate Streak] Error: {e}")
        return 0


async def calculate_mood_streak(user_id: str, db) -> int:
    """Calculate consecutive mood-checkin days from session_summaries."""
    try:
        mood_dates = set()
        for item in _load_mood_checkins(db, user_id, days=45):
            created_at = _parse_iso_datetime(item.get("created_at"))
            if created_at:
                mood_dates.add(created_at.astimezone(LOCAL_TZ).date())

        if not mood_dates:
            return 0

        streak = 0
        today = datetime.now(LOCAL_TZ).date()

        if today in mood_dates:
            streak += 1
            check_date = today - timedelta(days=1)
        else:
            check_date = today

        while check_date in mood_dates:
            streak += 1
            check_date -= timedelta(days=1)

        return streak
    except Exception as e:
        print(f"[Calculate Streak] Error: {e}")
        return 0


@router.post("/api/moment/daily-checkin")
async def save_daily_mood_checkin(checkin: DailyMoodCheckin, request: Request):
    """
    Lưu mood check-in hàng ngày với streak tracking.
    """
    try:
        from database import DatabaseManager
        from services import get_reminder_config
        import google.generativeai as genai
        import re
        
        db = DatabaseManager()
        
        # Lưu vào analyzed_sessions
        tags_str = ", ".join([f"#{tag}" for tag in checkin.context_tags])
        note_str = f" - {checkin.note}" if checkin.note else ""
        summary = f"Mood Check-in: {checkin.emotion_score}/10. Ngữ cảnh: {tags_str}{note_str}"
        
        result = db_manager.add_session_summary(checkin.user_id, summary)
        
        # Tính streak
        streak = await calculate_mood_streak(checkin.user_id, db)
        
        # Generate insight based on score
        insight = ""
        if checkin.emotion_score <= 3:
            insight = "Cảm ơn bạn đã chia sẻ. Mình luôn ở đây nếu bạn cần nói chuyện. 💙"
        elif checkin.emotion_score <= 5:
            insight = "Hy vọng ngày mai sẽ tốt hơn. Đừng quên chăm sóc bản thân nhé! 🌱"
        elif checkin.emotion_score <= 7:
            insight = "Có vẻ hôm nay của bạn ổn đấy! Tiếp tục cố gắng nhé! 😊"
        else:
            insight = "Tuyệt vời! Rất vui khi thấy bạn vui vẻ! ✨"
        
        # Check for streak milestone
        if streak == 3:
            message = f"🎉 Streak 3 ngày! Bạn đang làm rất tốt!"
        elif streak == 7:
            message = f"🔥 Streak 1 tuần! Tuyệt vời quá!"
        elif streak == 14:
            message = f"🌟 Streak 2 tuần! Bạn thật phi thường!"
        elif streak == 30:
            message = f"💎 Streak 1 tháng! Mình rất tự hào về bạn!"
        else:
            message = f"🔥 Streak {streak} ngày!"
        
        return {
            "success": True,
            "streak": streak,
            "insight": insight,
            "message": message
        }
        
    except Exception as e:
        print(f"[Daily Checkin] Error: {e}")
        return {"success": False, "error": str(e)}


async def generate_proactive_checkin_message(user_id: str) -> str:
    """Tạo message chủ động hỏi han user"""
    try:
        from services import get_reminder_config
        import google.generativeai as genai
        from database import DatabaseManager
        from datetime import datetime
        
        db = DatabaseManager()
        mood_entries = _load_mood_checkins(db, user_id, days=30, limit=30)
        last_checkin = mood_entries[0] if mood_entries else None
        last_score = last_checkin.get("emotion_score") if last_checkin else None

        streak = await calculate_mood_streak(user_id, db)
        hour = datetime.now().hour

        if hour < 12:
            time_greeting = "ChÃ o buá»•i sÃ¡ng"
        elif hour < 14:
            time_greeting = "ChÃ o trÆ°a"
        elif hour < 18:
            time_greeting = "ChÃ o buá»•i chiá»u"
        else:
            time_greeting = "ChÃ o buá»•i tá»‘i"

        if last_score is None:
            follow_up = "HÃ´m nay báº¡n tháº¿ nÃ o?"
        elif last_score <= 3:
            follow_up = "Mong lÃ  hÃ´m nay báº¡n cáº£m tháº¥y tá»‘t hÆ¡n ðŸ’™"
        elif last_score <= 5:
            follow_up = "Hy vá»ng má»i thá»© Ä‘ang dáº§n tá»‘t hÆ¡n ðŸŒ±"
        elif last_score <= 7:
            follow_up = "Ráº¥t vui khi báº¡n Ä‘ang cÃ³ ngÃ y tá»‘t!"
        else:
            follow_up = "Tuyá»‡t vá»i! Tiáº¿p tá»¥c giá»¯ nÄƒng lÆ°á»£ng nhÃ©! âœ¨"

        if streak >= 7:
            streak_msg = f" {streak} ngÃ y liÃªn tiáº¿p rá»“i! Tuyá»‡t vá»i! ðŸ”¥"
        elif streak >= 3:
            streak_msg = f" {streak} ngÃ y rá»“i! Tiáº¿p tá»¥c nhÃ©! ðŸ’ª"
        else:
            streak_msg = ""

        return f"{time_greeting}! {follow_up}{streak_msg}"

        mood_dates = set()
        for item in _load_mood_checkins(db, user_id, days=45):
            created_at = _parse_iso_datetime(item.get("created_at"))
            if created_at:
                mood_dates.add(created_at.astimezone(LOCAL_TZ).date())

        if not mood_dates:
            return 0

        streak = 0
        today = datetime.now(LOCAL_TZ).date()

        if today in mood_dates:
            streak += 1
            check_date = today - timedelta(days=1)
        else:
            check_date = today

        while check_date in mood_dates:
            streak += 1
            check_date -= timedelta(days=1)

        return streak

        user = db.get_or_create_user(user_id)
        if not user:
            return "Chào buổi sáng! Hôm nay bạn thế nào? ☀️"
        
        # Get last check-in
        response = db.supabase.table('analyzed_sessions') \
            .select('analyzed_at, summary_text') \
            .eq('user_id', user['id']) \
            .order('analyzed_at', desc=False) \
            .limit(10) \
            .execute()
        
        last_score = None
        last_checkin_date = None
        
        if response.data:
            for item in response.data:
                if item.get('summary_text') and 'Cảm xúc:' in item['summary_text']:
                    import re
                    match = re.search(r'Cảm xúc: (\d+)/10', item['summary_text'])
                    if match:
                        last_score = int(match.group(1))
                        last_checkin_date = datetime.fromisoformat(item['analyzed_at'].replace('Z', '+00:00'))
                    break
        
        # Get streak
        streak = await calculate_mood_streak(user_id, db)
        
        # Generate message based on time and context
        hour = datetime.now().hour
        
        # Time-based greeting
        if hour < 12:
            time_greeting = "Chào buổi sáng"
        elif hour < 14:
            time_greeting = "Chào trưa"
        elif hour < 18:
            time_greeting = "Chào buổi chiều"
        else:
            time_greeting = "Chào buổi tối"
        
        # Score-based follow-up
        if last_score is None:
            follow_up = "Hôm nay bạn thế nào?"
        elif last_score <= 3:
            follow_up = "Mong là hôm nay bạn cảm thấy tốt hơn 💙"
        elif last_score <= 5:
            follow_up = "Hy vọng mọi thứ đang dần tốt hơn 🌱"
        elif last_score <= 7:
            follow_up = "Rất vui khi bạn đang có ngày tốt!"
        else:
            follow_up = "Tuyệt vời! Tiếp tục giữ năng lượng nhé! ✨"
        
        # Streak celebration
        if streak >= 7:
            streak_msg = f" {streak} ngày liên tiếp rồi! Tuyệt vời! 🔥"
        elif streak >= 3:
            streak_msg = f" {streak} ngày rồi! Tiếp tục nhé! 💪"
        else:
            streak_msg = ""
        
        return f"{time_greeting}! {follow_up}{streak_msg}"
        
    except Exception as e:
        print(f"[Proactive Message] Error: {e}")
        return "Hôm nay bạn thế nào? 💭"


@router.get("/api/moment/proactive-message/{user_id}")
async def get_proactive_message(user_id: str, request: Request):
    """Lấy message chủ động hỏi han user"""
    try:
        await require_auth_for_user(request, user_id)
        message = await generate_proactive_checkin_message(user_id)
        return {"success": True, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Proactive API] Error: {e}")
        return {"success": False, "error": str(e)}

@router.get("/api/moments/{user_id}")
async def get_moments(user_id: str, request: Request, days: int = 7):
    """Get moment check-ins history"""
    try:
        await require_auth_for_user(request, user_id)
        from database import DatabaseManager

        db = DatabaseManager()
        mood_entries = _load_mood_checkins(db, user_id, days=max(days, 30), limit=120)
        mood_entries.sort(key=lambda item: item.get("created_at") or "")

        moments = [
            {
                "id": item.get("id"),
                "created_at": item.get("created_at"),
                "summary_text": item.get("summary_text"),
                "emotion_score": item.get("emotion_score"),
            }
            for item in mood_entries
        ]

        return {"success": True, "moments": moments, "count": len(moments)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Moments] Error: {e}")
        return {"success": False, "moments": [], "count": 0, "error": str(e)}

@router.get("/api/memories/{user_id}")
async def get_memories(user_id: str, request: Request, query: str = ""):
    """Get relevant memories for user"""
    try:
        await require_auth_for_user(request, user_id)
        if query:
            memories = db_manager.find_relevant_summaries(user_id, query)
        else:
            memories = db_manager.get_latest_session_summary(user_id)
        return {"success": True, "memories": memories}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/memory/save")
async def save_memory(user_id: str, summary: str, request: Request):
    """Save a session summary"""
    try:
        await require_auth_for_user(request, user_id)
        result = db_manager.add_session_summary(user_id, summary)
        return {"success": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# file: pwa_server.py
"""
FastAPI Server for Reflection PWA
Provides REST API and WebSocket endpoints for the Progressive Web App
"""

import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from groq import Groq
# Import analyzer integration
from analyzer_integration import analyze_conversation_background
# Import authentication routes
from auth_routes import router as auth_router
from therapist_routes import router as therapist_router
from memory_routes import router as memory_router
from proactive_routes import router as proactive_router
# Import existing infrastructure
from database import DatabaseManager
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.types import TextContent

# Import Mem0 Memory Service
from memory_service import get_memory_service
from crisis_detector import get_crisis_detector, CrisisLevel
from agent_graph import run_agent

load_dotenv()

# Configure Gemini (for embeddings/analysis)
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# Configure Groq (for chat)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip().strip('"').strip("'")
# Handle case where user pastes "GROQ_API_KEY=gsk_..."
if GROQ_API_KEY.startswith("GROQ_API_KEY="):
    GROQ_API_KEY = GROQ_API_KEY.split("=", 1)[1].strip().strip('"').strip("'")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")
groq_client = Groq(api_key=GROQ_API_KEY)
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# MCP Server connection
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://127.0.0.1:8020/sse")

# Database
db_manager = DatabaseManager()

# Timezone
LOCAL_TZ = timezone(timedelta(hours=7))  # Vietnam GMT+7

# Memory Service (Mem0)
try:
    memory_service = get_memory_service()
except Exception as e:
    print(f"[WARN] Memory service initialization failed: {e}")
    print("[WARN] Server will run without memory features")
    memory_service = None

crisis_detector = get_crisis_detector()

# Import Journal Manager
from journal_db import JournalManager
journal_manager = JournalManager()

# Import Auth Manager
from auth_manager import AuthManager
auth_manager = AuthManager()

# Import Chat Manager
from chat_manager import ChatManager
chat_manager = ChatManager()

# ==================== Models ====================

class ChatMessage(BaseModel):
    message: str
    user_id: str

class MomentCheckin(BaseModel):
    user_id: str
    emotion_score: int  # 1-10
    context_tags: List[str]
    note: Optional[str] = None

class TherapistPairing(BaseModel):
    user_id: str
    pairing_code: str

class JournalEntry(BaseModel):
    user_id: str
    content: str
    title: Optional[str] = None
    mood: Optional[str] = None
    tags: Optional[List[str]] = []

# ==================== MCP Integration (REST API) ====================

import httpx

async def call_mcp_tool(tool_name: str, user_id: str = None, tool_args: Dict[str, Any] = None):
    """Call MCP tool via REST API instead of SSE"""
    try:
        # Map tool names to API endpoints
        endpoint_map = {
            "add_session_summary": "/api/add_session_summary",
            "find_relevant_memories": "/api/find_relevant_memories",
            "get_latest_session_summary": "/api/get_latest_session_summary",
            "update_personal_detail": "/api/update_personal_detail",
            "analyze_topic_frequency": "/api/analyze_topic_frequency",
            "get_memories_by_date": "/api/get_memories_by_date",
            "get_session_timeline": "/api/get_session_timeline",
            "log_activity": "/api/log_activity",
            "get_sleep_info": "/api/get_sleep_info",
        }
        
        endpoint = endpoint_map.get(tool_name)
        if not endpoint:
            return f"Unknown tool: {tool_name}"
        
        # Prepare request body
        body = {"user_id": user_id, **(tool_args or {})}
        
        # Call REST API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"http://127.0.0.1:8020{endpoint}",
                json=body,
                timeout=10.0
            )
            response.raise_for_status()
            result = response.json()
            return result.get("result", "No result")
            
    except httpx.TimeoutException:
        print(f"[MCP Error] {tool_name}: Timeout")
        return "[Error: Timeout]"
    except Exception as e:
        print(f"[MCP Error] {tool_name}: {e}")
        return f"[Error: {str(e)}]"

# ==================== App Initialization ====================

app = FastAPI(
    title="Reflection PWA Server",
    description="Backend API for Reflection Mental Health PWA",
    version="1.0.0"
)

# CORS - Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register authentication routes
app.include_router(auth_router)
app.include_router(therapist_router)
app.include_router(memory_router)
app.include_router(proactive_router)

# Serve static files (images)
app.mount("/picture_avatar", StaticFiles(directory="picture_avatar"), name="picture_avatar")

# Mount React build static assets
if os.path.exists("pwa-react"):
    app.mount("/assets", StaticFiles(directory="pwa-react/assets"), name="react_assets")

# ==================== API Endpoints ====================

@app.get("/api/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(LOCAL_TZ).isoformat(),
        "database": "connected",
        "mcp_server": MCP_SERVER_URL
    }

@app.get("/api/user-id")
async def get_user_id():
    """Get user ID from environment"""
    user_id = os.getenv("USER_ID", "user_alex")
    return {"user_id": user_id}


# ==================== Chat API ====================

# ==================== AI Analyzer Integration ====================

async def analyze_conversation_async(user_id: str, user_message: str, ai_message: str):
    """
    Analyze conversation in background (non-blocking).
    Triggered after each chat exchange.
    """
    try:
        # Build conversation text
        conversation_text = f"User: {user_message}\nAI: {ai_message}"
        
        # Get latest session ID (the one we just saved)
        # We'll use a simple approach: get the most recent session for this user
        user = db_manager.get_or_create_user(user_id)
        user_db_id = user['id']
        
        response = db_manager.supabase.table('session_summaries')\
            .select('id')\
            .eq('user_id', user_db_id)\
            .order('created_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not response.data:
            print("[WARN] No session found to analyze")
            return
        
        session_id = response.data[0]['id']
        
        # Analyze with AI
        print(f"[ANALYZE] Analyzing session {session_id} in background...")
        analysis = await analyze_session(conversation_text)
        
        if analysis:
            # Save analyzed data
            db_manager.save_analyzed_session(session_id, user_id, analysis)
            print(f"[OK] Analysis saved: {analysis.get('title', 'N/A')}")
        else:
            print("[WARN] Analysis failed")
            
    except Exception as e:
        print(f"[ERROR] Background analysis error: {e}")
        # Don't crash - this is background task

# ==================== WebSocket Chat ====================

@app.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    """Real-time chat WebSocket endpoint - Simplified like demo app.py"""
    await websocket.accept()
    
    # Initialize conversation history
    conversation_history = []
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_message = message_data.get("message", "")
            session_id = message_data.get("session_id")
            
            if not user_message:
                continue
            
            # Save user message to database
            if session_id:
                chat_manager.save_message(session_id, user_id, "user", user_message)
            
            # === USE LANGGRAPH AGENT ===
            try:
                agent_result = await run_agent(
                    user_id=user_id,
                    user_message=user_message,
                    conversation_history=conversation_history
                )
                
                ai_message = agent_result["response"]
                
                # Log actions taken
                if agent_result["actions_taken"]:
                    print(f"🤖 Agent actions: {agent_result['actions_taken']}")
                
                # Update conversation history
                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": ai_message})
                
                if len(conversation_history) > 20:
                    conversation_history = conversation_history[-20:]
                
                # Send response to client
                await websocket.send_json({
                    "type": "ai_response",
                    "message": ai_message,
                    "crisis_level": agent_result["crisis_level"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Save messages to database
                if session_id:
                    chat_manager.save_message(session_id, user_id, "ai", ai_message)
                
                # Save to Mem0
                try:
                    memory_service.add_conversation(user_id, user_message, ai_message)
                except Exception as e:
                    print(f"[Mem0] Save error: {e}")
                
            except Exception as e:
                print(f"[Agent Error] {e}")
                import traceback
                traceback.print_exc()
                await websocket.send_json({
                    "type": "error",
                    "message": f"Lỗi: {str(e)}"
                })
            
            continue  # Go to next message
            
            # === OLD CODE BELOW (DISABLED) ===
            # 1. Retrieve Memories (like demo)
            memories_text = ""
            try:
                relevant_memories = memory_service.search_memories(user_id, user_message, limit=3)
                if relevant_memories:
                    memories_text = "\n".join([f"- {m.get('memory', '')}" for m in relevant_memories if m.get('memory')])
            except Exception as e:
                print(f"[Mem0] Search error: {e}")
            
            # 2. Build system prompt with crisis awareness
            system_prompt = f"""Bạn là một người bạn thân thiện và quan tâm.

Những gì bạn nhớ về người này:
{memories_text if memories_text else "Chưa có thông tin gì."}

{crisis_context}
"""
            
            # 3. Build messages for Groq
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add recent conversation history (last 5 exchanges)
            for msg in conversation_history[-10:]:
                messages.append(msg)
            
            messages.append({"role": "user", "content": user_message})
            
            # 4. Generate response using Groq
            try:
                loop = asyncio.get_event_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: groq_client.chat.completions.create(
                            model=GROQ_MODEL,
                            messages=messages,
                            temperature=0.7,
                            max_tokens=5000
                        )
                    ),
                    timeout=30.0
                )
                
                ai_message = response.choices[0].message.content
                
                # Update conversation history
                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": ai_message})
                
                # Keep history manageable
                if len(conversation_history) > 20:
                    conversation_history = conversation_history[-20:]
                
                # Send back to client
                await websocket.send_json({
                    "type": "ai_response",
                    "message": ai_message,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Save AI message to database
                if session_id:
                    chat_manager.save_message(session_id, user_id, "ai", ai_message)
                
                # 5. Save to Mem0 memory (simple, like demo)
                try:
                    memory_service.add_conversation(user_id, user_message, ai_message)
                except Exception as e:
                    print(f"[Mem0] Save error: {e}")
                
                # Trigger AI analysis in background
                asyncio.create_task(analyze_conversation_background(user_id, user_message, ai_message))
                
            except asyncio.TimeoutError:
                await websocket.send_json({
                    "type": "error", 
                    "message": "AI đang phản hồi chậm. Vui lòng thử lại."
                })
            except Exception as e:
                print(f"[Chat Error] {e}")
                await websocket.send_json({
                    "type": "error", 
                    "message": f"Lỗi: {str(e)}"
                })

    except WebSocketDisconnect:
        print(f"Client #{user_id} disconnected")
    except Exception as e:
        print(f"[WebSocket Error] {e}")



# Memory Management route
@app.get("/app/memories")
async def memories_page():
    """Serve memories management page"""
    return FileResponse("pwa/memories.html")

# Therapist Dashboard route
@app.get("/therapist")
async def therapist_dashboard():
    """Serve therapist dashboard page"""
    return FileResponse("pwa/therapist-dashboard.html")

# ==================== Memory API ====================

@app.get("/api/memories/{user_id}")
async def get_memories(user_id: str, query: str = ""):
    """Get relevant memories for user"""
    try:
        if query:
            memories = await call_mcp_tool("find_relevant_memories", user_id, {"query": query})
        else:
            # Get recent session summary
            memories = await call_mcp_tool("get_latest_session_summary", user_id)
        
        return {"success": True, "memories": memories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/memory/save")
async def save_memory(user_id: str, summary: str):
    """Save a session summary"""
    try:
        result = await call_mcp_tool("add_session_summary", user_id, {"summary": summary})
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Moment Check-in API ====================

@app.post("/api/moment")
async def save_moment(moment: MomentCheckin):
    """Save a moment check-in"""
    try:
        # Format moment as a summary
        tags_str = ", ".join([f"#{tag}" for tag in moment.context_tags])
        note_str = f" - {moment.note}" if moment.note else ""
        
        summary = f"Cảm xúc: {moment.emotion_score}/10. Ngữ cảnh: {tags_str}{note_str}"
        
        # Save to database via MCP
        result = await call_mcp_tool("add_session_summary", moment.user_id, {"summary": summary})
        
        return {
            "success": True,
            "message": "Đã lưu khoảnh khắc của bạn",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/moments/{user_id}")
async def get_moments(user_id: str, days: int = 7):
    """Get moment check-ins history"""
    try:
        # Get timeline for the specified days
        timeline = await call_mcp_tool("get_session_timeline", user_id, {"days": days})
        timeline_data = json.loads(timeline) if timeline else []
        
        return {
            "success": True,
            "moments": timeline_data,
            "count": len(timeline_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/insights/timeline/{user_id}")
async def get_conversation_timeline(user_id: str, days: int = 30, limit: int = 10):
    """Get conversation timeline with AI-generated titles"""
    try:
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
    except Exception as e:
        print(f"[Timeline] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/insights/emotions/{user_id}")
async def get_emotion_timeline(user_id: str, days: int = 7):
    """Get emotion timeline from analyzed_sessions"""
    try:
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
    except Exception as e:
        print(f"Error getting emotion data: {e}")
        return {"success": False, "error": str(e), "data": []}

@app.get("/api/insights/analysis/{user_id}")
async def get_insights_analysis(user_id: str, days: int = 7):
    """Get comprehensive insights analysis including energy level, emotion spectrum, AI summary, and patterns"""
    try:
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
            # Weekend vs weekday pattern
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
        
        # Generate AI Summary using Groq if available
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
                
                # Generate tags
                if avg_energy >= 7:
                    tags.append({"label": "Nang luong tot", "color": "emerald"})
                if emotion_spectrum.get("calmness", 0) > 30:
                    tags.append({"label": "Binh yen", "color": "purple"})
                if emotion_spectrum.get("optimism", 0) > 30:
                    tags.append({"label": "Lac quan", "color": "orange"})
                    
            except Exception as e:
                print(f"[Insights AI] Error: {e}")
                ai_summary = f"Điểm cảm xúc trung bình của bạn là {avg_energy}/10. "
                if change_percent > 0:
                    ai_summary += f"Tăng {change_percent}% so với tuần trước. Tiếp tục phát huy nhé!"
                elif change_percent < 0:
                    ai_summary += f"Giảm {abs(change_percent)}% so với tuần trước. Hãy dành thời gian chăm sóc bản thân."
                else:
                    ai_summary += "Mức độ ổn định so với tuần trước."
        
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
        
        
@app.delete("/api/history/session/{session_id}")
async def delete_session(session_id: int):
    """Delete a specific session from history"""
    try:
        response = db_manager.supabase.table('session_summaries')\
            .delete()\
            .eq('id', session_id)\
            .execute()
        
        return {"success": True, "message": "Session deleted successfully"}
    except Exception as e:
        print(f"[History Delete] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/insights/seed/{user_id}")
async def seed_sample_insights(user_id: str):
    """Seed sample emotion data for testing - call this if no chart data exists"""
    try:
        import random
        
        sample_data = []
        now = datetime.now(timezone.utc)
        
        # Generate 7 days of sample data
        for i in range(7):
            day_offset = 6 - i  # Start from 6 days ago
            for j in range(random.randint(1, 3)):  # 1-3 entries per day
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
        
        # Insert into database
        result = db_manager.supabase.table('analyzed_sessions').insert(sample_data).execute()
        
        return {"success": True, "message": f"Seeded {len(sample_data)} sample entries", "count": len(sample_data)}
    except Exception as e:
        print(f"[Seed Data] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Chat Sessions API ====================

@app.get("/api/chat/sessions/{user_id}")
async def get_chat_sessions(user_id: str, limit: int = 20):
    """Get list of chat sessions for user"""
    try:
        result = chat_manager.get_user_sessions(user_id, limit)
        sessions_list = result.get("sessions", [])
        
        # Format sessions for frontend
        formatted = []
        for s in sessions_list:
            created = s.get("created_at", "")
            date_str = ""
            time_str = ""
            if created:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    date_str = dt.strftime("%d/%m/%Y")
                    time_str = dt.strftime("%H:%M")
                except: pass
                
            formatted.append({
                "id": s.get("id"),
                "title": s.get("title", "Cuộc trò chuyện"),
                "date": date_str,
                "time": time_str
            })
        
        return {"success": True, "sessions": formatted, "count": len(formatted)}
    except Exception as e:
        print(f"[Chat Sessions] Error: {e}")
        return {"success": False, "sessions": [], "error": str(e)}


@app.post("/api/chat/sessions/{user_id}")
async def create_chat_session(user_id: str, title: str = "Cuộc trò chuyện mới"):
    """Create a new chat session"""
    try:
        result = chat_manager.create_new_session(user_id, title)
        if result.get("success"):
            # Normalize response for frontend
            return {
                "success": True, 
                "session": {
                    "id": result.get("session_id"),
                    "title": result.get("title")
                }
            }
        return {"success": False, "error": result.get("error")}
    except Exception as e:
        print(f"[Create Session] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: int, user_id: str):
    """Delete a chat session"""
    try:
        result = chat_manager.delete_session(session_id, user_id)
        return {"success": result.get("success", False), "message": result.get("message", "")}
    except Exception as e:
        print(f"[Delete Session] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/chat/sessions/{session_id}/title")
async def update_session_title(session_id: int, title: str):
    """Update session title"""
    try:
        result = chat_manager.update_session_title(session_id, title)
        return {"success": result.get("success", False)}
    except Exception as e:
        print(f"[Update Title] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel

class GenerateTitleRequest(BaseModel):
    messages: list

@app.post("/api/chat/sessions/{session_id}/generate-title")
async def generate_title_endpoint(session_id: int, request: GenerateTitleRequest):
    """Generate and save AI title for session"""
    try:
        title = await generate_session_title(request.messages)
        chat_manager.update_session_title(session_id, title)
        return {"success": True, "title": title}
    except Exception as e:
        print(f"[Generate Title API] Error: {e}")
        return {"success": False, "title": "Cuộc trò chuyện"}


async def generate_session_title(messages: list) -> str:
    """Generate AI title for session based on conversation"""
    try:
        if len(messages) < 2:
            return "Cuộc trò chuyện mới"
        
        # Get first few exchanges
        conversation_text = "\n".join([
            f"{'User' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')[:100]}"
            for m in messages[:4]
        ])
        
        # Use Groq to generate title
        from langchain_groq import ChatGroq
        llm = ChatGroq(
            model=GROQ_MODEL,
            api_key=GROQ_API_KEY,
            temperature=0.3
        )
        
        prompt = f"""Đặt một tiêu đề ngắn gọn (tối đa 6 từ) bằng tiếng Việt cho cuộc trò chuyện này:

{conversation_text}

Chỉ trả về tiêu đề, không giải thích."""
        
        response = llm.invoke(prompt)
        title = response.content.strip().strip('"').strip("'")
        return title[:50] if title else "Cuộc trò chuyện"
        
    except Exception as e:
        print(f"[Generate Title] Error: {e}")
        return "Cuộc trò chuyện"


# Alias for history.html compatibility
@app.get("/api/history/{user_id}")
async def get_history(user_id: str, days: int = 30):
    """Get chat history for history.html page"""
    try:
        sessions = chat_manager.get_user_sessions(user_id, limit=50)
        
        formatted_sessions = []
        for s in sessions:
            formatted_sessions.append({
                "id": s.get("id"),
                "title": s.get("title", "Cuộc trò chuyện"),
                "date": s.get("date", ""),
                "time": s.get("time", ""),
                "preview": s.get("preview", ""),
                "emotion_score": s.get("emotion_score", 5),
                "tags": s.get("tags", []),
                "full_text": s.get("full_text", "")
            })
        
        return {"success": True, "sessions": formatted_sessions, "count": len(formatted_sessions)}
    except Exception as e:
        print(f"[History] Error: {e}")
        return {"success": False, "sessions": [], "error": str(e)}

# ==================== Therapist Mode API ====================

@app.post("/api/therapist/pair")
async def pair_therapist(pairing: TherapistPairing):
    """Activate therapist pairing code"""
    # TODO: Implement pairing code validation
    # For now, return mock success
    return {
        "success": True,
        "therapist_name": "BS. Nguyễn Văn A",
        "message": "Đã kết nối với chuyên gia"
    }

@app.get("/api/therapist/assignments/{user_id}")
async def get_assignments(user_id: str):
    """Get homework assignments from therapist"""
    # Mock data for demo
    return {
        "success": True,
        "assignments": [
            {
                "id": 1,
                "title": "Ghi lại 3 điều biết ơn",
                "description": "Mỗi ngày ghi lại 3 điều bạn cảm thấy biết ơn",
                "due_date": "2024-11-30"
            }
        ]
    }

# ==================== Static Files ====================

# Favicon endpoint
# ==================== Static Files ====================

# Favicon endpoint
@app.get("/favicon.ico")
async def favicon():
    """Serve favicon as SVG"""
    return FileResponse("pwa/images/favicon.svg", media_type="image/svg+xml")

# Mount PWA static files
app.mount("/static", StaticFiles(directory="pwa"), name="static")

# Landing Page (Public)
@app.get("/")
async def serve_landing():
    """Serve Landing Page"""
    return FileResponse("pwa/landing.html")

# Auth Page (Login/Register)
@app.get("/auth")
@app.get("/auth.html")
async def serve_auth():
    """Serve Auth Page"""
    return FileResponse("pwa/auth.html")

# App Dashboard (Journal)
@app.get("/app")
async def serve_app_home():
    """Serve App Dashboard (Journal)"""
    return FileResponse("pwa/app.html")

# App Auth Page
@app.get("/app/auth")
async def serve_app_auth():
    """Serve Auth Page within app context"""
    return FileResponse("pwa/auth.html")

# Chat Interface
@app.get("/app/chat")
async def serve_chat():
    """Serve Chat Interface"""
    return FileResponse("pwa/chat.html")

@app.get("/app/insights")
async def serve_insights():
    """Serve insights page"""
    return FileResponse("pwa/insights.html")

@app.get("/app/history")
async def serve_history():
    """Serve conversation history page"""
    return FileResponse("pwa/history.html")

@app.get("/app/settings")
async def serve_settings():
    """Serve settings page"""
    return FileResponse("pwa/settings.html")

@app.get("/login")
async def serve_login():
    """Serve login page"""
    return FileResponse("pwa/login.html")


@app.get("/manifest.json")
async def serve_manifest():
    """Serve PWA manifest"""
    return FileResponse("pwa/manifest.json", media_type="application/json")

@app.get("/config.js")
async def serve_config():
    """Serve config.js"""
    return FileResponse("pwa/config.js", media_type="application/javascript")

@app.get("/service-worker.js")
async def serve_sw():
    """Serve service worker"""
    return FileResponse("pwa/service-worker.js", media_type="application/javascript")

@app.get("/app/{full_path:path}")
async def serve_pwa_other(full_path: str):
    """Serve other PWA pages"""
    # Try to serve the specific HTML file
    file_path = f"pwa/{full_path}.html" if not full_path.endswith('.html') else f"pwa/{full_path}"
    try:
        if os.path.exists(file_path):
            return FileResponse(file_path)
        else:
             # Fallback to app.html for client-side routing if we had it, 
             # but for now let's just return app.html or 404
             return FileResponse("pwa/app.html")
    except:
        return FileResponse("pwa/app.html")

# Catch-all for .html files in root
@app.get("/{filename}.html")
async def serve_html_file(filename: str):
    """Serve any .html file from pwa directory"""
    file_path = f"pwa/{filename}.html"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Page not found")

# ==================== Journal API ====================

@app.post("/api/journal/save")
async def save_journal(entry: JournalEntry):
    """Save a new journal entry"""
    try:
        result = journal_manager.create_entry(
            user_id=entry.user_id,
            content=entry.content,
            title=entry.title,
            mood=entry.mood,
            tags=entry.tags
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/journal/{user_id}")
async def get_journals(user_id: str, limit: int = 10, offset: int = 0):
    """Get journal entries"""
    try:
        entries = journal_manager.get_entries(user_id, limit, offset)
        return {"success": True, "entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/journal/{entry_id}")
async def delete_journal(entry_id: int, user_id: str):
    """Delete a journal entry"""
    try:
        result = journal_manager.delete_entry(entry_id, user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Goals API ====================

class GoalCreate(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None

@app.post("/api/goals")
async def create_goal(goal: GoalCreate):
    """Create a new goal"""
    try:
        data = {
            "user_id": goal.user_id,
            "title": goal.title,
            "description": goal.description,
            "due_date": goal.due_date,
            "completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = db_manager.supabase.table("goals").insert(data).execute()
        return {"success": True, "goal": result.data[0] if result.data else None}
    except Exception as e:
        print(f"[Goals] Create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/goals/{user_id}")
async def get_goals(user_id: str, completed: Optional[bool] = None):
    """Get all goals for a user"""
    try:
        query = db_manager.supabase.table("goals").select("*").eq("user_id", user_id)
        if completed is not None:
            query = query.eq("completed", completed)
        result = query.order("created_at", desc=True).execute()
        return {"success": True, "goals": result.data or []}
    except Exception as e:
        print(f"[Goals] Get error: {e}")
        return {"success": True, "goals": []}

@app.put("/api/goals/{goal_id}")
async def update_goal(goal_id: int, update: GoalUpdate):
    """Update a goal"""
    try:
        data = {}
        if update.title is not None:
            data["title"] = update.title
        if update.description is not None:
            data["description"] = update.description
        if update.due_date is not None:
            data["due_date"] = update.due_date
        if update.completed is not None:
            data["completed"] = update.completed
            if update.completed:
                data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        result = db_manager.supabase.table("goals").update(data).eq("id", goal_id).execute()
        return {"success": True, "goal": result.data[0] if result.data else None}
    except Exception as e:
        print(f"[Goals] Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/goals/{goal_id}")
async def delete_goal(goal_id: int):
    """Delete a goal"""
    try:
        db_manager.supabase.table("goals").delete().eq("id", goal_id).execute()
        return {"success": True}
    except Exception as e:
        print(f"[Goals] Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Auth API ====================

@app.post("/api/auth/logout")
async def logout(request: dict):
    """Logout user"""
    try:
        user_id = request.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        result = auth_manager.logout(user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/google")
async def google_login(request: dict):
    """Google OAuth login"""
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        token = request.get("token")
        if not token:
            raise HTTPException(status_code=400, detail="token is required")
        
        # Verify Google token
        # NOTE: Cần set GOOGLE_CLIENT_ID trong .env
        # Tạm thời skip verification để test
        try:
            # idinfo = id_token.verify_oauth2_token(
            #     token, 
            #     google_requests.Request(), 
            #     os.environ.get("GOOGLE_CLIENT_ID")
            # )
            # google_id = idinfo['sub']
            # email = idinfo['email']
            # name = idinfo.get('name', '')
            # picture = idinfo.get('picture', '')
            
            # Temporary: decode JWT without verification (for testing)
            import base64
            import json
            payload = token.split('.')[1]
            # Add padding if needed
            payload += '=' * (4 - len(payload) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload))
            
            google_id = decoded.get('sub')
            email = decoded.get('email')
            name = decoded.get('name', '')
            picture = decoded.get('picture', '')
            
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
        
        # Login/create user
        result = auth_manager.login_google(google_id, email, name, picture)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/verify")
async def verify_session(authorization: str = Header(None)):
    """Verify session token"""
    try:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        token = authorization.replace('Bearer ', '')
        result = auth_manager.verify_session(token)
        
        if not result.get('valid'):
            raise HTTPException(status_code=401, detail=result.get('error', 'Invalid token'))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Chat Session Management ====================

@app.post("/api/chat/new")
async def create_new_chat_session(request: dict):
    """Tạo conversation mới"""
    try:
        user_id = request.get("user_id")
        title = request.get("title", "New Conversation")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        result = chat_manager.create_new_session(user_id, title)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/history/{user_id}")
async def get_chat_history(user_id: str, limit: int = 20):
    """Lấy danh sách conversations của user"""
    try:
        result = chat_manager.get_user_sessions(user_id, limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/end")
async def end_chat_session(request: dict):
    """Kết thúc session hiện tại"""
    try:
        session_id = request.get("session_id")
        final_summary = request.get("summary")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        
        result = chat_manager.end_session(session_id, final_summary)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chat/session/{session_id}")
async def delete_chat_session(session_id: int, user_id: str):
    """Xóa conversation"""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        result = chat_manager.delete_session(session_id, user_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/chat/session/{session_id}/title")
async def update_session_title(session_id: int, request: dict):
    """Cập nhật title của conversation"""
    try:
        new_title = request.get("title")
        if not new_title:
            raise HTTPException(status_code=400, detail="title is required")
        
        result = chat_manager.update_session_title(session_id, new_title)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/session/{session_id}/messages")
async def get_session_messages(session_id: int):
    """Lấy messages của một session"""
    try:
        result = chat_manager.get_session_messages(session_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Server Startup ====================




# React SPA route
@app.get("/react")
@app.get("/react/{path:path}")
async def serve_react_app(path: str = ""):
    """Serve React SPA for /react routes"""
    react_index = "pwa-react/index.html"
    if os.path.exists(react_index):
        return FileResponse(react_index)
    return JSONResponse({"error": "React build not found. Run: cd frontend && npm run build"}, status_code=404)


# Emotions Chart API - returns {emotions, labels} for chart display
@app.get("/api/emotions/chart/{user_id}")
async def get_emotions_chart(user_id: str):
    """Get emotion data with correct format for Chart.js"""
    try:
        from memory_service import get_memory_service
        from datetime import datetime
        
        memory_service = get_memory_service()
        memories = memory_service.get_all_memories(user_id)
        
        if not memories or len(memories) == 0:
            # Return sample data if no memories
            return {
                "emotions": [5, 6, 4, 7, 5, 6, 7],
                "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "success": True
            }
        
        emotions = []
        labels = []
        
        # Process last 7 memories
        for i, m in enumerate(memories[-7:]):
            # Get date label
            created = m.get('created_at', '')
            if created:
                try:
                    dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    labels.append(dt.strftime('%d/%m'))
                except:
                    labels.append(f'D{i+1}')
            else:
                labels.append(f'D{i+1}')
            
            # Simple sentiment scoring
            text = str(m.get('memory', '')).lower()
            positive_words = ['vui', 'happy', 'tốt', 'thích', 'yêu', 'hạnh phúc', 'tuyệt', 'good']
            negative_words = ['buồn', 'sad', 'lo', 'sợ', 'ghét', 'tức', 'chán', 'bad', 'stress']
            
            score = 5  # neutral
            if any(w in text for w in positive_words):
                score = 7 + (i % 3)  # 7-9
            elif any(w in text for w in negative_words):
                score = 2 + (i % 3)  # 2-4
            
            emotions.append(score)
        
        return {
            "emotions": emotions,
            "labels": labels,
            "success": True
        }
    except Exception as e:
        print(f"Emotions chart API error: {e}")
        return {
            "emotions": [5, 6, 4, 7, 5, 6, 7],
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "success": True,
            "error": str(e)
        }


# Minimal chat home page
@app.get("/home")
async def home_page():
    """Serve minimal chat UI"""
    return FileResponse("pwa/chat.html")


# Living Orb - Default screen after login
@app.get("/orb")
async def orb_page():
    """Serve Living Orb (AI Agent) page"""
    return FileResponse("pwa/orb.html")


# New UX Flow Routes
@app.get("/app/landing")
async def app_landing():
    return FileResponse("pwa/landing.html")

@app.get("/app/auth")
async def app_auth():
    return FileResponse("pwa/auth.html")

@app.get("/app/orb")
async def app_orb():
    return FileResponse("pwa/orb.html")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Reflection PWA Server...")
    print("📱 PWA will be available at: http://localhost:8000/app")
    print("🔌 API endpoints at: http://localhost:8000/api")
    print("💬 WebSocket chat at: ws://localhost:8000/ws/chat/{user_id}")
    uvicorn.run("pwa_server:app", host="0.0.0.0", port=8000, reload=True)

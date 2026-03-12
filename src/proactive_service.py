# file: proactive_service.py
"""
Proactive AI Service
AI chủ động hỏi thăm user dựa trên:
- Inactivity (lâu không chat)
- Goals/reminders đã set
- Scheduled check-ins
"""

import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


class ProactiveService:
    """Service cho AI chủ động"""
    
    def __init__(self):
        self.groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    def check_inactivity(self, user_id: str, last_active: datetime, threshold_hours: int = 72) -> Optional[Dict]:
        """
        Kiểm tra nếu user không hoạt động quá lâu.
        
        Returns:
            None nếu active, hoặc Dict với message nếu inactive
        """
        if not last_active:
            return None
        
        now = datetime.now(timezone.utc)
        if last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=timezone.utc)
        
        inactive_hours = (now - last_active).total_seconds() / 3600
        
        if inactive_hours < threshold_hours:
            return None
        
        # Generate personalized check-in message
        inactive_days = int(inactive_hours / 24)
        
        if inactive_days <= 3:
            message = "Mình nhớ bạn! Hôm nay bạn thế nào rồi? 💫"
        elif inactive_days <= 7:
            message = f"Đã {inactive_days} ngày rồi mình không gặp bạn. Mọi thứ ổn chứ? Mình luôn ở đây nếu bạn cần nói chuyện 🌸"
        else:
            message = f"Lâu quá không thấy bạn ({inactive_days} ngày). Mình hy vọng bạn ổn. Nhớ rằng mình luôn sẵn sàng lắng nghe bạn nhé 💙"
        
        return {
            "type": "inactivity_check",
            "inactive_days": inactive_days,
            "message": message,
            "priority": "medium" if inactive_days <= 7 else "high"
        }
    
    def generate_daily_checkin(self, user_id: str, memories: List[Dict] = None) -> Dict:
        """
        Tạo message check-in hàng ngày dựa trên context user.
        """
        now = datetime.now()
        hour = now.hour
        
        # Time-appropriate greeting
        if hour < 12:
            time_greeting = "Chào buổi sáng"
            emoji = "🌅"
        elif hour < 18:
            time_greeting = "Chào buổi chiều"
            emoji = "☀️"
        else:
            time_greeting = "Chào buổi tối"
            emoji = "🌙"
        
        # If we have memories, personalize the message
        if memories and len(memories) > 0:
            # Use AI to generate personalized check-in
            recent_memories = [m.get('memory', '') for m in memories[:5]]
            context = ". ".join(recent_memories)
            
            prompt = f"""Tạo một câu hỏi thăm ngắn gọn (1-2 câu) cho user dựa trên context sau:
Context: {context}

Yêu cầu:
- Thân thiện, ấm áp
- Tham chiếu đến 1 điều từ context nếu phù hợp
- Kết thúc bằng câu hỏi mở

Chỉ trả về message, không giải thích."""

            try:
                response = self.groq.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=100
                )
                personalized = response.choices[0].message.content.strip()
                message = f"{time_greeting}! {emoji} {personalized}"
            except:
                message = f"{time_greeting}! {emoji} Hôm nay của bạn thế nào rồi?"
        else:
            message = f"{time_greeting}! {emoji} Hôm nay của bạn thế nào rồi?"
        
        return {
            "type": "daily_checkin",
            "message": message,
            "timestamp": now.isoformat()
        }
    
    def check_goal_reminders(self, user_id: str, goals: List[Dict]) -> List[Dict]:
        """
        Kiểm tra goals cần nhắc nhở.
        
        Args:
            goals: List goals từ DB với due_date
            
        Returns:
            List of reminder messages
        """
        reminders = []
        now = datetime.now(timezone.utc)
        
        for goal in goals:
            due_date = goal.get('due_date')
            if not due_date:
                continue
            
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            
            days_until = (due_date - now).days
            
            if days_until < 0:
                # Overdue
                reminders.append({
                    "type": "goal_overdue",
                    "goal": goal.get('title', 'Mục tiêu'),
                    "message": f"📌 Mục tiêu '{goal.get('title')}' đã quá hạn {-days_until} ngày. Bạn có muốn điều chỉnh không?",
                    "priority": "high"
                })
            elif days_until == 0:
                # Due today
                reminders.append({
                    "type": "goal_due_today",
                    "goal": goal.get('title'),
                    "message": f"⏰ Hôm nay là hạn cho '{goal.get('title')}'! Bạn tiến độ thế nào rồi?",
                    "priority": "high"
                })
            elif days_until <= 3:
                # Due soon
                reminders.append({
                    "type": "goal_due_soon",
                    "goal": goal.get('title'),
                    "message": f"📅 Còn {days_until} ngày nữa là đến hạn '{goal.get('title')}'. Cần mình hỗ trợ gì không?",
                    "priority": "medium"
                })
        
        return reminders
    
    def get_proactive_notifications(self, user_id: str, user_data: Dict) -> List[Dict]:
        """
        Lấy tất cả notifications cần gửi cho user.
        
        Args:
            user_data: {
                "last_active": datetime,
                "memories": [...],
                "goals": [...]
            }
        """
        notifications = []
        
        # 1. Check inactivity
        if user_data.get('last_active'):
            inactivity = self.check_inactivity(user_id, user_data['last_active'])
            if inactivity:
                notifications.append(inactivity)
        
        # 2. Goal reminders
        if user_data.get('goals'):
            reminders = self.check_goal_reminders(user_id, user_data['goals'])
            notifications.extend(reminders)
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        notifications.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 2))
        
        return notifications


# Singleton
_service = None

def get_proactive_service() -> ProactiveService:
    global _service
    if _service is None:
        _service = ProactiveService()
    return _service


# Test
if __name__ == "__main__":
    service = get_proactive_service()
    
    # Test inactivity
    last_active = datetime.now(timezone.utc) - timedelta(days=5)
    result = service.check_inactivity("test_user", last_active)
    print("Inactivity check:", result)
    
    # Test daily checkin
    checkin = service.generate_daily_checkin("test_user", [{"memory": "Thích uống trà sữa"}])
    print("\nDaily checkin:", checkin)

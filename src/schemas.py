from typing import List, Optional
from pydantic import BaseModel

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

class GenerateTitleRequest(BaseModel):
    messages: list


class UpdateTitleRequest(BaseModel):
    title: str
    user_id: str


class FirstMessageRequest(BaseModel):
    user_id: str
    message: str
    images: Optional[list] = None


class DailyMoodCheckin(BaseModel):
    """Schema cho daily mood check-in với streak tracking"""
    user_id: str
    emotion_score: int  # 1-10
    context_tags: List[str] = []
    note: Optional[str] = None

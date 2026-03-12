"""
Therapist Models
Pydantic models for request/response validation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime
import re


# === Base Models ===

class TherapistBase(BaseModel):
    """Base therapist info"""
    email: str
    name: str
    license_number: Optional[str] = None


# === Client Management ===

class PairClientRequest(BaseModel):
    """Request to pair with a client"""
    client_id: str = Field(..., min_length=1, max_length=100)
    pairing_code: Optional[str] = Field(None, max_length=50)
    
    @validator('client_id')
    def validate_client_id(cls, v):
        if not v or not v.strip():
            raise ValueError('Client ID cannot be empty')
        return v.strip()


class UnpairClientRequest(BaseModel):
    """Request to unpair a client"""
    reason: Optional[str] = Field(None, max_length=500)


# === Assignments ===

class AssignmentCreate(BaseModel):
    """Create assignment request"""
    client_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=5000)
    due_date: Optional[str] = None
    
    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()
    
    @validator('due_date')
    def validate_due_date(cls, v):
        if v:
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('Due date must be in YYYY-MM-DD format')
        return v


class AssignmentComplete(BaseModel):
    """Complete assignment request"""
    completion_notes: Optional[str] = Field(None, max_length=2000)


class BulkAssignmentCreate(BaseModel):
    """Create assignments for multiple clients"""
    client_ids: List[str] = Field(..., min_items=1, max_items=50)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=5000)
    due_date: Optional[str] = None


# === Crisis Events ===

class CrisisAcknowledge(BaseModel):
    """Acknowledge crisis request"""
    notes: Optional[str] = Field(None, max_length=2000)


# === Appointments ===

class AppointmentCreate(BaseModel):
    """Create appointment request"""
    client_id: str = Field(..., min_length=1)
    appointment_date: str = Field(...)  # ISO datetime
    duration_minutes: int = Field(60, ge=15, le=480)
    type: str = Field('online')
    location: Optional[str] = Field(None, max_length=500)
    meeting_link: Optional[str] = Field(None, max_length=1000)
    notes: Optional[str] = Field(None, max_length=2000)
    
    @validator('type')
    def validate_type(cls, v):
        allowed = ['online', 'offline', 'phone']
        if v not in allowed:
            raise ValueError(f'Type must be one of: {allowed}')
        return v
    
    @validator('meeting_link')
    def validate_meeting_link(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('Meeting link must be a valid URL')
        return v


class AppointmentUpdate(BaseModel):
    """Update appointment request"""
    appointment_date: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    type: Optional[str] = None
    location: Optional[str] = Field(None, max_length=500)
    meeting_link: Optional[str] = Field(None, max_length=1000)
    notes: Optional[str] = Field(None, max_length=2000)
    status: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v:
            allowed = ['scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled']
            if v not in allowed:
                raise ValueError(f'Status must be one of: {allowed}')
        return v


class AppointmentCancel(BaseModel):
    """Cancel appointment request"""
    reason: Optional[str] = Field(None, max_length=500)


# === Messaging ===

class MessageCreate(BaseModel):
    """Create message request"""
    message_content: str = Field(..., min_length=1, max_length=10000)
    attachments: Optional[List[dict]] = Field(default_factory=list)
    
    @validator('message_content')
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Message content cannot be empty')
        return v.strip()


class MarkReadRequest(BaseModel):
    """Mark messages as read"""
    pass  # No additional fields needed


# === Medical Profile ===

class MedicalProfileCreate(BaseModel):
    """Create/update medical profile"""
    presenting_problem: Optional[str] = Field(None, max_length=5000)
    psychiatric_history: Optional[str] = Field(None, max_length=5000)
    current_medications: Optional[str] = Field(None, max_length=2000)
    allergies: Optional[str] = Field(None, max_length=1000)
    dsm5_codes: Optional[List[str]] = Field(default_factory=list)
    treatment_goals: Optional[str] = Field(None, max_length=5000)
    treatment_plan: Optional[str] = Field(None, max_length=5000)
    estimated_sessions: Optional[int] = Field(None, ge=1, le=500)
    emergency_contact_name: Optional[str] = Field(None, max_length=200)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    emergency_contact_relationship: Optional[str] = Field(None, max_length=100)
    
    @validator('dsm5_codes')
    def validate_dsm5(cls, v):
        if v and len(v) > 20:
            raise ValueError('Maximum 20 DSM-5 codes allowed')
        return v
    
    @validator('emergency_contact_phone')
    def validate_phone(cls, v):
        if v:
            # Basic phone validation
            cleaned = re.sub(r'[\s\-\(\)]', '', v)
            if not cleaned.replace('+', '').isdigit():
                raise ValueError('Invalid phone number format')
        return v


# === Session Notes ===

class SessionNoteCreate(BaseModel):
    """Create session note"""
    session_date: str = Field(...)
    session_type: str = Field('online')
    duration_minutes: Optional[int] = Field(None, ge=1, le=480)
    session_content: Optional[str] = Field(None, max_length=10000)
    client_presentation: Optional[str] = Field(None, max_length=5000)
    interventions_used: Optional[List[str]] = Field(default_factory=list)
    progress_assessment: Optional[str] = Field(None, max_length=5000)
    mood_observation: Optional[str] = Field(None, max_length=2000)
    risk_assessment: Optional[str] = Field(None, max_length=2000)
    next_session_plan: Optional[str] = Field(None, max_length=2000)
    homework_assigned: Optional[str] = Field(None, max_length=2000)
    private_notes: Optional[str] = Field(None, max_length=5000)
    
    @validator('session_type')
    def validate_session_type(cls, v):
        allowed = ['online', 'offline', 'phone']
        if v not in allowed:
            raise ValueError(f'Session type must be one of: {allowed}')
        return v


class SessionNoteUpdate(BaseModel):
    """Update session note"""
    session_date: Optional[str] = None
    session_type: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=480)
    session_content: Optional[str] = Field(None, max_length=10000)
    client_presentation: Optional[str] = Field(None, max_length=5000)
    interventions_used: Optional[List[str]] = None
    progress_assessment: Optional[str] = Field(None, max_length=5000)
    mood_observation: Optional[str] = Field(None, max_length=2000)
    risk_assessment: Optional[str] = Field(None, max_length=2000)
    next_session_plan: Optional[str] = Field(None, max_length=2000)
    homework_assigned: Optional[str] = Field(None, max_length=2000)
    private_notes: Optional[str] = Field(None, max_length=5000)


# === Client Groups ===

class GroupCreate(BaseModel):
    """Create client group"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=20)
    
    @validator('color')
    def validate_color(cls, v):
        if v:
            # Accept hex colors
            if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
                raise ValueError('Color must be a valid hex color (e.g., #667eea)')
        return v


class GroupUpdate(BaseModel):
    """Update client group"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, max_length=20)


class AddClientToGroup(BaseModel):
    """Add client to group"""
    client_id: str = Field(..., min_length=1)


# === Progress Metrics ===

class ProgressMetricCreate(BaseModel):
    """Create progress metric"""
    week_number: int = Field(..., ge=1, le=53)
    year: int = Field(..., ge=2020, le=2100)
    app_usage_days: Optional[int] = Field(None, ge=0, le=7)
    total_chat_sessions: Optional[int] = Field(None, ge=0)
    avg_emotion_score: Optional[float] = Field(None, ge=0, le=10)
    journal_entries_count: Optional[int] = Field(None, ge=0)
    assignments_completed: Optional[int] = Field(None, ge=0)
    assignments_total: Optional[int] = Field(None, ge=0)
    appointments_attended: Optional[int] = Field(None, ge=0)
    appointments_total: Optional[int] = Field(None, ge=0)
    therapist_assessment: Optional[str] = Field(None, max_length=5000)
    progress_rating: Optional[int] = Field(None, ge=1, le=10)
    phq9_score: Optional[int] = Field(None, ge=0, le=27)
    gad7_score: Optional[int] = Field(None, ge=0, le=21)


# === Treatment Outcomes ===

class TreatmentOutcomeCreate(BaseModel):
    """Create/update treatment outcome"""
    closure_date: Optional[str] = None
    closure_reason: Optional[str] = None
    outcome_rating: Optional[str] = None
    goals_total: Optional[int] = Field(None, ge=0)
    goals_achieved: Optional[int] = Field(None, ge=0)
    client_feedback: Optional[str] = Field(None, max_length=5000)
    therapist_notes: Optional[str] = Field(None, max_length=5000)
    lessons_learned: Optional[str] = Field(None, max_length=5000)
    follow_up_recommended: bool = False
    follow_up_date: Optional[str] = None
    
    @validator('closure_reason')
    def validate_closure_reason(cls, v):
        if v:
            allowed = ['completed', 'referred', 'dropped_out', 'moved', 'other']
            if v not in allowed:
                raise ValueError(f'Closure reason must be one of: {allowed}')
        return v
    
    @validator('outcome_rating')
    def validate_outcome_rating(cls, v):
        if v:
            allowed = ['significantly_improved', 'improved', 'stable', 'worsened']
            if v not in allowed:
                raise ValueError(f'Outcome rating must be one of: {allowed}')
        return v


# === Privacy Settings ===

class PrivacySettingsUpdate(BaseModel):
    """Update privacy settings"""
    allow_therapist_chat_history: Optional[bool] = None
    allow_therapist_mood_journal: Optional[bool] = None
    allow_therapist_assignments: Optional[bool] = None
    allow_therapist_goals: Optional[bool] = None
    allow_therapist_memories: Optional[bool] = None
    share_history_days: Optional[int] = Field(None, ge=0, le=365)
    notify_when_therapist_access: Optional[bool] = None

"""
Therapist Module
Comprehensive therapist dashboard functionality with security
"""

# Sub-services (kept from original)
from .therapist_medical_service import TherapistMedicalService
from .therapist_messaging_service import TherapistMessagingService
from .therapist_appointment_service import TherapistAppointmentService
from .therapist_group_service import TherapistGroupService

# Main service
from .service import TherapistService, get_therapist_service

# Security
from .security import TherapistSecurity, require_auth, require_auth_for_user

# Models
from .models import (
    PairClientRequest, AssignmentCreate, AssignmentComplete, BulkAssignmentCreate,
    CrisisAcknowledge, AppointmentCreate, AppointmentUpdate, AppointmentCancel,
    MessageCreate, MarkReadRequest, MedicalProfileCreate, SessionNoteCreate,
    SessionNoteUpdate, GroupCreate, GroupUpdate, AddClientToGroup,
    ProgressMetricCreate, TreatmentOutcomeCreate, PrivacySettingsUpdate
)

# Routes
from .routes import router

__all__ = [
    # Services
    'TherapistService',
    'get_therapist_service',
    'TherapistMedicalService',
    'TherapistMessagingService',
    'TherapistAppointmentService',
    'TherapistGroupService',
    
    # Security
    'TherapistSecurity',
    'require_auth',
    'require_auth_for_user',
    
    # Models
    'PairClientRequest',
    'AssignmentCreate',
    'AssignmentComplete',
    'BulkAssignmentCreate',
    'CrisisAcknowledge',
    'AppointmentCreate',
    'AppointmentUpdate',
    'AppointmentCancel',
    'MessageCreate',
    'MarkReadRequest',
    'MedicalProfileCreate',
    'SessionNoteCreate',
    'SessionNoteUpdate',
    'GroupCreate',
    'GroupUpdate',
    'AddClientToGroup',
    'ProgressMetricCreate',
    'TreatmentOutcomeCreate',
    'PrivacySettingsUpdate',
    
    # Routes
    'router'
]

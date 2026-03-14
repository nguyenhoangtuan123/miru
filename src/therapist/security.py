"""
Therapist Security Module
Handles authentication, authorization, and audit logging
"""

from fastapi import HTTPException, Request
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import hashlib
from therapist_verification_service import get_therapist_verification_service


class TherapistSecurity:
    """Security utilities for therapist module"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    # === AUTHENTICATION ===
    
    async def get_current_user(self, request: Request) -> Dict:
        """Get authenticated user from request"""
        from auth_middleware import get_current_user
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user
    
    async def require_therapist(self, request: Request) -> str:
        """Require user to be a therapist, return therapist_id"""
        user = await self.get_current_user(request)
        user_id = user.get("sub") or user.get("user_id")
        
        # Check if user has therapist role
        profile = self.supabase.table('user_profiles') \
            .select('role') \
            .eq('user_id', user_id) \
            .execute()
        
        if not profile.data or profile.data[0].get('role') != 'therapist':
            raise HTTPException(
                status_code=403, 
                detail="Access denied. Therapist role required."
            )
        if not get_therapist_verification_service().can_access_portal(user_id):
            raise HTTPException(
                status_code=403,
                detail="Access denied. Therapist verification approval required."
            )
        
        return user_id
    
    async def require_therapist_owns_resource(
        self, 
        request: Request, 
        therapist_id: str
    ) -> str:
        """Verify logged-in user matches the therapist_id in URL"""
        current_user_id = await self.require_therapist(request)
        
        if current_user_id != therapist_id:
            raise HTTPException(
                status_code=403, 
                detail="Access denied. You can only access your own resources."
            )
        
        return current_user_id
    
    # === AUTHORIZATION - Relationship Checks ===
    
    def verify_client_relationship(
        self, 
        therapist_id: str, 
        client_id: str,
        require_active: bool = True
    ) -> bool:
        """
        Verify therapist has relationship with client.
        This is CRITICAL for data privacy.
        """
        query = self.supabase.table('therapist_clients') \
            .select('id, status') \
            .eq('therapist_id', therapist_id) \
            .eq('client_id', client_id)
        
        if require_active:
            query = query.eq('status', 'active')
        
        result = query.execute()
        
        if not result.data:
            raise HTTPException(
                status_code=403, 
                detail="Access denied. No active relationship with this client."
            )
        
        return True
    
    def verify_owns_resource(
        self,
        table: str,
        resource_id: int,
        therapist_id: str,
        id_column: str = 'id'
    ) -> Dict:
        """Verify therapist owns a specific resource"""
        result = self.supabase.table(table) \
            .select('*') \
            .eq(id_column, resource_id) \
            .eq('therapist_id', therapist_id) \
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=404, 
                detail=f"Resource not found or access denied."
            )
        
        return result.data[0]
    
    # === AUDIT LOGGING ===
    
    def log_access(
        self,
        accessor_id: str,
        accessor_type: str,
        client_id: str,
        action: str,
        resource_type: str,
        resource_id: int = None,
        request: Request = None,
        extra_data: Dict = None
    ) -> None:
        """
        Log data access for compliance and security.
        Actions: view, edit, delete, export
        """
        try:
            ip_address = None
            user_agent = None
            
            if request:
                ip_address = request.client.host if request.client else None
                user_agent = request.headers.get('user-agent', '')[:500]
            
            data = {
                'accessor_id': accessor_id,
                'accessor_type': accessor_type,
                'client_id': client_id,
                'action': action,
                'resource_type': resource_type,
                'resource_id': resource_id,
                'ip_address': ip_address,
                'user_agent': user_agent,
                'accessed_at': datetime.now(timezone.utc).isoformat()
            }
            
            self.supabase.table('data_access_audit').insert(data).execute()
        except Exception as e:
            # Don't fail the main request if audit logging fails
            print(f"[Audit] Failed to log access: {e}")
    
    def log_sensitive_action(
        self,
        therapist_id: str,
        client_id: str,
        action: str,
        resource_type: str,
        resource_id: int = None,
        request: Request = None
    ) -> None:
        """Convenience method for logging therapist actions"""
        self.log_access(
            accessor_id=therapist_id,
            accessor_type='therapist',
            client_id=client_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            request=request
        )
    
    # === DATA PROTECTION ===
    
    def mask_sensitive_data(self, data: Dict, fields: list) -> Dict:
        """Mask sensitive fields in response"""
        masked = data.copy()
        for field in fields:
            if field in masked and masked[field]:
                value = str(masked[field])
                if len(value) > 4:
                    masked[field] = value[:2] + '*' * (len(value) - 4) + value[-2:]
                else:
                    masked[field] = '****'
        return masked
    
    def hash_for_comparison(self, value: str) -> str:
        """Hash value for secure comparison"""
        return hashlib.sha256(value.encode()).hexdigest()
    
    # === PRIVACY CONSENT ===
    
    def check_client_consent(
        self,
        client_id: str,
        consent_type: str
    ) -> bool:
        """Check if client has given consent for specific data access"""
        result = self.supabase.table('user_privacy_settings') \
            .select(consent_type) \
            .eq('user_id', client_id) \
            .execute()
        
        if not result.data:
            return False
        
        return result.data[0].get(consent_type, False)
    
    def log_consent(
        self,
        user_id: str,
        therapist_id: str,
        consent_type: str,
        consent_given: bool,
        request: Request = None
    ) -> None:
        """Log consent changes for compliance"""
        try:
            ip_address = None
            user_agent = None
            
            if request:
                ip_address = request.client.host if request.client else None
                user_agent = request.headers.get('user-agent', '')[:500]
            
            data = {
                'user_id': user_id,
                'therapist_id': therapist_id,
                'consent_type': consent_type,
                'consent_given': consent_given,
                'consent_date': datetime.now(timezone.utc).isoformat(),
                'ip_address': ip_address,
                'user_agent': user_agent
            }
            
            self.supabase.table('privacy_consent_log').insert(data).execute()
        except Exception as e:
            print(f"[Consent] Failed to log consent: {e}")


# === Dependency Injection Helpers ===

async def require_auth(request: Request) -> Dict:
    """FastAPI dependency: require authentication"""
    from auth_middleware import get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_auth_for_user(request: Request, user_id: str) -> Dict:
    """FastAPI dependency: require auth and verify user owns resource"""
    user = await require_auth(request)
    current_user_id = user.get("sub") or user.get("user_id")
    
    if current_user_id != user_id:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You can only access your own resources."
        )
    
    return user

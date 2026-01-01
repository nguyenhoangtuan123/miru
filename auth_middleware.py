"""
Authentication middleware for protecting routes
Separate module for route protection logic
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import RedirectResponse
from typing import Optional, Dict
from auth import verify_token


async def get_current_user(request: Request) -> Optional[Dict]:
    """
    Extract and verify user from JWT token in cookie
    
    Args:
        request: FastAPI request object
    
    Returns:
        User payload dict if authenticated, None otherwise
    """
    token = request.cookies.get("access_token")
    
    if not token:
        return None
    
    payload = verify_token(token)
    return payload


async def require_auth(request: Request) -> Dict:
    """
    Middleware to require authentication for protected routes
    Raises HTTPException if not authenticated
    
    Args:
        request: FastAPI request object
    
    Returns:
        User payload dict
    
    Raises:
        HTTPException: 401 if not authenticated
    """
    user = await get_current_user(request)
    
    if not user:
        # For API routes, return 401
        if request.url.path.startswith("/api/"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )
        # For page routes, redirect to login
        else:
            raise HTTPException(
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                headers={"Location": "/login"}
            )
    
    return user


def create_auth_cookie(token: str) -> Dict:
    """
    Create cookie configuration for JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Cookie configuration dict
    """
    return {
        "key": "access_token",
        "value": token,
        "httponly": True,  # Prevent XSS
        "samesite": "lax",  # CSRF protection
        "max_age": 14 * 24 * 60 * 60,  # 14 days in seconds
        # "secure": True,  # Enable in production with HTTPS
    }


def clear_auth_cookie() -> Dict:
    """
    Create cookie configuration to clear auth token
    
    Returns:
        Cookie configuration dict
    """
    return {
        "key": "access_token",
        "value": "",
        "httponly": True,
        "samesite": "lax",
        "max_age": 0,  # Expire immediately
    }

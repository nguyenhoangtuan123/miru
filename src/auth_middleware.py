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
    Extract and verify user from JWT token.
    Checks Authorization header first, then falls back to cookie.
    
    Args:
        request: FastAPI request object
    
    Returns:
        User payload dict if authenticated, None otherwise
    """
    token = None
    
    # 1. Check Authorization header (Bearer token from Next.js frontend)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    # 2. Fallback to cookie (legacy PWA)
    if not token:
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


def get_user_id_from_claims(user: Dict) -> Optional[str]:
    user_id = user.get("sub") or user.get("user_id")
    return str(user_id) if user_id is not None else None


async def require_auth_for_user(request: Request, user_id: str) -> Dict:
    user = await require_auth(request)
    current_user_id = get_user_id_from_claims(user)

    if not current_user_id or current_user_id != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    return user


async def require_user_id(request: Request) -> str:
    user = await require_auth(request)
    user_id = get_user_id_from_claims(user)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user_id


async def require_user_id(request: Request) -> str:
    """Require an authenticated user and return its stable text id."""
    user = await require_auth(request)
    user_id = user.get("sub") or user.get("user_id")

    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user"
        )

    return user_id


async def require_auth_for_user(request: Request, user_id: str) -> Dict:
    """Require authentication and ensure the token belongs to the requested user."""
    current_user = await require_auth(request)
    current_user_id = current_user.get("sub") or current_user.get("user_id")

    if current_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return current_user


def create_auth_cookie(token: str) -> Dict:
    """
    Create cookie configuration for JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Cookie configuration dict
    """
    import os
    is_production = os.getenv("ENVIRONMENT", "development") == "production"
    
    return {
        "key": "access_token",
        "value": token,
        "httponly": True,  # Prevent XSS
        "samesite": "strict" if is_production else "lax",  # CSRF protection
        "max_age": 14 * 24 * 60 * 60,  # 14 days in seconds
        "secure": is_production,  # HTTPS only in production
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

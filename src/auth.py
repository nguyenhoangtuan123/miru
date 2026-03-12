"""
Authentication utilities for Google OAuth and JWT token management
"""
import os
from datetime import datetime, timedelta
from typing import Optional, Dict
import jwt
from jwt.exceptions import InvalidTokenError
from dotenv import load_dotenv

load_dotenv()

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "14"))


def create_access_token(user_id: str, email: str, name: str = None) -> str:
    """
    Create JWT access token for authenticated user
    
    Args:
        user_id: Google user ID
        email: User email
        name: User display name (optional)
    
    Returns:
        JWT token string
    """
    expiry = datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)
    
    payload = {
        "sub": user_id,  # Subject (user ID)
        "email": email,
        "name": name,
        "exp": expiry,  # Expiration time
        "iat": datetime.utcnow(),  # Issued at
    }
    
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token: str) -> Optional[Dict]:
    """
    Verify and decode JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload dict if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except InvalidTokenError as e:
        print(f"Token verification failed: {e}")
        return None


def get_token_expiry(token: str) -> Optional[datetime]:
    """
    Get expiration time from token
    
    Args:
        token: JWT token string
    
    Returns:
        Expiration datetime if valid, None if invalid
    """
    payload = verify_token(token)
    if payload and "exp" in payload:
        return datetime.fromtimestamp(payload["exp"])
    return None


def is_token_expired(token: str) -> bool:
    """
    Check if token is expired
    
    Args:
        token: JWT token string
    
    Returns:
        True if expired or invalid, False if still valid
    """
    expiry = get_token_expiry(token)
    if expiry is None:
        return True
    return datetime.utcnow() > expiry

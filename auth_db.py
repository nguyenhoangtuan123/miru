"""
Database operations for user authentication
Adapted for Supabase instead of SQLite
"""
from datetime import datetime
from typing import Optional, Dict
from database import DatabaseManager


class AuthDatabase:
    """Handle all user-related database operations with Supabase"""
    
    def __init__(self):
        self.db = DatabaseManager()
    
    def create_or_update_user(self, user_data: Dict) -> bool:
        """
        Create new user or update existing user from Google OAuth data
        Uses Supabase upsert functionality
        
        Args:
            user_data: Dict with keys: id, email, name, picture
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Prepare data for Supabase
            data = {
                "id": user_data.get("id"),
                "email": user_data.get("email"),
                "name": user_data.get("name"),
                "picture": user_data.get("picture"),
                "last_login": datetime.now().isoformat()
            }
            
            # Upsert: insert or update if exists
            response = self.db.supabase.table('users').upsert(
                data,
                on_conflict='id'  # Update if id already exists
            ).execute()
            
            return True
            
        except Exception as e:
            print(f"Error creating/updating user: {e}")
            return False
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """
        Get user by Google ID using Supabase
        
        Args:
            user_id: Google user ID
        
        Returns:
            User dict if found, None otherwise
        """
        try:
            response = self.db.supabase.table('users').select('*').eq('id', user_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            print(f"Error fetching user: {e}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """
        Get user by email using Supabase
        
        Args:
            email: User email address
        
        Returns:
            User dict if found, None otherwise
        """
        try:
            response = self.db.supabase.table('users').select('*').eq('email', email).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            print(f"Error fetching user by email: {e}")
            return None
    
    def update_last_login(self, user_id: str) -> bool:
        """
        Update user's last login timestamp using Supabase
        
        Args:
            user_id: Google user ID
        
        Returns:
            True if successful, False otherwise
        """
        try:
            response = self.db.supabase.table('users').update({
                'last_login': datetime.now().isoformat()
            }).eq('id', user_id).execute()
            
            return True
            
        except Exception as e:
            print(f"Error updating last login: {e}")
            return False

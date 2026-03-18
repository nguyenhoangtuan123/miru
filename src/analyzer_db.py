# analyzer_db.py
"""
Separate database module for AI Analyzer operations.
This module extends DatabaseManager with analyzer-specific CRUD operations.
"""

from datetime import datetime, timezone, timedelta


class AnalyzerDatabase:
    """Database operations for AI Analyzer"""
    
    def __init__(self, db_manager):
        """Initialize with existing DatabaseManager instance"""
        self.db = db_manager
    
    def save_analyzed_session(self, session_id: int, user_id_str: str, analysis: dict):
        """Save AI-analyzed session data"""
        try:
            user = self.db.get_or_create_user(user_id_str)
            user_db_id = user['id']
            
            data = {
                'session_id': session_id,
                'user_id': user_db_id,
                'emotion_score': analysis.get('emotion_score', 5),
                'dominant_emotion': analysis.get('dominant_emotion', 'bình_thường'),
                'topics': analysis.get('topics', []),
                'key_moments': analysis.get('key_moments', []),
                'ai_summary': analysis.get('summary', ''),
                'ai_title': analysis.get('title', 'Phiên trò chuyện')
            }
            if analysis.get('facts_content') is not None:
                data['facts_content'] = analysis.get('facts_content')

            response = self.db.supabase.table('analyzed_sessions')\
                .upsert(data, on_conflict='session_id')\
                .execute()
            
            if response.data:
                print(f"✅ Saved analysis for session {session_id}")
                return response.data[0]
            return None
        except Exception as e:
            print(f"❌ Error saving analyzed session: {e}")
            return None
    
    def get_analyzed_sessions(self, user_id_str: str, days: int = 30, limit: int = 50):
        """Get analyzed sessions for a user"""
        try:
            user = self.db.get_or_create_user(user_id_str)
            user_db_id = user['id']
            
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            
            response = self.db.supabase.table('analyzed_sessions')\
                .select('*, session_summaries!inner(created_at, summary_text)')\
                .eq('user_id', user_db_id)\
                .gte('analyzed_at', cutoff.isoformat())\
                .order('analyzed_at', desc=True)\
                .limit(limit)\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            print(f"❌ Error getting analyzed sessions: {e}")
            return []
    
    def get_session_by_id(self, session_id: int):
        """Get a specific session summary by ID"""
        try:
            response = self.db.supabase.table('session_summaries')\
                .select('*')\
                .eq('id', session_id)\
                .execute()
            
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            print(f"❌ Error getting session: {e}")
            return None


# Export for easy import
__all__ = ['AnalyzerDatabase']

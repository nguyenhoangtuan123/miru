# analyzer_integration.py
"""
Standalone integration module for AI Analyzer.
Import this in pwa_server.py to add analyzer functionality without modifying existing code.
"""

import asyncio
from analyzer import analyze_session
from database import DatabaseManager
from analyzer_db import AnalyzerDatabase

# Lazy initialization - don't create instances at import time
_db_manager = None
_analyzer_db = None

def get_db_manager():
    """Get or create DatabaseManager instance"""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager

def get_analyzer_db():
    """Get or create AnalyzerDatabase instance"""
    global _analyzer_db
    if _analyzer_db is None:
        _analyzer_db = AnalyzerDatabase(get_db_manager())
    return _analyzer_db


async def analyze_conversation_background(user_id: str, user_message: str, ai_message: str):
    """
    Analyze conversation in background (non-blocking).
    Call this after saving chat message to database.
    
    Args:
        user_id: User ID string
        user_message: User's message
        ai_message: AI's response
    """
    try:
        # Build conversation text
        conversation_text = f"User: {user_message}\nAI: {ai_message}"
        
        # Get database instances
        db_manager = get_db_manager()
        analyzer_db = get_analyzer_db()
        
        # Get latest session ID for this user
        user = db_manager.get_or_create_user(user_id)
        user_db_id = user['id']
        
        response = db_manager.supabase.table('session_summaries')\
            .select('id')\
            .eq('user_id', user_db_id)\
            .order('created_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not response.data:
            print("⚠️ [Analyzer] No session found to analyze")
            return
        
        session_id = response.data[0]['id']
        
        # Analyze with AI (separate model instance)
        print(f"🔍 [Analyzer] Analyzing session {session_id} in background...")
        analysis = await analyze_session(conversation_text)
        
        if analysis:
            # Save analyzed data using analyzer_db module
            analyzer_db.save_analyzed_session(session_id, user_id, analysis)
            print(f"✅ [Analyzer] Saved: {analysis.get('title', 'N/A')}")
        else:
            print("⚠️ [Analyzer] Analysis failed")
            
    except Exception as e:
        print(f"❌ [Analyzer] Background error: {e}")
        # Don't crash - this is background task


# Export for easy import
__all__ = ['analyze_conversation_background', 'get_db_manager']

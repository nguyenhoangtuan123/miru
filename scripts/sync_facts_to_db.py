#!/usr/bin/env python3
"""
Script to sync existing facts.txt files to the database.
Run this once to migrate local facts.txt content to the database.
"""

import os
import sys
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DatabaseManager

def sync_facts_to_db():
    """Sync all local facts.txt files to database"""
    db = DatabaseManager()
    memories_dir = "memories"
    
    if not os.path.exists(memories_dir):
        print(f"[WARN] Directory {memories_dir} not found")
        return
    
    sessions_count = 0
    synced_count = 0
    errors = []
    
    for folder in os.listdir(memories_dir):
        if not folder.startswith("session_"):
            continue
        
        session_id = folder.replace("session_", "")
        facts_path = os.path.join(memories_dir, folder, "facts.txt")
        
        if not os.path.exists(facts_path):
            continue
        
        sessions_count += 1
        
        try:
            with open(facts_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            if not content.strip():
                continue
            
            # Get user_id from session_summaries
            session_response = db.supabase.table('session_summaries')\
                .select('user_id')\
                .eq('id', session_id)\
                .execute()
            
            if not session_response.data:
                print(f"[SKIP] Session {session_id}: Not found in session_summaries")
                continue
            
            user_db_id = session_response.data[0]['user_id']
            
                # Upsert to database (without updated_at to avoid schema cache issues)
                db.supabase.table('analyzed_sessions').upsert({
                    'session_id': int(session_id),
                    'user_id': user_db_id,
                    'facts_content': content
                }, on_conflict='session_id').execute()
            
            synced_count += 1
            print(f"[OK] Synced session {session_id}")
            
        except Exception as e:
            errors.append(f"Session {session_id}: {str(e)}")
            print(f"[ERROR] Session {session_id}: {e}")
    
    print(f"\n=== Summary ===")
    print(f"Total sessions found: {sessions_count}")
    print(f"Successfully synced: {synced_count}")
    print(f"Errors: {len(errors)}")
    
    if errors:
        print("\nErrors:")
        for err in errors:
            print(f"  - {err}")

if __name__ == "__main__":
    sync_facts_to_db()

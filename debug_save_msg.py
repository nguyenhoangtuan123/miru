import asyncio
from chat_manager import ChatManager
from database import DatabaseManager

async def test_save_message():
    print("Testing save message...")
    try:
        db = DatabaseManager()
        cm = ChatManager()
        
        # Get a user (or use a test one)
        user_id = "test_debug_user"
        print(f"User ID: {user_id}")
        
        # Create session
        session_res = cm.create_new_session(user_id, "Debug Session")
        if not session_res['success']:
            print("Failed to create session:", session_res)
            return
            
        session_id = session_res['session_id']
        print(f"Session ID: {session_id}")
        
        # Save User Message
        res1 = cm.save_message(session_id, user_id, "user", "Hello debug")
        print("Save User Message Result:", res1)
        
        # Save AI Message
        res2 = cm.save_message(session_id, user_id, "ai", "Hello there")
        print("Save AI Message Result:", res2)
        
        # Verify
        messages = cm.get_session_messages(session_id)
        print(f"Retrieved Messages ({len(messages.get('messages', []))}):")
        for m in messages.get('messages', []):
            print(f"- [{m['role']}] {m['content']}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_save_message())

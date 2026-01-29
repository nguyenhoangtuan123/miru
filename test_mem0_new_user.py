from memory_service import get_memory_service
import asyncio
import uuid

async def test_new_user():
    service = get_memory_service()
    
    # Generate a random new user ID
    new_user_id = f"user_{uuid.uuid4().hex[:8]}"
    print(f"Testing with new user: {new_user_id}")
    
    # 1. Try to add a memory
    print("\n--- 1. Adding Memory ---")
    try:
        result = service.add_conversation(
            user_id=new_user_id,
            user_message="Tôi là người dùng mới, tôi thích màu xanh.",
            ai_message="Chào bạn, tôi đã ghi nhớ sở thích của bạn."
        )
        print("Add Result:", result)
    except Exception as e:
        print(f"ERROR Adding: {e}")
        
    # 2. Try to search immediately
    print("\n--- 2. Searching Memory ---")
    try:
        memories = service.search_memories(new_user_id, "thích màu gì")
        print("Search Result:", memories)
    except Exception as e:
        print(f"ERROR Searching: {e}")

if __name__ == "__main__":
    asyncio.run(test_new_user())

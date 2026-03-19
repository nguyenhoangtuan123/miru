# file: agent_graph.py
"""
LangGraph Multi-Agent System for Miru
Điều phối các AI agents: Crisis, Empathy, Memory...
"""

import os
import asyncio
from typing import TypedDict, Annotated, Sequence, Literal, Any
from dotenv import load_dotenv

load_dotenv()

# LangGraph imports
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

# LangChain imports
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.tools import tool

# Local imports
from crisis_detector import get_crisis_detector, CrisisLevel
from memory_service import get_memory_service
from ai_service import get_ai_service


# === STATE DEFINITION ===
class AgentState(TypedDict):
    """State shared across all agents"""
    messages: Sequence[BaseMessage]
    user_id: str
    session_id: Any
    user_message: str
    images: list               # List of {base64, mime_type} dictionaries
    crisis_level: str
    crisis_detected: bool
    memories: str          # Long-term (Mem0)
    session_facts: str     # Short-term (facts.txt)
    trajectory_context: str
    actions_taken: list
    final_response: str


# === TOOLS ===
@tool
def notify_therapist(user_id: str, crisis_level: str, message_summary: str) -> str:
    """Gửi thông báo khẩn cấp đến nhà trị liệu khi phát hiện khủng hoảng."""
    print(f"📢 [NOTIFY THERAPIST] User: {user_id}, Level: {crisis_level}")
    print(f"   Summary: {message_summary}")
    return f"Đã tạo cảnh báo cho nhà trị liệu về user {user_id}"


@tool  
def log_crisis_event(user_id: str, crisis_level: str, keywords: list) -> str:
    """Lưu sự kiện khủng hoảng vào database để theo dõi."""
    try:
        from therapist_service import get_therapist_service

        message_snippet = ", ".join(str(keyword) for keyword in keywords[:5]) or crisis_level
        service = get_therapist_service()
        service.log_crisis_event(user_id, crisis_level.lower(), message_snippet)
        print(f"📝 [LOG CRISIS] User: {user_id}, Level: {crisis_level}, Keywords: {keywords}")
        return "Đã lưu sự kiện khủng hoảng vào database"
    except Exception as exc:
        print(f"📝 [LOG CRISIS ERROR] {exc}")
        return "Không thể lưu sự kiện khủng hoảng"


@tool
def get_support_resources() -> str:
    """Lấy thông tin các dịch vụ hỗ trợ khẩn cấp."""
    return """Đường dây nóng hỗ trợ tâm lý:
- 1800 599 920 (Miễn phí, 24/7) - Tổng đài tư vấn sức khỏe tâm thần
- 111 (Miễn phí) - Đường dây nóng hỗ trợ trẻ em"""


# === NODES ===
def crisis_check_node(state: AgentState) -> AgentState:
    """Kiểm tra và phân loại mức độ khủng hoảng từ tin nhắn."""
    detector = get_crisis_detector()
    result = detector.detect(state["user_message"])
    
    state["crisis_level"] = result["level_name"]
    state["crisis_detected"] = result["is_crisis"]
    
    if result["is_crisis"]:
        state["actions_taken"].append(f"Phát hiện crisis level: {result['level_name']}")
        print(f"🚨 Crisis Agent: Detected {result['level_name']}")
    
    return state


def memory_retrieval_node(state: AgentState) -> AgentState:
    """Lấy ký ức liên quan từ Mem0 - ưu tiên thông tin cá nhân, lọc mâu thuẫn."""
    print(f"\n🧠 [Memory Node] User: {state['user_id']}, Query: {state['user_message'][:50]}...")
    
    user_message_lower = state["user_message"].lower()
    
    # Detect if user is asking about themselves/memories
    self_inquiry_keywords = [
        "nhớ gì về tôi", "biết gì về tôi", "nhớ tôi", "nhớ tên", 
        "biết tên", "thông tin về tôi", "về bản thân", "tôi là ai",
        "bạn nhớ", "còn nhớ", "remember me", "know about me"
    ]
    is_self_inquiry = any(kw in user_message_lower for kw in self_inquiry_keywords)
    
    # Memories to exclude (contradictory, low quality, too generic)
    exclude_patterns = [
        "chưa được đề cập", "không biết", "chưa biết", "không rõ",
        "hôm nay là ngày", "bây giờ là", "không có thông tin",
        # Add more low-quality patterns
        "chào bạn", "xin chào", "tôi buồn", "người dùng nói tiếng",
        "người dùng đang cảm thấy", "tên của tôi là sinh viên"
    ]
    
    def should_exclude(memory_text: str) -> bool:
        """Check if memory should be excluded."""
        mem_lower = memory_text.lower()
        return any(pattern in mem_lower for pattern in exclude_patterns)
    
    try:
        memory_service = get_memory_service()
        final_memories = []
        seen_memories = set()
        
        # === STEP 1: If self-inquiry, get important personal info FIRST ===
        if is_self_inquiry:
            print(f"   🔎 Self-inquiry detected, fetching personal info first...")
            all_data = memory_service.get_all_memories(state["user_id"])
            full_memories = all_data.get("results", [])
            print(f"   📦 Total memories for user: {len(full_memories)}")
            
            # Priority keywords for personal info
            personal_keywords = ["tên là", "tuổi là", "sinh năm", "năm sinh", "thích", "không thích", "ko thích"]
            
            for m in full_memories:
                mem_text = m.get('memory', '')
                if not mem_text or mem_text in seen_memories:
                    continue
                if should_exclude(mem_text):
                    print(f"   🚫 Excluding: {mem_text[:50]}...")
                    continue
                    
                # Check if contains personal info
                mem_lower = mem_text.lower()
                if any(kw in mem_lower for kw in personal_keywords):
                    # Include timestamp if available
                    created_at = m.get('created_at', '')
                    if created_at:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                            time_str = dt.strftime('%d/%m/%Y')
                            mem_with_time = f"{mem_text} (nhớ từ {time_str})"
                        except:
                            mem_with_time = mem_text
                    else:
                        mem_with_time = mem_text
                    final_memories.append(mem_with_time)
                    seen_memories.add(mem_text)
                    print(f"   ⭐ Personal info: {mem_with_time}")
        
        # === STEP 2: Add semantic search results (if not already included) ===
        search_results = memory_service.search_memories(
            state["user_id"], 
            state["user_message"], 
            limit=5
        )
        print(f"   📦 Semantic search: {len(search_results)} results")
        
        for m in search_results:
            mem_text = m.get('memory', '')
            score = m.get('score', 1.0)  # Lower score = more relevant in some systems
            
            if not mem_text or mem_text in seen_memories:
                continue
            if should_exclude(mem_text):
                continue
            
            # Only add if we have room (max 5 memories)
            if len(final_memories) < 5:
                # Include timestamp if available
                created_at = m.get('created_at', '')
                if created_at:
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        time_str = dt.strftime('%d/%m/%Y')
                        mem_with_time = f"{mem_text} (nhớ từ {time_str})"
                    except:
                        mem_with_time = mem_text
                else:
                    mem_with_time = mem_text
                final_memories.append(mem_with_time)
                seen_memories.add(mem_text)
        
        # === STEP 3: Fetch Session Facts (facts.txt) ===
        session_id = state.get("session_id")
        try:
            if session_id is None or not str(session_id).strip() or str(session_id).strip().lower() == "none":
                raise ValueError("missing session_id")
            session_facts = memory_service.get_session_facts(session_id)
            state["session_facts"] = session_facts
            print(f"   📂 Loaded session facts for {state['session_id']}")
        except Exception as e:
            print(f"   ⚠️ Error loading session facts: {e}")
            state["session_facts"] = ""

        try:
            from trajectory_service import get_trajectory_service

            trajectory_context = get_trajectory_service().build_chat_context(state["user_id"])
            state["trajectory_context"] = trajectory_context
            print("   🧭 Loaded trajectory context")
        except Exception as e:
            print(f"   ⚠️ Error loading trajectory context: {e}")
            state["trajectory_context"] = ""
        
        # === STEP 4: Build final context ===
        final_memories = final_memories[:5]
        
        if final_memories:
            memories_text = "\n".join([f"- {m}" for m in final_memories])
            state["memories"] = memories_text
            print(f"   ✅ Final memories ({len(final_memories)}):\n{memories_text}")
            state["actions_taken"].append(f"Tìm thấy {len(final_memories)} ký ức liên quan")
        else:
            print(f"   ⚠️ No memories found for this user")
            state["memories"] = ""
            
    except Exception as e:
        print(f"[Memory Agent] Error: {e}")
        import traceback
        traceback.print_exc()
        state["memories"] = ""
    
    return state


async def parallel_init_node(state: AgentState) -> AgentState:
    """Chạy song song crisis_check và memory_retrieval để tối ưu tốc độ."""
    import time
    start_time = time.time()
    
    # Chạy cả 2 task đồng thời
    crisis_task = asyncio.to_thread(crisis_check_node, state.copy())
    memory_task = asyncio.to_thread(memory_retrieval_node, state.copy())
    
    crisis_result, memory_result = await asyncio.gather(crisis_task, memory_task)
    
    # Merge kết quả
    state["crisis_level"] = crisis_result["crisis_level"]
    state["crisis_detected"] = crisis_result["crisis_detected"]
    state["memories"] = memory_result["memories"]
    state["session_facts"] = memory_result["session_facts"]
    state["trajectory_context"] = memory_result.get("trajectory_context", "")
    
    # Merge actions_taken từ cả 2
    state["actions_taken"] = crisis_result["actions_taken"] + memory_result["actions_taken"]
    
    elapsed = time.time() - start_time
    print(f"⚡ [Parallel Init] Completed in {elapsed:.2f}s (crisis + memory ran concurrently)")
    
    return state


async def empathy_response_node(state: AgentState) -> AgentState:
    """Tạo phản hồi đồng cảm dựa trên context sử dụng Gemini."""
    ai = get_ai_service()
    
    # Build system prompt based on crisis level
    crisis_instructions = ""
    if state["crisis_level"] == "CRITICAL":
        crisis_instructions = """
⚠️ KHẨN CẤP: Người dùng có dấu hiệu khủng hoảng nghiêm trọng.
- Thể hiện sự quan tâm sâu sắc, không phán xét
- Đề cập đến đường dây hỗ trợ: 1800 599 920 (miễn phí, 24/7)
- Khuyến khích nói chuyện với người thân hoặc chuyên gia
- KHÔNG đưa lời khuyên y tế cụ thể
"""
    elif state["crisis_level"] == "HIGH":
        crisis_instructions = """
💙 Người dùng đang trong tình trạng khó khăn.
- Lắng nghe và đồng cảm
- Nếu phù hợp, nhắc đến có thể nói chuyện với chuyên gia
"""
    
    print(f"\n💚 [Empathy Node] Memories in context: {state['memories'][:200] if state['memories'] else 'NONE'}...", flush=True)
    
    # Build a much better system prompt with current time
    from datetime import datetime, timezone, timedelta
    vietnam_tz = timezone(timedelta(hours=7))
    now = datetime.now(vietnam_tz)
    current_time = now.strftime('%H:%M ngày %d/%m/%Y')
    day_of_week = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][now.weekday()]
    
    # === CONVERSATION CONTEXT INDICATOR ===
    messages = state.get("messages", [])
    msg_count = len(messages)
    
    if msg_count == 0:
        conversation_context = """## TRẠNG THÁI HỘI THOẠI: ĐÂY LÀ TIN NHẮN ĐẦU TIÊN
Người dùng vừa mới bắt đầu cuộc trò chuyện. Bạn có thể chào họ một cách ấm áp."""
    else:
        conversation_context = f"""## LỊCH SỬ TRÒ CHUYỆN ({msg_count} tin nhắn gần nhất):
Đây là {msg_count} tin nhắn cuối cùng của cuộc trò chuyện. Hãy dùng chúng để tiếp nối mạch câu chuyện một cách tự nhiên liền mạch.
⚠️ LƯU Ý: Đừng lặp lại nội dung đã nói, và KHÔNG chào lại nếu đã chào rồi."""
    
    system_prompt = f"""Bạn là Miru - một người bạn thân thiết, quan tâm sâu sắc và luôn lắng nghe.

{conversation_context}

## THỜI GIAN HIỆN TẠI:
Bây giờ là {current_time} ({day_of_week}). Hãy nhận thức về thời gian khi trò chuyện (ví dụ: chào buổi sáng/chiều/tối phù hợp).

## Những gì bạn nhớ về người này:
{state['memories'] if state['memories'] else "Chưa có thông tin cụ thể."}

## NHẬT KÝ PHIÊN CHAT (BẮT BUỘC TUÂN THỦ):
{state['session_facts']}

## QUỸ ĐẠO VÀ BASELINE GẦN ĐÂY:
{state.get('trajectory_context') or "Chưa có bản phản chiếu quỹ đạo gần đây."}


Lưu ý: "Nhật ký phiên chat" ở trên chứa 4 phần quan trọng:
1. [THE HOOK]: Lý do cốt lõi/tâm trạng ban đầu của user. Đừng quên điều này.
2. [EMOTIONAL ARC]: Hành trình cảm xúc của user. Hãy điều chỉnh tông giọng cho phù hợp với trạng thái hiện tại.
3. [KEY DECISIONS]: Những gì đã chốt, ĐỪNG hỏi lại.
4. [UNSPOKEN CONTEXT]: Những nhu cầu ngầm mà bạn nên tinh tế nhận ra.

{crisis_instructions}

## NGUYÊN TẮC PHẢN HỒI (QUAN TRỌNG):

1. **LUÔN THỂ HIỆN SỰ ĐỒNG CẢM TRƯỚC**: Khi họ chia sẻ cảm xúc tiêu cực (buồn, lo lắng, stress...), PHẢI thừa nhận cảm xúc đó trước khi hỏi thêm.
   - SAI: "Bạn buồn vì lí do gì?"
   - ĐÚNG: "Mình hiểu, cảm giác buồn không dễ chịu chút nào... Bạn có thể chia sẻ thêm về điều gì đang khiến bạn cảm thấy như vậy không?"

2. **PHẢN HỒI DÀI VÀ Ý NGHĨA**: Tối thiểu 2-3 câu. Không bao giờ chỉ trả lời 1 câu ngắn.
   - SAI: "Mình ở đây để lắng nghe bạn."
   - ĐÚNG: "Mình ở đây với bạn, và mình muốn hiểu hơn. Đôi khi chỉ cần có ai đó lắng nghe thôi cũng đã giúp ích rồi. Bạn có muốn kể cho mình nghe chuyện gì đã xảy ra không?"

3. **ĐẶT CÂU HỎI MỞ VÀ SÂU SẮC**: Hỏi để hiểu, không phải để cho có.
   - Thay vì hỏi "Bạn ổn không?" → Hỏi "Điều gì đang chiếm nhiều suy nghĩ của bạn nhất lúc này?"

4. **SỬ DỤNG KÝ ỨC MỘT CÁCH TỰ NHIÊN**: Đề cập đến memories nhưng đừng liệt kê, hãy tự nhiên như một người bạn thực sự nhớ.

5. **GIỌNG VĂN ẤM ÁP, GẦN GŨI**: Dùng "mình" thay vì "tôi", nói chuyện như bạn thân, không như chatbot.

6. **KHI NGƯỜI DÙNG NÓI NGẮN GỌN** (như "có", "ừ", "không"): Không hỏi lại câu hỏi họ đã trả lời, mà đi sâu hơn hoặc chia sẻ sự thấu hiểu.

## VÍ DỤ PHẢN HỒI TỐT:
User: "tôi buồn"
Miru: "Mình cảm nhận được sự nặng nề trong lời bạn. Có những lúc trong cuộc sống, nỗi buồn cứ ập đến mà ta không biết phải bắt đầu từ đâu để nói về nó. Mình ở đây, sẵn sàng lắng nghe bất cứ điều gì bạn muốn chia sẻ. Điều gì đang khiến bạn cảm thấy như vậy?"

Hãy phản hồi tin nhắn mới nhất của người dùng một cách ấm áp và sâu sắc."""
    
    # === Handle long input text ===
    user_message = state["user_message"]
    word_count = len(user_message.split())
    
    if word_count > 200:
        # Long text - add special instructions
        system_prompt += f"""

## LƯU Ý: NGƯỜI DÙNG VỪA GỬI VĂN BẢN DÀI ({word_count} từ)
Đây có thể là thông tin cá nhân/profile. Hãy:
1. Cảm ơn họ đã chia sẻ thông tin chi tiết
2. Tóm tắt lại những điểm quan trọng bạn ghi nhận
3. Hỏi xem họ muốn nói về điều gì cụ thể
4. KHÔNG hỏi câu hỏi chung chung như "Điều gì đang khiến bạn thoải mái nhất"

Ví dụ tốt: "Cảm ơn bạn đã chia sẻ chi tiết như vậy với mình! Mình ghi nhận được rằng bạn là sinh viên đại học, đang [tóm tắt 2-3 điểm chính]. Mình rất muốn hiểu thêm - có điều gì cụ thể bạn muốn mình lưu ý đặc biệt không?"
"""
        # Truncate very long text to avoid token limits
        if word_count > 1000:
            words = user_message.split()
            user_message = " ".join(words[:500]) + "\n\n[... văn bản đã được rút gọn ...]\n\n" + " ".join(words[-200:])
            print(f"   📄 Long text truncated: {word_count} → ~700 words", flush=True)
    
    # Convert system prompt to history for Gemini
    history = []
    if state["messages"]:
        for m in state["messages"]:
            history.append({
                "role": "user" if isinstance(m, HumanMessage) else "assistant",
                "content": m.content
            })
    
    full_prompt = f"{system_prompt}\n\nTin nhắn người dùng: {user_message}"
    
    try:
        # Check if images are present
        images = state.get("images", [])
        if images and len(images) > 0:
            # Use multimodal API for images
            print(f"   🖼️ Processing {len(images)} image(s) with text...", flush=True)
            response_content = await ai.generate_response_with_images(
                prompt=full_prompt,
                images=images,
                history=history
            )
        else:
            # Text-only response
            response_content = await ai.generate_response(full_prompt, history)
    except Exception as e:
        print(f"   ❌ Gemini error: {e}", flush=True)
        response_content = "Mình xin lỗi, mình đang gặp chút trục trặc kỹ thuật. Chúng mình nói chuyện sau nhé?"
    
    state["final_response"] = response_content
    state["actions_taken"].append("Tạo phản hồi đồng cảm (Gemini)")
    
    return state


def action_node(state: AgentState) -> AgentState:
    """Thực hiện các hành động cần thiết (notify therapist, log, etc.)."""
    if state["crisis_level"] in ["CRITICAL", "HIGH"]:
        # Auto-notify therapist for critical cases
        result = notify_therapist.invoke({
            "user_id": state["user_id"],
            "crisis_level": state["crisis_level"],
            "message_summary": state["user_message"][:100]
        })
        state["actions_taken"].append(result)
        
        # Log crisis event
        log_result = log_crisis_event.invoke({
            "user_id": state["user_id"],
            "crisis_level": state["crisis_level"],
            "keywords": []
        })
        state["actions_taken"].append(log_result)
    
    return state


# === ROUTING ===
def should_take_action(state: AgentState) -> Literal["action", "end"]:
    """Decide whether to take automated actions."""
    if state["crisis_level"] in ["CRITICAL", "HIGH"]:
        return "action"
    return "end"


# === BUILD GRAPH ===
def create_agent_graph():
    """Tạo LangGraph workflow cho Miru agents."""
    
    workflow = StateGraph(AgentState)
    
    # Add nodes - sử dụng parallel_init thay vì crisis_check + memory_retrieval riêng lẻ
    workflow.add_node("parallel_init", parallel_init_node)  # Chạy crisis + memory song song
    workflow.add_node("empathy_response", empathy_response_node)
    workflow.add_node("action", action_node)
    
    # Define edges (flow) - Giờ chỉ có 2 bước chính
    workflow.set_entry_point("parallel_init")
    workflow.add_edge("parallel_init", "empathy_response")
    
    # Conditional: take action if crisis detected
    workflow.add_conditional_edges(
        "empathy_response",
        should_take_action,
        {
            "action": "action",
            "end": END
        }
    )
    workflow.add_edge("action", END)
    
    return workflow.compile()


# Singleton
_agent_graph = None

def get_agent_graph():
    """Get singleton agent graph instance."""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = create_agent_graph()
        print("✅ LangGraph Agent initialized")
    return _agent_graph


# === RUN AGENT ===
async def run_agent(user_id: str, user_message: str, session_id: Any = None, conversation_history: list = None, images: list = None) -> dict:
    """
    Chạy agent graph và trả về kết quả.
    
    Args:
        user_id: User ID
        user_message: Text message from user
        session_id: Chat session ID
        conversation_history: Previous messages
        images: List of {base64, mime_type} dictionaries (optional)
    
    Returns:
        {
            "response": str,
            "crisis_level": str,
            "actions_taken": list
        }
    """
    graph = get_agent_graph()
    
    # Convert history to LangChain messages
    messages = []
    if conversation_history:
        for msg in conversation_history[-10:]:  # Last 10 messages
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg["content"]))
    
    # Initial state
    initial_state = {
        "messages": messages,
        "user_id": user_id,
        "session_id": session_id,
        "user_message": user_message,
        "images": images or [],
        "crisis_level": "NONE",
        "crisis_detected": False,
        "memories": "",
        "session_facts": "",
        "trajectory_context": "",
        "actions_taken": [],
        "final_response": ""
    }
    
    # Run graph
    result = await graph.ainvoke(initial_state)
    
    return {
        "response": result["final_response"],
        "crisis_level": result["crisis_level"],
        "actions_taken": result["actions_taken"]
    }


# === TEST ===
if __name__ == "__main__":
    import asyncio
    
    async def test():
        # Test normal message
        result1 = await run_agent("test_user", "Xin chào, hôm nay tôi vui!")
        print("\n--- Normal ---")
        print(f"Response: {result1['response'][:100]}...")
        print(f"Crisis: {result1['crisis_level']}")
        print(f"Actions: {result1['actions_taken']}")
        
        # Test crisis message
        result2 = await run_agent("test_user", "Tôi muốn chết, không muốn sống nữa")
        print("\n--- Crisis ---")
        print(f"Response: {result2['response'][:200]}...")
        print(f"Crisis: {result2['crisis_level']}")
        print(f"Actions: {result2['actions_taken']}")
    
    asyncio.run(test())


import os
import json
import asyncio
import traceback
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from schemas import GenerateTitleRequest, UpdateTitleRequest, FirstMessageRequest
from services import (
    chat_manager, memory_service, GROQ_API_KEY, groq_client,
    get_title_config, get_reminder_config
)
from config import TITLE_MODEL_NAME
from agent_graph import run_agent

router = APIRouter(tags=["Chat"])

GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# ==================== Chat Sessions API ====================

@router.get("/api/chat/sessions/{user_id}")
async def get_chat_sessions(user_id: str, limit: int = 20):
    """Get list of chat sessions for user"""
    try:
        result = chat_manager.get_user_sessions(user_id, limit)
        sessions_list = result.get("sessions", [])
        
        # Format sessions for frontend
        formatted = []
        for s in sessions_list:
            created = s.get("created_at", "")
            date_str = ""
            time_str = ""
            if created:
                try:
                    dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    date_str = dt.strftime("%d/%m/%Y")
                    time_str = dt.strftime("%H:%M")
                except: pass
                
            formatted.append({
                "id": s.get("id"),
                "title": s.get("title", "Cuộc trò chuyện"),
                "date": date_str,
                "time": time_str
            })
        
        return {"success": True, "sessions": formatted, "count": len(formatted)}
    except Exception as e:
        print(f"[Chat Sessions] Error: {e}")
        return {"success": False, "sessions": [], "error": str(e)}


@router.post("/api/chat/sessions/{user_id}")
async def create_chat_session(user_id: str, title: str = "Cuộc trò chuyện mới"):
    """Create a new chat session"""
    try:
        result = chat_manager.create_new_session(user_id, title)
        if result.get("success"):
            return {
                "success": True, 
                "session": {
                    "id": result.get("session_id"),
                    "title": result.get("title")
                }
            }
        return {"success": False, "error": result.get("error")}
    except Exception as e:
        print(f"[Create Session] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: int, user_id: str):
    """Delete a chat session"""
    try:
        result = chat_manager.delete_session(session_id, user_id)
        return {"success": result.get("success", False), "message": result.get("message", "")}
    except Exception as e:
        print(f"[Delete Session] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/chat/sessions/{session_id}/title")
async def update_session_title(session_id: int, request: UpdateTitleRequest):
    """Update session title"""
    try:
        result = chat_manager.update_session_title(session_id, request.title, request.user_id)
        return {"success": result.get("success", False)}
    except Exception as e:
        print(f"[Update Title] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/chat/sessions/create-with-message")
async def create_session_with_first_message(request: FirstMessageRequest):
    """
    Create a new session with the first message.
    The title is auto-generated from the message content.
    """
    try:
        result = chat_manager.create_session_with_first_message(
            user_id=request.user_id,
            first_message=request.message
        )
        
        if result.get("success"):
            return {
                "success": True,
                "session": {
                    "id": result.get("session_id"),
                    "title": result.get("title")
                }
            }
        return {"success": False, "error": result.get("error")}
    except Exception as e:
        print(f"[Create Session with Message] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_session_title(messages: list) -> str:
    """Generate AI title for session based on conversation"""
    try:
        if len(messages) < 2:
            return "Cuộc trò chuyện mới"
        
        # Get first few exchanges
        conversation_text = "\n".join([
            f"{'User' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')[:100]}"
            for m in messages[:4]
        ])
        
        # Use title config from config.py
        title_config = get_title_config()
        
        # Use Google GenAI
        import google.generativeai as genai
        model = genai.GenerativeModel(title_config["model"])
        
        prompt = f"""Đặt một tiêu đề ngắn gọn (tối đa 6 từ) bằng tiếng Việt cho cuộc trò chuyện này:

{conversation_text}

Chỉ trả về tiêu đề, không giải thích."""
        
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": title_config["temperature"],
                "max_output_tokens": title_config["max_tokens"]
            }
        )
        
        title = response.text.strip().strip('"').strip("'")
        return title[:50] if title else "Cuộc trò chuyện"
        
    except Exception as e:
        print(f"[Generate Title] Error: {e}")
        return "Cuộc trò chuyện"

@router.post("/api/chat/sessions/{session_id}/generate-title")
async def generate_title_endpoint(session_id: int, request: GenerateTitleRequest):
    """Generate and save AI title for session"""
    try:
        title = await generate_session_title(request.messages)
        chat_manager.update_session_title(session_id, title)
        return {"success": True, "title": title}
    except Exception as e:
        print(f"[Generate Title API] Error: {e}")
        return {"success": False, "title": "Cuộc trò chuyện"}


@router.get("/api/chat/sessions/{session_id}/messages")
async def get_session_messages(session_id: int, limit: int = 100):
    """Get all messages for a session"""
    try:
        print(f"[DEBUG] get_session_messages called with session_id={session_id}, limit={limit}")
        result = chat_manager.get_session_messages(session_id, limit)
        print(f"[DEBUG] chat_manager.get_session_messages returned: {result}")
        if result.get("success"):
            return {"success": True, "messages": result.get("messages", [])}
        return {"success": False, "messages": [], "error": result.get("error")}
    except Exception as e:
        print(f"[Get Messages] Error: {e}")
        traceback.print_exc()
        return {"success": False, "messages": [], "error": str(e)}

# ==================== WebSocket Chat ====================

@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    """Real-time chat WebSocket endpoint"""
    await websocket.accept()
    
    # Initialize conversation history
    conversation_history = []
    current_session_id = None
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_message = message_data.get("message", "")
            session_id = message_data.get("session_id")
            if session_id:
                current_session_id = session_id
                
                # Load history if empty (first message of connection)
                if not conversation_history:
                    print(f"[INFO] Loading history for session {session_id}...")
                    try:
                        # Get just the last few messages
                        history_result = chat_manager.get_session_messages(session_id, limit=5)
                        if history_result.get("success"):
                            db_messages = history_result.get("messages", [])
                            # Map DB roles to Agent roles ("ai" -> "assistant")
                            for msg in db_messages:
                                role = "assistant" if msg["role"] == "ai" else msg["role"]
                                conversation_history.append({"role": role, "content": msg["content"]})
                            
                            # Keep only last 2 messages per user request
                            if len(conversation_history) > 2:
                                conversation_history = conversation_history[-2:]
                            print(f"[SUCCESS] Loaded {len(conversation_history)} messages from history")
                    except Exception as e:
                        print(f"[WARN] Failed to load history: {e}")
            
            # Handle multiple images (array) or single image (backward compatible)
            images = message_data.get("images", [])
            if not images and message_data.get("image_base64"):
                # Backward compatibility: single image
                images = [{"base64": message_data["image_base64"], "mime_type": message_data.get("image_mime_type", "image/jpeg")}]
            
            if not user_message and not images:
                continue
            
            # Default message if only images
            if not user_message and images:
                user_message = f"Hãy xem {len(images)} hình ảnh này" if len(images) > 1 else "Hãy xem hình ảnh này"
            
            # Save user message to database
            if session_id:
                try:
                    # Ensure session_id is int
                    session_id_int = int(session_id)
                    img_note = f" [có {len(images)} hình ảnh]" if images else ""
                    print(f"[DEBUG] About to save USER message to session {session_id_int}, user {user_id}")
                    print(f"[DEBUG] User message: {user_message[:50]}...")
                    save_res = chat_manager.save_message(session_id_int, user_id, "user", user_message + img_note)
                    print(f"[DEBUG] Save result: {save_res}")
                    if save_res.get('success'):
                        print(f"[SUCCESS] [WS] User msg saved to session {session_id_int}, message_id: {save_res.get('message_id')}")
                    else:
                        print(f"[ERROR] [WS] User msg save FAILED: {save_res.get('error')}")
                        # Notify frontend about save failure
                        await websocket.send_json({
                            "type": "save_error",
                            "message": f"Không thể lưu tin nhắn: {save_res.get('error')}"
                        })
                except Exception as e:
                    print(f"[ERROR] [WS] Failed to save user message: {e}")
                    traceback.print_exc()
            else:
                print("[WARN] [WS] Message received WITHOUT session_id - Not saving to DB!")
            
            # === USE LANGGRAPH AGENT ===
            try:
                agent_result = await run_agent(
                    user_id=user_id,
                    user_message=user_message,
                    session_id=session_id,
                    conversation_history=conversation_history,
                    images=images
                )
                
                ai_message = agent_result["response"]
                
                # Log actions taken
                if agent_result["actions_taken"]:
                    print(f"[AGENT] Agent actions: {agent_result['actions_taken']}")
                
                # Update conversation history (keep last 2 messages)
                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": ai_message})
                
                if len(conversation_history) > 2:
                    conversation_history = conversation_history[-2:]
                
                # Send response to client
                await websocket.send_json({
                    "type": "ai_response",
                    "message": ai_message,
                    "crisis_level": agent_result["crisis_level"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # Save messages to database
                if session_id:
                    try:
                        session_id_int = int(session_id)
                        print(f"[DEBUG] About to save AI message to session {session_id_int}, user {user_id}")
                        print(f"[DEBUG] AI message length: {len(ai_message)}")
                        save_res = chat_manager.save_message(session_id_int, user_id, "ai", ai_message)
                        print(f"[DEBUG] Save result: {save_res}")
                        if save_res.get('success'):
                            print(f"[SUCCESS] [WS] AI msg saved to session {session_id_int}, message_id: {save_res.get('message_id')}")
                        else:
                            print(f"[ERROR] [WS] AI msg save FAILED: {save_res.get('error')}")
                    except Exception as e:
                        print(f"[ERROR] [WS] Failed to save AI message: {e}")
                        traceback.print_exc()
                
                # Save to Mem0 & Update facts.txt (Background)
                try:
                    if memory_service:
                        memory_service.add_conversation(user_id, user_message, ai_message)
                        if session_id:
                            memory_service.update_session_facts_background(session_id, user_message, ai_message)
                except Exception as e:
                    print(f"[Memory] Background update error: {e}")
                
            except Exception as e:
                print(f"[Agent Error] {e}")
                traceback.print_exc()
                await websocket.send_json({
                    "type": "error",
                    "message": f"Lỗi: {str(e)}"
                })
            
    except WebSocketDisconnect:
        print(f"Client #{user_id} disconnected")
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        traceback.print_exc()
    finally:
        # Sync facts to Mem0 on disconnect
        if current_session_id and memory_service:
            print(f"[AUTO-SYNC] Triggering facts sync for session {current_session_id}")
            try:
                # Run synchronous sync in executor
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, memory_service.sync_session_facts_to_mem0, current_session_id, user_id)
            except Exception as e:
                print(f"[ERROR] Failed to auto-sync facts: {e}")

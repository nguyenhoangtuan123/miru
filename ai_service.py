# file: ai_service.py
"""
AI Service - Tích hợp Google Gemini API (New SDK google.genai)
Dùng cho cả Chat chính và trích xuất Facts.
"""

from settings import settings
from config import MODE_THINKING, MODEL_NAME, TEMPERATURE, MAX_TOKENS, SUMMARIZER_MODEL_NAME
import logging
import sys

# Configure logging to ALWAYS output to console AND file
logger = logging.getLogger("ai_service")
logger.setLevel(logging.DEBUG)

# Create console handler with explicit stdout
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# Also add file handler as backup
file_handler = logging.FileHandler("token_usage.log", encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Prevent duplicate logs
logger.propagate = False

class GoogleLLMIntegration:
    """Tích hợp Google Gemini API (New SDK google.genai)"""
    
    def __init__(self, model_name: str = MODEL_NAME, is_thinking: bool = True):
        """Khởi tạo Google Gemini API"""
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise ImportError("Vui lòng cài đặt thư mục SDK mới: pip install google-genai")
        
        # Lấy API key từ biến môi trường
        api_key = settings.GOOGLE_API_KEY
        
        if not api_key:
            raise ValueError(
                "GOOGLE_API_KEY không được tìm thấy trong cấu hình. "
                "Vui lòng thêm vào file .env hoặc biến môi trường."
            )
        
        # Cấu hình Client
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        
        # Cấu hình GenerateContentConfig
        if is_thinking:
            # Dùng mẫu config Thinking
            self.config = types.GenerateContentConfig(
                temperature=TEMPERATURE,
                max_output_tokens=MAX_TOKENS,
                thinking_config=types.ThinkingConfig(thinking_level=MODE_THINKING)
            )
        else:
            # Dùng config mặc định (thường cho Summarizer)
            self.config = types.GenerateContentConfig(
                temperature=0.3, # Thường thấp hơn cho tóm tắt
                max_output_tokens=1024
            )

    async def generate_response(self, prompt: str, history: list = None):
        """Sinh phản hồi từ Gemini"""
        try:
            logger.info(f"[{self.model_name}] Generating response...")
            
            contents = []
            if history:
                for msg in history:
                    contents.append({
                        "role": "user" if msg["role"] == "user" else "model",
                        "parts": [{"text": msg["content"]}]
                    })
            
            contents.append({"role": "user", "parts": [{"text": prompt}]})
            
            # Using synchronous call (blocking but reliable for now)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=self.config
            )
            
            # In thông tin Token Usage ra Terminal
            try:
                if hasattr(response, 'usage_metadata') and response.usage_metadata:
                    usage = response.usage_metadata
                    prompt_tokens = usage.prompt_token_count
                    candidates_tokens = usage.candidates_token_count or 0
                    total_tokens = usage.total_token_count
                    
                    prefix = "🧠 [CHAT]" if self.model_name == MODEL_NAME else "📝 [SUMMARIZER]"
                    
                    logger.info(f"{prefix} Token Usage ({self.model_name}): Input={prompt_tokens}, Output={candidates_tokens}, Total={total_tokens}")
                else:
                    logger.warning(f"No usage_metadata in response for {self.model_name}")
            except Exception as e:
                logger.warning(f"Failed to print token usage: {e}")
            
            return response.text
        except Exception as e:
            logger.error(f"Error generating Gemini ({self.model_name}) response: {e}")
            return f"Xin lỗi, mình gặp lỗi kỹ thuật: {str(e)}"

    async def generate_response_with_image(self, prompt: str, image_base64: str, mime_type: str = "image/jpeg", history: list = None):
        """Sinh phản hồi từ Gemini với hình ảnh (multimodal)"""
        import base64
        try:
            logger.info(f"[{self.model_name}] Generating multimodal response with image...")
            
            contents = []
            if history:
                for msg in history:
                    contents.append({
                        "role": "user" if msg["role"] == "user" else "model",
                        "parts": [{"text": msg["content"]}]
                    })
            
            # Build multimodal content with image and text
            user_parts = []
            
            # Add image part
            if image_base64:
                # Remove data URL prefix if present
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]
                
                user_parts.append({
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": image_base64
                    }
                })
            
            # Add text part
            user_parts.append({"text": prompt or "Hãy mô tả hình ảnh này cho mình."})
            
            contents.append({"role": "user", "parts": user_parts})
            
            # Using synchronous call
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=self.config
            )
            
            # Log token usage
            try:
                if hasattr(response, 'usage_metadata') and response.usage_metadata:
                    usage = response.usage_metadata
                    logger.info(f"🖼️ [MULTIMODAL] Token Usage ({self.model_name}): Input={usage.prompt_token_count}, Output={usage.candidates_token_count or 0}, Total={usage.total_token_count}")
            except Exception as e:
                logger.warning(f"Failed to print token usage: {e}")
            
            return response.text
        except Exception as e:
            logger.error(f"Error generating multimodal response: {e}")
            return f"Xin lỗi, mình không thể xử lý hình ảnh này: {str(e)}"

    async def generate_response_with_images(self, prompt: str, images: list, history: list = None):
        """Sinh phản hồi từ Gemini với nhiều hình ảnh (multimodal)
        
        Args:
            prompt: Text prompt
            images: List of {base64, mime_type} dictionaries
            history: Conversation history
        """
        try:
            logger.info(f"[{self.model_name}] Generating multimodal response with {len(images)} image(s)...")
            
            contents = []
            if history:
                for msg in history:
                    contents.append({
                        "role": "user" if msg["role"] == "user" else "model",
                        "parts": [{"text": msg["content"]}]
                    })
            
            # Build multimodal content with multiple images and text
            user_parts = []
            
            # Add all image parts
            for img in images:
                image_base64 = img.get("base64", "")
                mime_type = img.get("mime_type", "image/jpeg")
                
                # Remove data URL prefix if present
                if "," in image_base64:
                    image_base64 = image_base64.split(",")[1]
                
                if image_base64:
                    user_parts.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_base64
                        }
                    })
            
            # Add text part at the end
            user_parts.append({"text": prompt or f"Hãy mô tả {len(images)} hình ảnh này cho mình."})
            
            contents.append({"role": "user", "parts": user_parts})
            
            # Using synchronous call
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=self.config
            )
            
            # Log token usage
            try:
                if hasattr(response, 'usage_metadata') and response.usage_metadata:
                    usage = response.usage_metadata
                    logger.info(f"🖼️ [MULTIMODAL x{len(images)}] Token Usage ({self.model_name}): Input={usage.prompt_token_count}, Output={usage.candidates_token_count or 0}, Total={usage.total_token_count}")
            except Exception as e:
                logger.warning(f"Failed to print token usage: {e}")
            
            return response.text
        except Exception as e:
            logger.error(f"Error generating multimodal response with {len(images)} images: {e}")
            return f"Xin lỗi, mình không thể xử lý hình ảnh này: {str(e)}"

# Singleton cho Chat chính
_ai_instance = None
# Singleton cho Summarizer
_summarizer_instance = None

def get_ai_service():
    global _ai_instance
    if _ai_instance is None:
        _ai_instance = GoogleLLMIntegration(model_name=MODEL_NAME, is_thinking=True)
    return _ai_instance

def get_summarizer_service():
    global _summarizer_instance
    if _summarizer_instance is None:
        _summarizer_instance = GoogleLLMIntegration(model_name=SUMMARIZER_MODEL_NAME, is_thinking=False)
    return _summarizer_instance

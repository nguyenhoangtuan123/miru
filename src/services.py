
import os
from dotenv import load_dotenv
from config import (
    CHAT_MODEL_NAME, CHAT_MODEL_TEMPERATURE, CHAT_MODEL_MAX_TOKENS,
    SUMMARIZER_MODEL_NAME, SUMMARIZER_TEMPERATURE, SUMMARIZER_MAX_TOKENS,
    MEM0_MODEL_NAME, MEM0_TEMPERATURE, MEM0_MAX_TOKENS,
    REMINDER_MODEL_NAME, REMINDER_TEMPERATURE, REMINDER_MAX_TOKENS,
    CRISIS_MODEL_NAME, CRISIS_TEMPERATURE, CRISIS_MAX_TOKENS,
    TITLE_MODEL_NAME, TITLE_TEMPERATURE, TITLE_MAX_TOKENS
)
from database import DatabaseManager
from journal_db import JournalManager
from auth_manager import AuthManager
from chat_manager import ChatManager
from memory_service import get_memory_service
from crisis_detector import get_crisis_detector
import google.generativeai as genai
from groq import Groq

# Load env
load_dotenv()

# Initialize Database
db_manager = DatabaseManager()

# Initialize Managers
auth_manager = AuthManager()
journal_manager = JournalManager()
chat_manager = ChatManager()

# Initialize AI Services
try:
    memory_service = get_memory_service()
except Exception as e:
    print(f"[WARN] Memory service initialization failed: {e}")
    memory_service = None

crisis_detector = get_crisis_detector()

# Configure GenAI
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# Configure Groq
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip().strip('"').strip("'")
if GROQ_API_KEY and GROQ_API_KEY.startswith("GROQ_API_KEY="):
    GROQ_API_KEY = GROQ_API_KEY.split("=", 1)[1].strip().strip('"').strip("'")

groq_client = None
if GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        print(f"[WARN] Groq initialization failed: {e}")

# MCP Server URL
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://127.0.0.1:8020/sse")


# ==================== MODEL HELPER FUNCTIONS ====================

def get_chat_model_config():
    """Lấy cấu hình model cho chat chính"""
    return {
        "model": CHAT_MODEL_NAME,
        "temperature": CHAT_MODEL_TEMPERATURE,
        "max_tokens": CHAT_MODEL_MAX_TOKENS
    }


def get_summarizer_config():
    """Lấy cấu hình model cho summarizer"""
    return {
        "model": SUMMARIZER_MODEL_NAME,
        "temperature": SUMMARIZER_TEMPERATURE,
        "max_tokens": SUMMARIZER_MAX_TOKENS
    }


def get_memory_config():
    """Lấy cấu hình model cho memory"""
    return {
        "model": MEM0_MODEL_NAME,
        "temperature": MEM0_TEMPERATURE,
        "max_tokens": MEM0_MAX_TOKENS
    }


def get_reminder_config():
    """Lấy cấu hình model cho reminder/proactive messages"""
    return {
        "model": REMINDER_MODEL_NAME,
        "temperature": REMINDER_TEMPERATURE,
        "max_tokens": REMINDER_MAX_TOKENS
    }


def get_crisis_config():
    """Lấy cấu hình model cho crisis detection"""
    return {
        "model": CRISIS_MODEL_NAME,
        "temperature": CRISIS_TEMPERATURE,
        "max_tokens": CRISIS_MAX_TOKENS
    }


def get_title_config():
    """Lấy cấu hình model cho title generation"""
    return {
        "model": TITLE_MODEL_NAME,
        "temperature": TITLE_TEMPERATURE,
        "max_tokens": TITLE_MAX_TOKENS
    }

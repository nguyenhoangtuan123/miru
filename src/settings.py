import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Quản lý cấu hình hệ thống từ file .env"""
    
    # Google API Config
    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
    
    # Supabase Config
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL")
    
    # MCP Config
    MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL")
    
    # User Context
    USER_ID = os.environ.get("USER_ID", "user_alex")
    
    # Other Configs
    MAX_OUTPUT_TOKENS = int(os.environ.get("MAX_OUTPUT_TOKENS", "1000"))
    PROMPT_BUDGET_TOKENS = int(os.environ.get("PROMPT_BUDGET_TOKENS", "2000"))

# Singleton instance
settings = Settings()

# file: mcp_server.py

import os
import ssl

# Disable SSL verification for HuggingFace downloads to fix certificate errors
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''
ssl._create_default_https_context = ssl._create_unverified_context

from contextlib import asynccontextmanager
from fastapi import FastAPI
from starlette.routing import Mount
import uvicorn

from mcp.server.fastmcp import FastMCP
from database import DatabaseManager
from activity_tracker import ActivityTracker

mcp = FastMCP("Psychological Long-Term Memory (SSE)", sse_path="/sse")
db_manager = DatabaseManager()
activity_tracker = ActivityTracker(db_manager.supabase, db_manager)

app = FastAPI(
    title="Memory MCP Server",
    description="Một dịch vụ web cung cấp bộ nhớ dài hạn qua giao thức MCP.",
    routes=[Mount("/sse", app=mcp.sse_app(), name="sse_endpoint")]
)

@mcp.resource("profile://{user_id}/summary")
def get_profile_summary(user_id: str) -> str:
    return db_manager.get_user_profile_summary(user_id)

@mcp.tool()
def add_session_summary(user_id: str, summary: str) -> str:
    return db_manager.add_session_summary(user_id, summary)

@mcp.tool()
def find_relevant_memories(user_id: str, query: str) -> str:
    summaries = db_manager.find_relevant_summaries(user_id, query)
    if not summaries:
        return "Không tìm thấy ký ức nào liên quan."
    return f"Đã tìm thấy các ký ức liên quan sau:\n" + "\n".join([f"- {s}" for s in summaries])

@mcp.tool()
def update_personal_detail(user_id: str, detail_key: str, detail_value: str) -> str:
    return db_manager.update_personal_detail(user_id, detail_key, detail_value)

@mcp.tool()
def analyze_topic_frequency(user_id: str, topic: str) -> str:
    return db_manager.analyze_patterns_simple(user_id, topic)

@mcp.tool()
def get_latest_session_summary(user_id: str) -> str:
    return db_manager.get_latest_session_summary(user_id)

@mcp.tool()
def get_memories_by_date(user_id: str, date: str) -> str:
    return db_manager.get_memories_by_date(user_id, date)

@mcp.tool()
def get_session_timeline(user_id: str, days: int = 30) -> str:
    import json
    return json.dumps(db_manager.get_session_timeline(user_id, days))

@mcp.tool()
def log_activity(user_id: str, activity_type: str) -> str:
    return activity_tracker.log_activity(user_id, activity_type)

# file: mcp_server.py

import os
import ssl

# Disable SSL verification for HuggingFace downloads to fix certificate errors
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''
ssl._create_default_https_context = ssl._create_unverified_context

from contextlib import asynccontextmanager
from fastapi import FastAPI
from starlette.routing import Mount
import uvicorn

from mcp.server.fastmcp import FastMCP
from database import DatabaseManager
from activity_tracker import ActivityTracker

mcp = FastMCP("Psychological Long-Term Memory (SSE)", sse_path="/sse")
db_manager = DatabaseManager()
activity_tracker = ActivityTracker(db_manager.supabase, db_manager)

app = FastAPI(
    title="Memory MCP Server",
    description="Một dịch vụ web cung cấp bộ nhớ dài hạn qua giao thức MCP.",
    routes=[Mount("/sse", app=mcp.sse_app(), name="sse_endpoint")]
)

@mcp.resource("profile://{user_id}/summary")
def get_profile_summary(user_id: str) -> str:
    return db_manager.get_user_profile_summary(user_id)

@mcp.tool()
def add_session_summary(user_id: str, summary: str) -> str:
    return db_manager.add_session_summary(user_id, summary)

@mcp.tool()
def find_relevant_memories(user_id: str, query: str) -> str:
    summaries = db_manager.find_relevant_summaries(user_id, query)
    if not summaries:
        return "Không tìm thấy ký ức nào liên quan."
    return f"Đã tìm thấy các ký ức liên quan sau:\n" + "\n".join([f"- {s}" for s in summaries])

@mcp.tool()
def update_personal_detail(user_id: str, detail_key: str, detail_value: str) -> str:
    return db_manager.update_personal_detail(user_id, detail_key, detail_value)

@mcp.tool()
def analyze_topic_frequency(user_id: str, topic: str) -> str:
    return db_manager.analyze_patterns_simple(user_id, topic)

@mcp.tool()
def get_latest_session_summary(user_id: str) -> str:
    return db_manager.get_latest_session_summary(user_id)

@mcp.tool()
def get_memories_by_date(user_id: str, date: str) -> str:
    return db_manager.get_memories_by_date(user_id, date)

@mcp.tool()
def get_session_timeline(user_id: str, days: int = 30) -> str:
    import json
    return json.dumps(db_manager.get_session_timeline(user_id, days))

@mcp.tool()
def log_activity(user_id: str, activity_type: str) -> str:
    return activity_tracker.log_activity(user_id, activity_type)

@mcp.tool()
def get_sleep_info(user_id: str) -> str:
    import json
    sleep_data = activity_tracker.calculate_last_sleep_duration(user_id)
    return json.dumps(sleep_data, ensure_ascii=False) if sleep_data else "Chưa có dữ liệu ngủ."

@app.get("/")
def read_root():
    return {"message": "MCP Memory Server is running"}

# ==================== REST API Endpoints ====================
# These allow direct HTTP calls instead of SSE

from fastapi import HTTPException
from pydantic import BaseModel

class ToolRequest(BaseModel):
    user_id: str
    summary: str = None
    query: str = None
    detail_key: str = None
    detail_value: str = None
    topic: str = None
    date: str = None
    days: int = 30
    activity_type: str = None

@app.post("/api/add_session_summary")
def api_add_session_summary(req: ToolRequest):
    try:
        return {"result": add_session_summary(req.user_id, req.summary)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/find_relevant_memories")
def api_find_relevant_memories(req: ToolRequest):
    try:
        return {"result": find_relevant_memories(req.user_id, req.query)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/get_latest_session_summary")
def api_get_latest_session_summary(req: ToolRequest):
    try:
        return {"result": get_latest_session_summary(req.user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update_personal_detail")
def api_update_personal_detail(req: ToolRequest):
    try:
        return {"result": update_personal_detail(req.user_id, req.detail_key, req.detail_value)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze_topic_frequency")
def api_analyze_topic_frequency(req: ToolRequest):
    try:
        return {"result": analyze_topic_frequency(req.user_id, req.topic)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/get_memories_by_date")
def api_get_memories_by_date(req: ToolRequest):
    try:
        return {"result": get_memories_by_date(req.user_id, req.date)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/get_session_timeline")
def api_get_session_timeline(req: ToolRequest):
    try:
        return {"result": get_session_timeline(req.user_id, req.days)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/log_activity")
def api_log_activity(req: ToolRequest):
    try:
        return {"result": log_activity(req.user_id, req.activity_type)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/get_sleep_info")
def api_get_sleep_info(req: ToolRequest):
    try:
        return {"result": get_sleep_info(req.user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def start_server():
    print("Khởi động MCP Server trên nền tảng web (FastAPI - SSE)...")
    print("Server sẽ lắng nghe tại: http://127.0.0.1:8020")
    print("Client có thể kết nối tại: http://127.0.0.1:8020/sse")
    print("REST API available at: http://127.0.0.1:8020/api/*")
    print("🔄 Auto-reload ENABLED - Server sẽ tự restart khi code thay đổi")
    print("✅ SSL verification DISABLED for HuggingFace model downloads")
    uvicorn.run("mcp_server:app", host="127.0.0.1", port=8020, reload=True)

if __name__ == "__main__":
    start_server()
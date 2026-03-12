import json
import os
import ssl
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

from activity_tracker import ActivityTracker
from database import DatabaseManager

os.environ.setdefault("CURL_CA_BUNDLE", "")
os.environ.setdefault("REQUESTS_CA_BUNDLE", "")
ssl._create_default_https_context = ssl._create_unverified_context

db_manager = DatabaseManager()
activity_tracker = ActivityTracker(db_manager.supabase, db_manager)

app = FastAPI(
    title="Memory MCP Server",
    description="REST adapter for long-term memory operations.",
)


def add_session_summary(user_id: str, summary: str) -> str:
    return db_manager.add_session_summary(user_id, summary)


def find_relevant_memories(user_id: str, query: str) -> str:
    summaries = db_manager.find_relevant_summaries(user_id, query)
    if not summaries:
        return "KhÃ´ng tÃ¬m tháº¥y kÃ½ á»©c nÃ o liÃªn quan."
    return "ÄÃ£ tÃ¬m tháº¥y cÃ¡c kÃ½ á»©c liÃªn quan sau:\n" + "\n".join(f"- {item}" for item in summaries)


def update_personal_detail(user_id: str, detail_key: str, detail_value: str) -> str:
    return db_manager.update_personal_detail(user_id, detail_key, detail_value)


def analyze_topic_frequency(user_id: str, topic: str) -> str:
    return db_manager.analyze_patterns_simple(user_id, topic)


def get_latest_session_summary(user_id: str) -> str:
    return db_manager.get_latest_session_summary(user_id)


def get_memories_by_date(user_id: str, date: str) -> str:
    return db_manager.get_memories_by_date(user_id, date)


def get_session_timeline(user_id: str, days: int = 30) -> str:
    return json.dumps(db_manager.get_session_timeline(user_id, days))


def log_activity(user_id: str, activity_type: str) -> str:
    return activity_tracker.log_activity(user_id, activity_type)


def get_sleep_info(user_id: str) -> str:
    sleep_data = activity_tracker.calculate_last_sleep_duration(user_id)
    return json.dumps(sleep_data, ensure_ascii=False) if sleep_data else "ChÆ°a cÃ³ dá»¯ liá»‡u ngá»§."


@app.get("/")
def read_root():
    return {"message": "Memory REST server is running"}


@app.get("/sse")
def sse_placeholder():
    return {"message": "SSE MCP is disabled in this runtime. Use REST endpoints under /api/*."}


class ToolRequest(BaseModel):
    user_id: str
    summary: Optional[str] = None
    query: Optional[str] = None
    detail_key: Optional[str] = None
    detail_value: Optional[str] = None
    topic: Optional[str] = None
    date: Optional[str] = None
    days: int = 30
    activity_type: Optional[str] = None


@app.post("/api/add_session_summary")
def api_add_session_summary(req: ToolRequest):
    try:
        return {"result": add_session_summary(req.user_id, req.summary or "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/find_relevant_memories")
def api_find_relevant_memories(req: ToolRequest):
    try:
        return {"result": find_relevant_memories(req.user_id, req.query or "")}
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
        return {"result": update_personal_detail(req.user_id, req.detail_key or "", req.detail_value or "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze_topic_frequency")
def api_analyze_topic_frequency(req: ToolRequest):
    try:
        return {"result": analyze_topic_frequency(req.user_id, req.topic or "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/get_memories_by_date")
def api_get_memories_by_date(req: ToolRequest):
    try:
        return {"result": get_memories_by_date(req.user_id, req.date or "")}
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
        return {"result": log_activity(req.user_id, req.activity_type or "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/get_sleep_info")
def api_get_sleep_info(req: ToolRequest):
    try:
        return {"result": get_sleep_info(req.user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def start_server():
    print("Khá»Ÿi Ä‘á»™ng Memory REST server...")
    print("Server sáº½ láº¯ng nghe táº¡i: http://127.0.0.1:8020")
    print("REST API available at: http://127.0.0.1:8020/api/*")
    print("SSE MCP disabled in this runtime; REST is the supported path.")
    uvicorn.run("mcp_server:app", host="127.0.0.1", port=8020, reload=True)


if __name__ == "__main__":
    start_server()


import os
import json
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

# Timezone
LOCAL_TZ = timezone(timedelta(hours=7))  # Vietnam GMT+7


def _get_mcp_base_url() -> str:
    base_url = os.getenv("MCP_SERVER_URL", "http://127.0.0.1:8020").strip()
    if base_url.endswith("/sse"):
        base_url = base_url[:-4]
    return base_url.rstrip("/")

async def call_mcp_tool(tool_name: str, user_id: str = None, tool_args: Dict[str, Any] = None):
    """Call MCP tool via REST API instead of SSE"""
    try:
        # Map tool names to API endpoints
        endpoint_map = {
            "add_session_summary": "/api/add_session_summary",
            "find_relevant_memories": "/api/find_relevant_memories",
            "get_latest_session_summary": "/api/get_latest_session_summary",
            "update_personal_detail": "/api/update_personal_detail",
            "analyze_topic_frequency": "/api/analyze_topic_frequency",
            "get_memories_by_date": "/api/get_memories_by_date",
            "get_session_timeline": "/api/get_session_timeline",
            "log_activity": "/api/log_activity",
            "get_sleep_info": "/api/get_sleep_info",
        }
        
        endpoint = endpoint_map.get(tool_name)
        if not endpoint:
            return f"Unknown tool: {tool_name}"
        
        # Prepare request body
        body = {"user_id": user_id, **(tool_args or {})}
        base_url = _get_mcp_base_url()
        
        # Call REST API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}{endpoint}",
                json=body,
                timeout=10.0
            )
            response.raise_for_status()
            result = response.json()
            return result.get("result", "No result")
            
    except httpx.TimeoutException:
        print(f"[MCP Error] {tool_name}: Timeout")
        return "[Error: Timeout]"
    except Exception as e:
        print(f"[MCP Error] {tool_name}: {e}")
        return f"[Error: {str(e)}]"

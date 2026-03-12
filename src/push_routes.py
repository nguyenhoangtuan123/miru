from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_middleware import get_current_user
from push_service import get_push_service

router = APIRouter(prefix="/api/push", tags=["Push"])


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionPayload(BaseModel):
    endpoint: str
    expirationTime: Any = None
    keys: PushSubscriptionKeys


class RemoveSubscriptionPayload(BaseModel):
    endpoint: str


async def _require_user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = user.get("sub") or user.get("user_id")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user")
    return user_id


@router.get("/config")
async def get_push_config():
    service = get_push_service()
    return {"success": True, **service.get_public_config()}


@router.post("/subscribe")
async def subscribe_push(payload: PushSubscriptionPayload, request: Request):
    user_id = await _require_user_id(request)
    service = get_push_service()
    saved = service.save_subscription(user_id, payload.model_dump())
    if not saved:
        raise HTTPException(status_code=400, detail="Failed to save push subscription")
    return {"success": True}


@router.post("/unsubscribe")
async def unsubscribe_push(payload: RemoveSubscriptionPayload, request: Request):
    user_id = await _require_user_id(request)
    service = get_push_service()
    removed = service.remove_subscription(user_id, payload.endpoint)
    return {"success": removed}


@router.post("/test")
async def test_push(request: Request):
    user_id = await _require_user_id(request)
    service = get_push_service()
    result: Dict[str, Any] = service.send_push_to_user(
        user_id=user_id,
        title="Miru test notification",
        body="Thong bao push da san sang tren thiet bi nay.",
        url="/settings",
        tag="push-test",
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Failed to send test push")
    return {"success": True, "result": result}

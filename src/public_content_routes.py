from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from auth_middleware import get_current_user
from article_service import (
    ArticleAccessError,
    ArticleNotFoundError,
    ArticleSchemaError,
    ArticleValidationError,
)
from public_content_service import (
    PublicContentSchemaError,
    PublicContentValidationError,
    get_public_content_service,
)

router = APIRouter(tags=["Public Content"])


class PublicEventItemPayload(BaseModel):
    event_type: str
    article_slug: Optional[str] = None
    therapist_id: Optional[str] = None
    topic_tags: List[str] = Field(default_factory=list)
    read_depth_percent: Optional[int] = None
    referrer: Optional[str] = None
    source_path: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    occurred_at: Optional[str] = None


class PublicEventBatchPayload(BaseModel):
    anonymous_id: str
    session_id: str
    user_id: Optional[str] = None
    events: List[PublicEventItemPayload]


class PublicIdentityAliasPayload(BaseModel):
    anonymous_id: str
    session_id: Optional[str] = None


class ArticleAssistantSessionPayload(BaseModel):
    anonymous_id: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None


class ArticleAssistantMessagePayload(ArticleAssistantSessionPayload):
    message: str


async def _require_current_user(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid user")
    current_user["resolved_user_id"] = user_id
    return current_user


def _raise_service_error(exc: Exception) -> None:
    if isinstance(exc, PublicContentSchemaError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, PublicContentValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if isinstance(exc, ArticleSchemaError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, ArticleValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if isinstance(exc, ArticleNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ArticleAccessError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    raise exc


@router.post("/api/public/events/batch")
async def post_public_events(data: PublicEventBatchPayload):
    try:
        inserted = get_public_content_service().log_public_events(
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
            claimed_user_id=data.user_id,
            events=[event.model_dump(exclude_none=True) for event in data.events],
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "inserted": inserted}


@router.post("/api/public/identity/alias")
async def alias_public_identity(data: PublicIdentityAliasPayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        link = get_public_content_service().alias_identity(
            user_id=current_user["resolved_user_id"],
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "link": link}


@router.get("/api/public/recommendations/articles")
async def get_public_article_recommendations(
    article_slug: str,
    anonymous_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(default=3, ge=1, le=6),
):
    try:
        payload = get_public_content_service().recommend_articles(
            article_slug=article_slug,
            anonymous_id=anonymous_id,
            claimed_user_id=user_id,
            limit=limit,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.get("/api/public/recommendations/therapists")
async def get_public_therapist_recommendations(
    article_slug: str,
    anonymous_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(default=3, ge=1, le=6),
):
    try:
        payload = get_public_content_service().recommend_therapists(
            article_slug=article_slug,
            anonymous_id=anonymous_id,
            claimed_user_id=user_id,
            limit=limit,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.post("/api/public/articles/{slug}/assistant/session")
async def start_public_article_ai_session(slug: str, data: ArticleAssistantSessionPayload):
    try:
        payload = await get_public_content_service().start_article_ai_session(
            article_slug=slug,
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
            claimed_user_id=data.user_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.post("/api/public/articles/{slug}/assistant/message")
async def send_public_article_ai_message(slug: str, data: ArticleAssistantMessagePayload):
    try:
        payload = await get_public_content_service().send_article_ai_message(
            article_slug=slug,
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
            claimed_user_id=data.user_id,
            message=data.message,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.get("/api/therapist/articles/me/analytics")
async def get_my_therapist_article_analytics(request: Request):
    current_user = await _require_current_user(request)
    try:
        payload = get_public_content_service().list_my_article_analytics(
            current_user["resolved_user_id"]
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
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
    interaction_mode: Optional[str] = None
    question_id: Optional[str] = None


class ArticleAssistantMessagePayload(ArticleAssistantSessionPayload):
    message: str


class PublicArticleQuestionCreatePayload(BaseModel):
    public_display_name: Optional[str] = None
    anonymous_id: Optional[str] = None
    session_id: Optional[str] = None
    question_text: str


class TherapistArticleQuestionAnswerPayload(BaseModel):
    answer_text: str


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


@router.get("/api/public/articles/{slug}/questions")
async def get_public_article_questions(slug: str):
    try:
        questions = get_public_content_service().list_public_article_questions(slug)
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "questions": questions}


@router.post("/api/public/articles/{slug}/questions")
async def post_public_article_question(slug: str, data: PublicArticleQuestionCreatePayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        question = get_public_content_service().submit_public_article_question(
            article_slug=slug,
            user_id=current_user["resolved_user_id"],
            question_text=data.question_text,
            public_display_name=data.public_display_name,
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "question": question}


@router.post("/api/public/articles/{slug}/assistant/session")
async def start_public_article_ai_session(slug: str, data: ArticleAssistantSessionPayload):
    try:
        payload = await get_public_content_service().start_article_ai_session(
            article_slug=slug,
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
            claimed_user_id=data.user_id,
            interaction_mode=data.interaction_mode,
            question_id=data.question_id,
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
            interaction_mode=data.interaction_mode,
            question_id=data.question_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.post("/api/public/articles/{slug}/questions/assistant/session")
async def start_public_article_question_ai_session(slug: str, data: ArticleAssistantSessionPayload):
    try:
        payload = await get_public_content_service().start_article_ai_session(
            article_slug=slug,
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
            claimed_user_id=data.user_id,
            interaction_mode="community_qa",
            question_id=data.question_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.post("/api/public/articles/{slug}/questions/assistant/message")
async def send_public_article_question_ai_message(slug: str, data: ArticleAssistantMessagePayload):
    try:
        payload = await get_public_content_service().send_article_ai_message(
            article_slug=slug,
            anonymous_id=data.anonymous_id,
            session_id=data.session_id,
            claimed_user_id=data.user_id,
            message=data.message,
            interaction_mode="community_qa",
            question_id=data.question_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.get("/api/therapist/articles/me/analytics")
async def get_my_therapist_article_analytics(request: Request):
    current_user = await _require_current_user(request)
    try:
        payload = get_public_content_service().list_my_article_analytics(
            current_user["resolved_user_id"],
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.get("/api/therapist/articles/questions/me")
@router.get("/api/therapist/articles/me/questions")
async def get_my_article_questions(request: Request):
    current_user = await _require_current_user(request)
    try:
        payload = get_public_content_service().list_my_article_questions(
            current_user["resolved_user_id"],
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **payload}


@router.post("/api/therapist/articles/questions/{question_id}/publish")
async def publish_my_article_question(question_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        question = get_public_content_service().publish_article_question(
            user_id=current_user["resolved_user_id"],
            question_id=question_id,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "question": question}


@router.post("/api/therapist/articles/questions/{question_id}/answer")
async def answer_my_article_question(question_id: str, data: TherapistArticleQuestionAnswerPayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        question = get_public_content_service().answer_article_question(
            user_id=current_user["resolved_user_id"],
            question_id=question_id,
            answer_text=data.answer_text,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "question": question}


@router.post("/api/therapist/articles/questions/{question_id}/hide")
async def hide_my_article_question(question_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        question = get_public_content_service().hide_article_question(
            user_id=current_user["resolved_user_id"],
            question_id=question_id,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "question": question}


# ── Community Hub Q&A ────────────────────────────────────


class CommunityQuestionPayload(BaseModel):
    public_name: str
    question_text: str
    topic_tags: List[str] = Field(default_factory=list)
    source: str = "community_hub"


@router.post("/api/public/community/questions")
async def submit_community_question(payload: CommunityQuestionPayload, request: Request):
    """Submit a community hub question (requires auth)."""
    current_user = await _require_current_user(request)
    user_id = current_user["resolved_user_id"]

    try:
        import uuid
        from datetime import datetime, timezone

        from database import DatabaseManager

        db = DatabaseManager()
        question_id = str(uuid.uuid4())
        now_value = datetime.now(timezone.utc).isoformat()

        row = db.supabase.table("public_article_questions").insert({
            "question_id": question_id,
            "article_slug": "__community_hub__",
            "therapist_id": "__miru_community__",
            "user_id": user_id,
            "anonymous_id": user_id,
            "public_display_name": payload.public_name or "Người dùng Miru",
            "question_text": payload.question_text,
            "answer_text": None,
            "status": "pending_review",
            "questioned_at": now_value,
            "published_at": None,
            "answered_at": None,
            "hidden_at": None,
            "created_at": now_value,
            "updated_at": now_value,
        }).execute()

        return {
            "success": True,
            "question_id": question_id,
            "status": "pending_review",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to submit question: {exc}")


@router.get("/api/public/community/questions")
async def list_community_questions(
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0, ge=0),
):
    """List published community hub questions."""
    try:
        from database import DatabaseManager

        db = DatabaseManager()
        result = (
            db.supabase.table("public_article_questions")
            .select("*")
            .eq("article_slug", "__community_hub__")
            .in_("status", ["published", "answered"])
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        return {"success": True, "questions": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {exc}")


# ── Image upload for article editor ──────────────────────────────────────────

ARTICLE_IMAGES_BUCKET = "article-images"
ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _ensure_article_images_bucket() -> None:
    try:
        from database import DatabaseManager
        db = DatabaseManager()
        db.supabase.storage.create_bucket(ARTICLE_IMAGES_BUCKET, options={"public": True})
    except Exception:
        pass  # bucket already exists


@router.post("/api/therapist/articles/upload-image")
async def upload_article_image(request: Request, file: UploadFile = File(...)):
    """Upload an image for use in articles (inline or cover)."""
    current_user = await _require_current_user(request)
    user_id = current_user["resolved_user_id"]

    # Validate MIME type
    mime = file.content_type or ""
    if mime not in ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Loại file không hợp lệ: {mime}. Chỉ chấp nhận JPG, PNG, WebP, GIF.",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File quá lớn ({len(content) // 1024 // 1024}MB). Giới hạn 5MB.",
        )
    if not content:
        raise HTTPException(status_code=400, detail="File trống.")

    # Determine extension
    ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
    ext = ext_map.get(mime, "jpg")

    from uuid import uuid4
    from database import DatabaseManager

    _ensure_article_images_bucket()

    db = DatabaseManager()
    path = f"{user_id}/{uuid4()}.{ext}"

    try:
        db.supabase.storage.from_(ARTICLE_IMAGES_BUCKET).upload(
            path,
            content,
            file_options={"content-type": mime, "upsert": "false"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload thất bại: {exc}")

    # Build public URL
    public_url = db.supabase.storage.from_(ARTICLE_IMAGES_BUCKET).get_public_url(path)

    return {"success": True, "url": public_url, "path": path}

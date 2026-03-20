from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from article_service import (
    ArticleAccessError,
    ArticleNotFoundError,
    ArticleSchemaError,
    ArticleValidationError,
    get_article_service,
)
from auth_middleware import get_current_user
from therapist_verification_service import get_therapist_verification_service

router = APIRouter(tags=["Therapist Articles"])


class TherapistArticleUpsertPayload(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    content_markdown: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


class ArticleRejectPayload(BaseModel):
    rejection_reason: Optional[str] = None


async def _require_current_user(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid user")
    current_user["resolved_user_id"] = user_id
    return current_user


async def _require_admin_reviewer(request: Request) -> Dict[str, Any]:
    current_user = await _require_current_user(request)
    email = str(current_user.get("email") or "")
    if not get_therapist_verification_service().is_admin_reviewer(email):
        raise HTTPException(status_code=403, detail="Admin reviewer access required")
    return current_user


def _raise_service_error(exc: Exception) -> None:
    if isinstance(exc, ArticleSchemaError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, ArticleAccessError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, ArticleNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ArticleValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise exc


@router.get("/api/articles")
async def list_public_articles(
    limit: Optional[int] = Query(default=None, ge=1, le=24),
    therapist_id: Optional[str] = None,
):
    try:
        articles = get_article_service().list_public_articles(limit=limit, therapist_id=therapist_id)
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "articles": articles}


@router.get("/api/articles/{slug}")
async def get_public_article(slug: str):
    try:
        article = get_article_service().get_public_article(slug)
    except Exception as exc:
        _raise_service_error(exc)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return {"success": True, "article": article}


@router.get("/api/therapist/articles/me")
async def list_my_articles(request: Request):
    current_user = await _require_current_user(request)
    try:
        articles = get_article_service().list_my_articles(
            current_user["resolved_user_id"],
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "articles": articles}


@router.post("/api/therapist/articles")
async def create_my_article(data: TherapistArticleUpsertPayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        article = get_article_service().create_article(
            current_user["resolved_user_id"],
            data.model_dump(exclude_unset=True),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "article": article}


@router.put("/api/therapist/articles/{article_id}")
async def update_my_article(article_id: str, data: TherapistArticleUpsertPayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        article = get_article_service().update_article(
            current_user["resolved_user_id"],
            article_id,
            data.model_dump(exclude_unset=True),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "article": article}


@router.post("/api/therapist/articles/{article_id}/submit")
async def submit_my_article(article_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        article = get_article_service().submit_article(
            current_user["resolved_user_id"],
            article_id,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "article": article}


@router.post("/api/therapist/articles/{article_id}/archive")
async def archive_my_article(article_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        article = get_article_service().archive_article(
            current_user["resolved_user_id"],
            article_id,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "article": article}


@router.get("/api/admin/articles/review")
async def list_article_reviews(request: Request, status: Optional[str] = "pending_review"):
    current_user = await _require_admin_reviewer(request)
    try:
        articles = get_article_service().list_review_articles(
            reviewer_email=str(current_user.get("email") or ""),
            status=status,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "articles": articles}


@router.post("/api/admin/articles/{article_id}/approve")
async def approve_article(article_id: str, request: Request):
    current_user = await _require_admin_reviewer(request)
    try:
        article = get_article_service().approve_article(
            reviewer_email=str(current_user.get("email") or ""),
            article_id=article_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "article": article}


@router.post("/api/admin/articles/{article_id}/reject")
async def reject_article(article_id: str, data: ArticleRejectPayload, request: Request):
    current_user = await _require_admin_reviewer(request)
    try:
        article = get_article_service().reject_article(
            reviewer_email=str(current_user.get("email") or ""),
            article_id=article_id,
            rejection_reason=data.rejection_reason,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "article": article}

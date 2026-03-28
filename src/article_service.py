from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

from profile_service import get_profile_service
from therapist_service import get_therapist_service
from therapist_verification_service import get_therapist_verification_service

try:
    from embedding_service import get_embedding, build_article_embed_text
    _HAS_EMBEDDING = True
except ImportError:
    _HAS_EMBEDDING = False

load_dotenv()

ARTICLES_TABLE = "therapist_articles"
VALID_ARTICLE_STATUSES = {
    "draft",
    "pending_review",
    "published",
    "rejected",
    "archived",
}
ARTICLE_TOPIC_RULES = {
    "Lo au": ("lo au", "anxiety", "bon chon", "cang", "qua tai", "stress", "mindfulness", "tho"),
    "Burnout": ("burnout", "kiet suc", "met", "ap luc", "het nang luong"),
    "Moi quan he": ("moi quan he", "tinh yeu", "ranh gioi", "xung dot", "gan gui", "ket noi"),
    "Tu cham soc": ("tu cham soc", "self-care", "ngu", "nhip", "phuc hoi", "thoi quen"),
    "Tu ti": ("tu ti", "khong du gioi", "nghi ngo", "imposter", "gia tri ban than"),
    "Mo loi": ("mo loi", "chia se", "giu mot minh", "co lap", "nho giup do"),
    "Lang nghe ban than": ("cam xuc", "lang nghe", "nhin lai", "quan sat", "hien dien"),
}
SCHEMA_HINT = (
    "Schema bài viết chưa sẵn sàng. Hãy chạy migration "
    "028_add_therapist_articles.sql trước khi dùng tính năng này."
)


class ArticleServiceError(Exception):
    pass


class ArticleSchemaError(ArticleServiceError):
    pass


class ArticleAccessError(ArticleServiceError):
    pass


class ArticleNotFoundError(ArticleServiceError):
    pass


class ArticleValidationError(ArticleServiceError):
    pass


class ArticleService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.profile_service = get_profile_service()
        self.therapist_service = get_therapist_service()
        self.verification_service = get_therapist_verification_service()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _schema_error(self, detail: Optional[str] = None) -> ArticleSchemaError:
        if detail:
            return ArticleSchemaError(f"{SCHEMA_HINT} ({detail})")
        return ArticleSchemaError(SCHEMA_HINT)

    def _normalize_text(self, value: Any, max_length: Optional[int] = None) -> Optional[str]:
        if not isinstance(value, str):
            return None
        cleaned = re.sub(r"\s+", " ", value).strip()
        if not cleaned:
            return None
        if isinstance(max_length, int) and max_length > 0:
            return cleaned[:max_length]
        return cleaned

    def _normalize_multiline_text(self, value: Any, max_length: Optional[int] = None) -> Optional[str]:
        if not isinstance(value, str):
            return None
        cleaned = value.replace("\r\n", "\n").replace("\r", "\n").strip()
        if not cleaned:
            return None
        if isinstance(max_length, int) and max_length > 0:
            return cleaned[:max_length]
        return cleaned

    def _strip_markdown(self, value: Optional[str]) -> str:
        if not value:
            return ""
        text = re.sub(r"`{1,3}.*?`{1,3}", " ", value, flags=re.DOTALL)
        text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
        text = re.sub(r"\[[^\]]+\]\([^)]+\)", " ", text)
        text = re.sub(r"^[#>\-*+\d.\s]+", "", text, flags=re.MULTILINE)
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"__(.+?)__", r"\1", text)
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        text = re.sub(r"_(.+?)_", r"\1", text)
        text = re.sub(r"~~(.+?)~~", r"\1", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _slugify(self, value: str) -> str:
        normalized = value.lower().strip()
        normalized = re.sub(r"[^a-z0-9\s-]", "-", normalized)
        normalized = re.sub(r"\s+", "-", normalized)
        normalized = re.sub(r"-{2,}", "-", normalized)
        return normalized.strip("-")[:180]

    def _ensure_excerpt(self, explicit_excerpt: Optional[str], content_markdown: Optional[str]) -> Optional[str]:
        excerpt = self._normalize_text(explicit_excerpt, max_length=600)
        if excerpt:
            return excerpt
        fallback = self._strip_markdown(content_markdown)
        return fallback[:240].rstrip() if fallback else None

    def _handle_storage_exception(self, exc: Exception) -> None:
        message = str(exc).lower()
        if ARTICLES_TABLE in message or "column" in message or "relation" in message or "schema" in message:
            raise self._schema_error(str(exc)) from exc
        raise exc

    def _coerce_article_id(self, article_id: Any) -> Any:
        if isinstance(article_id, int):
            return article_id
        if isinstance(article_id, str):
            cleaned = article_id.strip()
            if cleaned.isdigit():
                return int(cleaned)
            return cleaned
        return article_id

    def _base_query(self):
        return self.supabase.table(ARTICLES_TABLE).select("*")

    def _list_rows(
        self,
        *,
        eq_filters: Optional[Dict[str, Any]] = None,
        order_by: str = "updated_at",
        desc: bool = True,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        try:
            query = self._base_query()
            for key, value in (eq_filters or {}).items():
                query = query.eq(key, value)
            query = query.order(order_by, desc=desc)
            if isinstance(limit, int) and limit > 0:
                query = query.limit(limit)
            response = query.execute()
            return [row for row in (response.data or []) if isinstance(row, dict)]
        except Exception as exc:
            self._handle_storage_exception(exc)
            return []

    def _single_row(
        self,
        *,
        eq_filters: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        rows = self._list_rows(eq_filters=eq_filters, limit=1)
        return rows[0] if rows else None

    def _compute_and_store_embedding(self, article_id: Any, article_row: Dict[str, Any]) -> None:
        """Generate embedding for an article and store it. Never raises."""
        if not _HAS_EMBEDDING:
            return
        try:
            serialized = self._serialize_article(article_row)
            text = build_article_embed_text(serialized)
            if not text.strip():
                return
            embedding = get_embedding(text, task_type="RETRIEVAL_DOCUMENT")
            # Skip storing if the API returned a zero vector
            if all(v == 0.0 for v in embedding[:10]):
                print(f"[article_service] Skipping zero embedding for article {article_id}")
                return
            self.supabase.table(ARTICLES_TABLE).update(
                {"embedding": embedding}
            ).eq("id", self._coerce_article_id(article_id)).execute()
            print(f"[article_service] Embedding stored for article {article_id}")
        except Exception as exc:
            print(f"[article_service] Embedding failed for article {article_id}: {exc}")

    def _insert_row(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = self.supabase.table(ARTICLES_TABLE).insert(payload).execute()
        except Exception as exc:
            self._handle_storage_exception(exc)
            raise
        if response.data:
            return response.data[0]
        fetched = self._single_row(eq_filters={"slug": payload.get("slug")})
        if not fetched:
            raise ArticleServiceError("Không tạo được bài viết")
        return fetched

    def _update_row(self, article_id: Any, payload: Dict[str, Any]) -> Dict[str, Any]:
        normalized_id = self._coerce_article_id(article_id)
        try:
            response = (
                self.supabase.table(ARTICLES_TABLE)
                .update(payload)
                .eq("id", normalized_id)
                .execute()
            )
        except Exception as exc:
            self._handle_storage_exception(exc)
            raise
        if response.data:
            return response.data[0]
        fetched = self._single_row(eq_filters={"id": normalized_id})
        if not fetched:
            raise ArticleNotFoundError("Không tìm thấy bài viết")
        return fetched

    def _therapist_for_user(self, user_id: str, *, email: str = "", name: str = "") -> Dict[str, Any]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            raise ArticleAccessError("Không tìm thấy hồ sơ therapist")
        if not self.verification_service.can_access_portal(user_id):
            raise ArticleAccessError("Therapist phải được duyệt trước khi dùng tính năng bài viết")
        therapist_id = str(therapist.get("id") or "").strip()
        if not therapist_id:
            raise ArticleAccessError("Hồ sơ therapist chưa hợp lệ")
        return therapist

    def _article_owner_row(
        self,
        user_id: str,
        article_id: Any,
        *,
        email: str = "",
        name: str = "",
    ) -> Dict[str, Any]:
        therapist = self._therapist_for_user(user_id, email=email, name=name)
        therapist_id = str(therapist.get("id") or "")
        article = self._single_row(
            eq_filters={
                "id": self._coerce_article_id(article_id),
                "therapist_id": therapist_id,
            }
        )
        if not article:
            raise ArticleNotFoundError("Không tìm thấy bài viết thuộc therapist này")
        return article

    def _slug_exists(self, slug: str, *, exclude_article_id: Optional[Any] = None) -> bool:
        candidates = self._list_rows(eq_filters={"slug": slug}, order_by="created_at", desc=False, limit=5)
        if exclude_article_id is None:
            return bool(candidates)
        normalized_exclude = self._coerce_article_id(exclude_article_id)
        return any(self._coerce_article_id(row.get("id")) != normalized_exclude for row in candidates)

    def _unique_slug(self, title: str, explicit_slug: Optional[str] = None, *, exclude_article_id: Optional[Any] = None) -> str:
        base = self._slugify(explicit_slug or title or "bai-viet")
        if not base:
            base = "bai-viet"
        candidate = base
        suffix = 2
        while self._slug_exists(candidate, exclude_article_id=exclude_article_id):
            candidate = f"{base}-{suffix}"
            suffix += 1
        return candidate

    def _public_author(self, therapist_id: str) -> Optional[Dict[str, Any]]:
        if not therapist_id:
            return None
        try:
            profile = self.profile_service.get_public_therapist(therapist_id, track_view=False)
        except Exception:
            profile = None
        if profile:
            return {
                "therapist_id": profile.get("therapist_id"),
                "display_name": profile.get("display_name"),
                "headline": profile.get("headline"),
                "avatar_image": profile.get("avatar_image"),
                "specializations": profile.get("specializations") or [],
                "is_verified": profile.get("is_verified"),
            }

        therapist = self.therapist_service.get_therapist(therapist_id)
        if not therapist:
            return None
        return {
            "therapist_id": str(therapist.get("id") or therapist_id),
            "display_name": therapist.get("name") or therapist.get("display_name") or "Therapist Miru",
            "headline": None,
            "avatar_image": None,
            "specializations": [],
            "is_verified": bool(therapist.get("is_verified")),
        }

    def _topic_tags(self, row: Dict[str, Any], author: Optional[Dict[str, Any]]) -> List[str]:
        parts: List[str] = []
        for key in ("title", "excerpt", "content_markdown", "seo_description"):
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(value.lower())
        if isinstance(author, dict):
            for item in author.get("specializations") or []:
                if isinstance(item, str) and item.strip():
                    parts.append(item.lower())
        haystack = " ".join(parts)
        matches = [
            tag
            for tag, keywords in ARTICLE_TOPIC_RULES.items()
            if any(keyword in haystack for keyword in keywords)
        ]
        return matches[:4] if matches else ["Lang nghe ban than"]

    def _serialize_article(self, row: Dict[str, Any], *, public_view: bool = False) -> Dict[str, Any]:
        therapist_id = str(row.get("therapist_id") or "")
        author = self._public_author(therapist_id)
        reviewer_email = self._normalize_text(row.get("reviewed_by_email"), max_length=160)
        article = {
            "id": row.get("id"),
            "therapist_id": therapist_id or None,
            "therapist_name": (author or {}).get("display_name"),
            "reviewer_name": reviewer_email,
            "title": self._normalize_text(row.get("title"), max_length=220) or "Bài viết Miru",
            "slug": self._normalize_text(row.get("slug"), max_length=240) or "",
            "excerpt": self._normalize_text(row.get("excerpt"), max_length=600),
            "cover_image_url": self._normalize_text(row.get("cover_image_url"), max_length=600),
            "content_markdown": self._normalize_multiline_text(row.get("content_markdown"), max_length=50000),
            "seo_title": self._normalize_text(row.get("seo_title"), max_length=220),
            "seo_description": self._normalize_text(row.get("seo_description"), max_length=320),
            "status": row.get("status") if row.get("status") in VALID_ARTICLE_STATUSES else "draft",
            "review_requested_at": row.get("review_requested_at"),
            "reviewed_at": row.get("reviewed_at"),
            "published_at": row.get("published_at"),
            "archived_at": row.get("archived_at"),
            "rejection_reason": self._normalize_multiline_text(row.get("rejection_reason"), max_length=1200),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "therapist": author,
            "topic_tags": self._topic_tags(row, author),
        }
        if public_view:
            article["status"] = "published"
            article["review_requested_at"] = None
            article["reviewed_at"] = None
            article["archived_at"] = None
            article["rejection_reason"] = None
            article["reviewer_name"] = None
        return article

    def _validated_upsert_payload(
        self,
        payload: Dict[str, Any],
        *,
        current_article_id: Optional[Any] = None,
    ) -> Dict[str, Any]:
        title = self._normalize_text(payload.get("title"), max_length=220)
        if not title:
            raise ArticleValidationError("Tiêu đề bài viết không được để trống")

        content_markdown = self._normalize_multiline_text(payload.get("content_markdown"), max_length=50000)
        excerpt = self._ensure_excerpt(payload.get("excerpt"), content_markdown)
        slug = self._unique_slug(title, payload.get("slug"), exclude_article_id=current_article_id)
        seo_title = self._normalize_text(payload.get("seo_title"), max_length=220) or title
        seo_description = self._normalize_text(payload.get("seo_description"), max_length=320) or excerpt

        return {
            "title": title,
            "slug": slug,
            "excerpt": excerpt,
            "cover_image_url": self._normalize_text(payload.get("cover_image_url"), max_length=600),
            "content_markdown": content_markdown,
            "seo_title": seo_title,
            "seo_description": seo_description,
        }

    def _validate_ready_for_review(self, row: Dict[str, Any]) -> None:
        title = self._normalize_text(row.get("title"), max_length=220)
        content = self._normalize_multiline_text(row.get("content_markdown"), max_length=50000)
        if not title:
            raise ArticleValidationError("Bài viết cần có tiêu đề trước khi gửi duyệt")
        if not content or len(self._strip_markdown(content)) < 80:
            raise ArticleValidationError("Nội dung bài viết còn quá ngắn để gửi duyệt")

    def list_public_articles(
        self,
        *,
        limit: Optional[int] = None,
        therapist_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        filters: Dict[str, Any] = {"status": "published"}
        normalized_therapist_id = self._normalize_text(therapist_id, max_length=120)
        if normalized_therapist_id:
            filters["therapist_id"] = normalized_therapist_id
        rows = self._list_rows(eq_filters=filters, order_by="published_at", desc=True, limit=limit)
        return [self._serialize_article(row, public_view=True) for row in rows]

    def get_public_article(self, slug: str) -> Optional[Dict[str, Any]]:
        normalized_slug = self._normalize_text(slug, max_length=240)
        if not normalized_slug:
            raise ArticleValidationError("Slug bài viết không hợp lệ")
        row = self._single_row(eq_filters={"slug": normalized_slug, "status": "published"})
        return self._serialize_article(row, public_view=True) if row else None

    def list_my_articles(self, user_id: str, *, email: str = "", name: str = "") -> List[Dict[str, Any]]:
        therapist = self._therapist_for_user(user_id, email=email, name=name)
        rows = self._list_rows(
            eq_filters={"therapist_id": therapist.get("id")},
            order_by="updated_at",
            desc=True,
        )
        return [self._serialize_article(row) for row in rows]

    def create_article(self, user_id: str, payload: Dict[str, Any], *, email: str = "", name: str = "") -> Dict[str, Any]:
        therapist = self._therapist_for_user(user_id, email=email, name=name)
        normalized = self._validated_upsert_payload(payload)
        now = self._now()
        row = self._insert_row(
            {
                "therapist_id": therapist.get("id"),
                **normalized,
                "status": "draft",
                "review_requested_at": None,
                "reviewed_at": None,
                "reviewed_by_email": None,
                "rejection_reason": None,
                "published_at": None,
                "created_at": now,
                "updated_at": now,
            }
        )
        self._compute_and_store_embedding(row.get("id"), row)
        return self._serialize_article(row)

    def update_article(
        self,
        user_id: str,
        article_id: Any,
        payload: Dict[str, Any],
        *,
        email: str = "",
        name: str = "",
    ) -> Dict[str, Any]:
        current = self._article_owner_row(user_id, article_id, email=email, name=name)
        normalized = self._validated_upsert_payload(payload, current_article_id=current.get("id"))
        next_status = current.get("status") if current.get("status") in VALID_ARTICLE_STATUSES else "draft"
        if next_status != "draft":
            next_status = "draft"
        update_payload = {
            **normalized,
            "status": next_status,
            "updated_at": self._now(),
        }
        if next_status == "draft":
            update_payload["published_at"] = None
            update_payload["review_requested_at"] = None
            update_payload["reviewed_at"] = None
            update_payload["reviewed_by_email"] = None
            update_payload["archived_at"] = None
        row = self._update_row(current.get("id"), update_payload)
        self._compute_and_store_embedding(row.get("id"), row)
        return self._serialize_article(row)

    def submit_article(
        self,
        user_id: str,
        article_id: Any,
        *,
        email: str = "",
        name: str = "",
    ) -> Dict[str, Any]:
        current = self._article_owner_row(user_id, article_id, email=email, name=name)
        if current.get("status") == "archived":
            raise ArticleValidationError("Bài viết đã lưu trữ nên không thể gửi duyệt")
        self._validate_ready_for_review(current)
        row = self._update_row(
            current.get("id"),
            {
                "status": "pending_review",
                "review_requested_at": self._now(),
                "reviewed_at": None,
                "reviewed_by_email": None,
                "rejection_reason": None,
                "published_at": None,
                "updated_at": self._now(),
            },
        )
        return self._serialize_article(row)

    def archive_article(
        self,
        user_id: str,
        article_id: Any,
        *,
        email: str = "",
        name: str = "",
    ) -> Dict[str, Any]:
        current = self._article_owner_row(user_id, article_id, email=email, name=name)
        row = self._update_row(
            current.get("id"),
            {
                "status": "archived",
                "archived_at": self._now(),
                "updated_at": self._now(),
            },
        )
        return self._serialize_article(row)

    def list_review_articles(self, *, reviewer_email: str, status: Optional[str] = "pending_review") -> List[Dict[str, Any]]:
        normalized_status = self._normalize_text(status, max_length=40)
        filters: Dict[str, Any] = {}
        if normalized_status and normalized_status in VALID_ARTICLE_STATUSES:
            filters["status"] = normalized_status
        rows = self._list_rows(eq_filters=filters, order_by="review_requested_at", desc=True)
        return [self._serialize_article(row) for row in rows]

    def approve_article(self, *, reviewer_email: str, article_id: Any) -> Dict[str, Any]:
        current = self._single_row(eq_filters={"id": self._coerce_article_id(article_id)})
        if not current:
            raise ArticleNotFoundError("Không tìm thấy bài viết để duyệt")
        row = self._update_row(
            current.get("id"),
            {
                "status": "published",
                "published_at": self._now(),
                "reviewed_at": self._now(),
                "reviewed_by_email": self._normalize_text(reviewer_email, max_length=160),
                "rejection_reason": None,
                "archived_at": None,
                "updated_at": self._now(),
            },
        )
        self._compute_and_store_embedding(row.get("id"), row)
        return self._serialize_article(row)

    def reject_article(
        self,
        *,
        reviewer_email: str,
        article_id: Any,
        rejection_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        current = self._single_row(eq_filters={"id": self._coerce_article_id(article_id)})
        if not current:
            raise ArticleNotFoundError("Không tìm thấy bài viết để từ chối")
        row = self._update_row(
            current.get("id"),
            {
                "status": "rejected",
                "reviewed_at": self._now(),
                "reviewed_by_email": self._normalize_text(reviewer_email, max_length=160),
                "rejection_reason": self._normalize_multiline_text(rejection_reason, max_length=1200),
                "published_at": None,
                "archived_at": None,
                "updated_at": self._now(),
            },
        )
        return self._serialize_article(row)


_article_service: Optional[ArticleService] = None


def get_article_service() -> ArticleService:
    global _article_service
    if _article_service is None:
        _article_service = ArticleService()
    return _article_service

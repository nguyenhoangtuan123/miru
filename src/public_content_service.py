from __future__ import annotations

import os
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from supabase import Client, create_client

from ai_service import get_summarizer_service
from article_service import get_article_service
from profile_service import get_profile_service

load_dotenv()

PUBLIC_EVENTS_TABLE = "public_content_events"
PUBLIC_IDENTITY_LINKS_TABLE = "public_content_identity_links"
PUBLIC_AI_SESSIONS_TABLE = "public_article_ai_sessions"
PUBLIC_AI_MESSAGES_TABLE = "public_article_ai_messages"
USER_ENTITLEMENTS_TABLE = "user_feature_entitlements"

SCHEMA_HINT = (
    "Schema public content flywheel chua san sang. Hay chay migration "
    "029_add_public_content_flywheel.sql truoc khi dung tinh nang nay."
)

VALID_PUBLIC_EVENT_TYPES = {
    "page_view",
    "article_view",
    "article_read_depth",
    "article_tag_click",
    "related_article_click",
    "therapist_profile_view",
    "therapist_contact_request_started",
    "therapist_contact_request_submitted",
    "article_to_profile_click",
    "article_to_contact_request",
    "article_to_pairing",
    "article_ai_session_started",
    "article_ai_message_sent",
    "article_ai_quota_exhausted",
    "article_ai_login_prompt_clicked",
}

TOPIC_RULES: Dict[str, tuple[str, ...]] = {
    "Lo au": ("lo au", "anxiety", "bon chon", "cang", "qua tai", "stress", "mindfulness", "tho"),
    "Burnout": ("burnout", "kiet suc", "met", "ap luc", "het nang luong"),
    "Moi quan he": ("moi quan he", "tinh yeu", "ranh gioi", "xung dot", "gan gui", "ket noi"),
    "Tu cham soc": ("tu cham soc", "self-care", "ngu", "nhip", "phuc hoi", "thoi quen"),
    "Tu ti": ("tu ti", "khong du gioi", "nghi ngo", "imposter", "gia tri ban than"),
    "Mo loi": ("mo loi", "chia se", "giu mot minh", "co lap", "nho giup do"),
    "Lang nghe ban than": ("cam xuc", "lang nghe", "nhin lai", "quan sat", "hien dien"),
}

SOURCE_LABELS = {
    "article": "Tu bai viet",
    "related_article": "Tu bai lien quan",
    "profile_direct_link": "Tu link ho so",
    "directory": "Tu danh ba therapist",
    "therapist_invite": "Tu loi moi therapist",
    "referral": "Tu gioi thieu",
}


class PublicContentError(Exception):
    pass


class PublicContentSchemaError(PublicContentError):
    pass


class PublicContentValidationError(PublicContentError):
    pass


class PublicContentService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.article_service = get_article_service()
        self.profile_service = get_profile_service()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _month_start(self) -> str:
        now = datetime.now(timezone.utc)
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    def _normalize_text(self, value: Any, max_length: Optional[int] = None) -> Optional[str]:
        if not isinstance(value, str):
            return None
        cleaned = re.sub(r"\s+", " ", value).strip()
        if not cleaned:
            return None
        return cleaned[:max_length] if isinstance(max_length, int) and max_length > 0 else cleaned

    def _normalize_tags(self, value: Any, max_items: int = 6) -> List[str]:
        if isinstance(value, list):
            candidates = value
        elif isinstance(value, str):
            candidates = re.split(r"[,;\n]", value)
        else:
            candidates = []
        normalized: List[str] = []
        for item in candidates:
            cleaned = self._normalize_text(item, max_length=80)
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
            if len(normalized) >= max_items:
                break
        return normalized

    def _normalize_read_depth(self, value: Any) -> Optional[int]:
        try:
            normalized = int(value)
        except Exception:
            return None
        if normalized < 0:
            return 0
        if normalized > 100:
            return 100
        return normalized

    def _safe_int_env(self, key: str, default: int) -> int:
        try:
            return int(os.getenv(key, str(default)))
        except Exception:
            return default

    def _schema_error(self, detail: Optional[str] = None) -> PublicContentSchemaError:
        return PublicContentSchemaError(f"{SCHEMA_HINT} ({detail})" if detail else SCHEMA_HINT)

    def _handle_storage_exception(self, exc: Exception) -> None:
        message = str(exc).lower()
        if (
            "public_content_" in message
            or "public_article_ai_" in message
            or "user_feature_entitlements" in message
            or "source_article_slug" in message
            or "relation" in message
            or "column" in message
        ):
            raise self._schema_error(str(exc)) from exc
        raise exc

    def _select_rows(
        self,
        table_name: str,
        *,
        eq_filters: Optional[Dict[str, Any]] = None,
        in_filters: Optional[Dict[str, List[Any]]] = None,
        gte_filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        desc: bool = True,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        try:
            query = self.supabase.table(table_name).select("*")
            for key, value in (eq_filters or {}).items():
                query = query.eq(key, value)
            for key, values in (in_filters or {}).items():
                filtered = [value for value in values if value not in (None, "")]
                if filtered:
                    query = query.in_(key, filtered)
            for key, value in (gte_filters or {}).items():
                query = query.gte(key, value)
            if order_by:
                query = query.order(order_by, desc=desc)
            if isinstance(limit, int) and limit > 0:
                query = query.limit(limit)
            response = query.execute()
            return [row for row in (response.data or []) if isinstance(row, dict)]
        except Exception as exc:
            self._handle_storage_exception(exc)
            return []

    def _select_single(
        self,
        table_name: str,
        *,
        eq_filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        desc: bool = True,
    ) -> Optional[Dict[str, Any]]:
        rows = self._select_rows(
            table_name,
            eq_filters=eq_filters,
            order_by=order_by,
            desc=desc,
            limit=1,
        )
        return rows[0] if rows else None

    def _insert_rows(self, table_name: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not rows:
            return []
        try:
            response = self.supabase.table(table_name).insert(rows).execute()
            return [row for row in (response.data or []) if isinstance(row, dict)]
        except Exception as exc:
            self._handle_storage_exception(exc)
            raise

    def _resolve_linked_user_id(
        self,
        anonymous_id: Optional[str],
        claimed_user_id: Optional[str] = None,
    ) -> Optional[str]:
        normalized_anonymous_id = self._normalize_text(anonymous_id, max_length=160)
        normalized_claimed_user_id = self._normalize_text(claimed_user_id, max_length=160)
        if normalized_anonymous_id:
            link = self._select_single(
                PUBLIC_IDENTITY_LINKS_TABLE,
                eq_filters={"anonymous_id": normalized_anonymous_id},
            )
            if link:
                linked_user_id = self._normalize_text(link.get("user_id"), max_length=160)
                if linked_user_id and (
                    not normalized_claimed_user_id or linked_user_id == normalized_claimed_user_id
                ):
                    return linked_user_id
        return normalized_claimed_user_id if normalized_claimed_user_id and not normalized_anonymous_id else None

    def derive_topic_tags(self, article: Dict[str, Any]) -> List[str]:
        parts: List[str] = []
        for key in ("title", "excerpt", "content_markdown", "seo_description", "therapist_name"):
            value = article.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(value.lower())
        therapist = article.get("therapist")
        if isinstance(therapist, dict):
            for item in therapist.get("specializations") or []:
                if isinstance(item, str) and item.strip():
                    parts.append(item.lower())
        haystack = " ".join(parts)
        matches = [
            tag
            for tag, keywords in TOPIC_RULES.items()
            if any(keyword in haystack for keyword in keywords)
        ]
        return matches[:4] if matches else ["Lang nghe ban than"]

    def alias_identity(self, *, user_id: str, anonymous_id: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        normalized_user_id = self._normalize_text(user_id, max_length=160)
        normalized_anonymous_id = self._normalize_text(anonymous_id, max_length=160)
        if not normalized_user_id or not normalized_anonymous_id:
            raise PublicContentValidationError("Thieu user_id hoac anonymous_id")
        existing = self._select_single(
            PUBLIC_IDENTITY_LINKS_TABLE,
            eq_filters={"anonymous_id": normalized_anonymous_id},
        )
        payload = {
            "anonymous_id": normalized_anonymous_id,
            "user_id": normalized_user_id,
            "latest_session_id": self._normalize_text(session_id, max_length=160),
            "updated_at": self._now(),
        }
        try:
            if existing:
                response = (
                    self.supabase.table(PUBLIC_IDENTITY_LINKS_TABLE)
                    .update(payload)
                    .eq("anonymous_id", normalized_anonymous_id)
                    .execute()
                )
                return response.data[0] if response.data else {**existing, **payload}
            response = self.supabase.table(PUBLIC_IDENTITY_LINKS_TABLE).insert(
                {
                    **payload,
                    "linked_at": self._now(),
                }
            ).execute()
            return response.data[0] if response.data else payload
        except Exception as exc:
            self._handle_storage_exception(exc)
            raise

    def log_public_events(
        self,
        *,
        anonymous_id: str,
        session_id: str,
        claimed_user_id: Optional[str],
        events: List[Dict[str, Any]],
    ) -> int:
        normalized_anonymous_id = self._normalize_text(anonymous_id, max_length=160)
        normalized_session_id = self._normalize_text(session_id, max_length=160)
        if not normalized_anonymous_id or not normalized_session_id:
            raise PublicContentValidationError("anonymous_id va session_id la bat buoc")
        resolved_user_id = self._resolve_linked_user_id(normalized_anonymous_id, claimed_user_id)
        rows: List[Dict[str, Any]] = []
        for event in events:
            event_type = self._normalize_text(event.get("event_type"), max_length=80)
            if event_type not in VALID_PUBLIC_EVENT_TYPES:
                continue
            rows.append(
                {
                    "anonymous_id": normalized_anonymous_id,
                    "session_id": normalized_session_id,
                    "user_id": resolved_user_id,
                    "event_type": event_type,
                    "article_slug": self._normalize_text(event.get("article_slug"), max_length=240),
                    "therapist_id": self._normalize_text(event.get("therapist_id"), max_length=160),
                    "topic_tags": self._normalize_tags(event.get("topic_tags")),
                    "read_depth_percent": self._normalize_read_depth(event.get("read_depth_percent")),
                    "referrer": self._normalize_text(event.get("referrer"), max_length=500),
                    "source_path": self._normalize_text(event.get("source_path"), max_length=240),
                    "utm_source": self._normalize_text(event.get("utm_source"), max_length=120),
                    "utm_campaign": self._normalize_text(event.get("utm_campaign"), max_length=160),
                    "metadata": event.get("metadata") if isinstance(event.get("metadata"), dict) else {},
                    "occurred_at": self._normalize_text(event.get("occurred_at"), max_length=80) or self._now(),
                    "created_at": self._now(),
                }
            )
        if not rows:
            return 0
        self._insert_rows(PUBLIC_EVENTS_TABLE, rows)
        return len(rows)

    def _recent_reason_tags(
        self,
        *,
        anonymous_id: Optional[str],
        user_id: Optional[str],
        article_slug: Optional[str],
    ) -> List[str]:
        tag_counter: Counter[str] = Counter()
        if article_slug:
            try:
                current_article = self.article_service.get_public_article(article_slug)
            except Exception:
                current_article = None
            if current_article:
                for tag in self.derive_topic_tags(current_article):
                    tag_counter[tag] += 3
        month_start = self._month_start()
        normalized_anonymous_id = self._normalize_text(anonymous_id, max_length=160)
        if normalized_anonymous_id:
            for row in self._select_rows(
                PUBLIC_EVENTS_TABLE,
                eq_filters={"anonymous_id": normalized_anonymous_id},
                gte_filters={"occurred_at": month_start},
                order_by="occurred_at",
                desc=True,
                limit=80,
            ):
                for tag in self._normalize_tags(row.get("topic_tags")):
                    tag_counter[tag] += 2 if row.get("event_type") == "article_read_depth" else 1
        if user_id:
            for row in self._select_rows(
                PUBLIC_EVENTS_TABLE,
                eq_filters={"user_id": user_id},
                gte_filters={"occurred_at": month_start},
                order_by="occurred_at",
                desc=True,
                limit=80,
            ):
                for tag in self._normalize_tags(row.get("topic_tags")):
                    tag_counter[tag] += 1
        return [tag for tag, _count in tag_counter.most_common(4)] or ["Lang nghe ban than"]

    def recommend_articles(
        self,
        *,
        article_slug: str,
        anonymous_id: Optional[str] = None,
        claimed_user_id: Optional[str] = None,
        limit: int = 3,
    ) -> Dict[str, Any]:
        current_article = self.article_service.get_public_article(article_slug)
        if not current_article:
            raise PublicContentValidationError("Khong tim thay bai viet")
        resolved_user_id = self._resolve_linked_user_id(anonymous_id, claimed_user_id)
        reason_tags = self._recent_reason_tags(
            anonymous_id=anonymous_id,
            user_id=resolved_user_id,
            article_slug=article_slug,
        )
        candidates = self.article_service.list_public_articles(limit=24)
        scored = []
        for article in candidates:
            if self._normalize_text(article.get("slug"), max_length=240) == article_slug:
                continue
            tags = self.derive_topic_tags(article)
            score = sum(4 for tag in reason_tags if tag in tags)
            article_text = " ".join(tags + [str(article.get("title") or ""), str(article.get("excerpt") or "")]).lower()
            score += sum(1 for tag in reason_tags if tag.lower() in article_text)
            if article.get("published_at"):
                score += 1
            if score > 0:
                scored.append((score, article))
        scored.sort(key=lambda item: item[0], reverse=True)
        return {
            "recommended_articles": [article for _score, article in scored[:limit]],
            "reason_tags": reason_tags,
        }

    def recommend_therapists(
        self,
        *,
        article_slug: str,
        anonymous_id: Optional[str] = None,
        claimed_user_id: Optional[str] = None,
        limit: int = 3,
    ) -> Dict[str, Any]:
        current_article = self.article_service.get_public_article(article_slug)
        if not current_article:
            raise PublicContentValidationError("Khong tim thay bai viet")
        resolved_user_id = self._resolve_linked_user_id(anonymous_id, claimed_user_id)
        reason_tags = self._recent_reason_tags(
            anonymous_id=anonymous_id,
            user_id=resolved_user_id,
            article_slug=article_slug,
        )
        current_therapist_id = self._normalize_text(current_article.get("therapist_id"), max_length=160)
        candidates = self.profile_service.get_public_therapists(limit=24)
        scored = []
        for therapist in candidates:
            therapist_id = self._normalize_text(therapist.get("therapist_id"), max_length=160)
            if current_therapist_id and therapist_id == current_therapist_id:
                continue
            haystack = " ".join(
                [
                    str(therapist.get("display_name") or ""),
                    str(therapist.get("headline") or ""),
                    str(therapist.get("bio") or ""),
                    " ".join(therapist.get("specializations") or []),
                ]
            ).lower()
            score = sum(4 for tag in reason_tags if tag.lower() in haystack)
            if therapist.get("accepting_new_clients") is True:
                score += 2
            if therapist.get("can_receive_contact_requests") is True:
                score += 1
            if therapist.get("is_verified") is True:
                score += 1
            if score > 0:
                scored.append((score, therapist))
        scored.sort(key=lambda item: item[0], reverse=True)
        return {
            "recommended_therapists": [therapist for _score, therapist in scored[:limit]],
            "reason_tags": reason_tags,
        }

    def _quota_limit_for_user(self, user_id: Optional[str]) -> tuple[int, str]:
        anonymous_quota = max(1, self._safe_int_env("PUBLIC_ARTICLE_AI_ANON_QUOTA", 3))
        authenticated_quota = max(anonymous_quota, self._safe_int_env("PUBLIC_ARTICLE_AI_AUTH_QUOTA", 12))
        entitled_quota = max(authenticated_quota, self._safe_int_env("PUBLIC_ARTICLE_AI_PLUS_QUOTA", 40))
        normalized_user_id = self._normalize_text(user_id, max_length=160)
        if not normalized_user_id:
            return anonymous_quota, "anonymous_monthly"
        entitlements = self._select_rows(
            USER_ENTITLEMENTS_TABLE,
            eq_filters={"user_id": normalized_user_id, "is_active": True},
            order_by="updated_at",
            desc=True,
            limit=10,
        )
        now_value = self._now()
        for entitlement in entitlements:
            feature_key = self._normalize_text(entitlement.get("feature_key"), max_length=120) or ""
            if feature_key not in {"article_ai_plus", "miru_plus", "app_plus"}:
                continue
            starts_at = self._normalize_text(entitlement.get("starts_at"), max_length=80)
            ends_at = self._normalize_text(entitlement.get("ends_at"), max_length=80)
            if starts_at and starts_at > now_value:
                continue
            if ends_at and ends_at < now_value:
                continue
            try:
                return max(authenticated_quota, int(entitlement.get("monthly_quota") or entitled_quota)), "entitled_monthly"
            except Exception:
                return entitled_quota, "entitled_monthly"
        return authenticated_quota, "signed_in_monthly"

    def get_quota_state(self, *, anonymous_id: str, claimed_user_id: Optional[str]) -> Dict[str, Any]:
        resolved_user_id = self._resolve_linked_user_id(anonymous_id, claimed_user_id)
        limit, quota_scope = self._quota_limit_for_user(resolved_user_id)
        month_start = self._month_start()
        rows = self._select_rows(
            PUBLIC_AI_MESSAGES_TABLE,
            eq_filters={"anonymous_id": self._normalize_text(anonymous_id, max_length=160), "role": "user"},
            gte_filters={"created_at": month_start},
            order_by="created_at",
            desc=True,
            limit=200,
        )
        if resolved_user_id:
            rows.extend(
                self._select_rows(
                    PUBLIC_AI_MESSAGES_TABLE,
                    eq_filters={"user_id": resolved_user_id, "role": "user"},
                    gte_filters={"created_at": month_start},
                    order_by="created_at",
                    desc=True,
                    limit=200,
                )
            )
        used = len({str(row.get("id")) for row in rows if row.get("id") is not None})
        return {
            "user_id": resolved_user_id,
            "limit": limit,
            "used": used,
            "remaining": max(0, limit - used),
            "quota_scope": quota_scope,
            "is_authenticated": bool(resolved_user_id),
            "upgrade_prompt": (
                "Quota cua ban dang duoc mo rong theo goi Miru trong app."
                if quota_scope == "entitled_monthly"
                else "Dang nhap de mo them quota hoi dap trong bai viet."
                if not resolved_user_id
                else "Ban dang dung quota nguoi dung Miru trong thang nay."
            ),
        }

    def _ensure_ai_session(
        self,
        *,
        article_slug: str,
        anonymous_id: str,
        claimed_user_id: Optional[str],
        requested_session_id: Optional[str],
    ) -> tuple[Dict[str, Any], Dict[str, Any]]:
        quota_state = self.get_quota_state(anonymous_id=anonymous_id, claimed_user_id=claimed_user_id)
        session_id = self._normalize_text(requested_session_id, max_length=160) or str(uuid4())
        existing = self._select_single(PUBLIC_AI_SESSIONS_TABLE, eq_filters={"session_id": session_id})
        payload = {
            "anonymous_id": anonymous_id,
            "user_id": quota_state["user_id"],
            "article_slug": article_slug,
            "quota_scope": quota_state["quota_scope"],
            "updated_at": self._now(),
        }
        try:
            if existing:
                response = (
                    self.supabase.table(PUBLIC_AI_SESSIONS_TABLE)
                    .update(payload)
                    .eq("session_id", session_id)
                    .execute()
                )
                session_row = response.data[0] if response.data else {**existing, **payload}
            else:
                response = self.supabase.table(PUBLIC_AI_SESSIONS_TABLE).insert(
                    {
                        "session_id": session_id,
                        **payload,
                        "created_at": self._now(),
                        "last_message_at": None,
                    }
                ).execute()
                session_row = response.data[0] if response.data else {"session_id": session_id, **payload}
        except Exception as exc:
            self._handle_storage_exception(exc)
            raise
        return session_row, quota_state

    async def start_article_ai_session(
        self,
        *,
        article_slug: str,
        anonymous_id: str,
        session_id: Optional[str],
        claimed_user_id: Optional[str],
    ) -> Dict[str, Any]:
        if not self.article_service.get_public_article(article_slug):
            raise PublicContentValidationError("Khong tim thay bai viet")
        normalized_anonymous_id = self._normalize_text(anonymous_id, max_length=160)
        if not normalized_anonymous_id:
            raise PublicContentValidationError("anonymous_id la bat buoc")
        session_row, quota_state = self._ensure_ai_session(
            article_slug=article_slug,
            anonymous_id=normalized_anonymous_id,
            claimed_user_id=claimed_user_id,
            requested_session_id=session_id,
        )
        try:
            self.log_public_events(
                anonymous_id=normalized_anonymous_id,
                session_id=str(session_row.get("session_id") or ""),
                claimed_user_id=quota_state["user_id"],
                events=[
                    {
                        "event_type": "article_ai_session_started",
                        "article_slug": article_slug,
                        "metadata": {
                            "quota_scope": quota_state["quota_scope"],
                        },
                    }
                ],
            )
        except Exception:
            pass
        return {
            "session_id": session_row.get("session_id"),
            "remaining_quota": quota_state["remaining"],
            "quota_scope": quota_state["quota_scope"],
            "is_authenticated": quota_state["is_authenticated"],
            "upgrade_prompt": quota_state["upgrade_prompt"],
        }

    def _recent_session_history(self, session_id: str, limit: int = 8) -> List[Dict[str, str]]:
        rows = self._select_rows(
            PUBLIC_AI_MESSAGES_TABLE,
            eq_filters={"session_id": session_id},
            order_by="created_at",
            desc=True,
            limit=max(limit, 1),
        )
        history: List[Dict[str, str]] = []
        for row in reversed(rows[-limit:]):
            content = self._normalize_text(row.get("content"), max_length=2000)
            if content:
                history.append(
                    {
                        "role": "assistant" if row.get("role") == "assistant" else "user",
                        "content": content,
                    }
                )
        return history

    async def send_article_ai_message(
        self,
        *,
        article_slug: str,
        anonymous_id: str,
        session_id: Optional[str],
        claimed_user_id: Optional[str],
        message: str,
    ) -> Dict[str, Any]:
        article = self.article_service.get_public_article(article_slug)
        if not article:
            raise PublicContentValidationError("Khong tim thay bai viet")
        normalized_anonymous_id = self._normalize_text(anonymous_id, max_length=160)
        normalized_message = self._normalize_text(message, max_length=2000)
        if not normalized_anonymous_id or not normalized_message:
            raise PublicContentValidationError("Thieu anonymous_id hoac message")
        session_row, quota_state = self._ensure_ai_session(
            article_slug=article_slug,
            anonymous_id=normalized_anonymous_id,
            claimed_user_id=claimed_user_id,
            requested_session_id=session_id,
        )
        session_id_value = str(session_row.get("session_id") or uuid4())
        if quota_state["remaining"] <= 0:
            try:
                self.log_public_events(
                    anonymous_id=normalized_anonymous_id,
                    session_id=session_id_value,
                    claimed_user_id=quota_state["user_id"],
                    events=[
                        {
                            "event_type": "article_ai_quota_exhausted",
                            "article_slug": article_slug,
                            "metadata": {
                                "quota_scope": quota_state["quota_scope"],
                            },
                        }
                    ],
                )
            except Exception:
                pass
            return {
                "session_id": session_id_value,
                "reply": None,
                "remaining_quota": 0,
                "quota_scope": quota_state["quota_scope"],
                "is_authenticated": quota_state["is_authenticated"],
                "upgrade_prompt": quota_state["upgrade_prompt"],
                "exhausted": True,
            }
        user_id_value = quota_state["user_id"]
        self._insert_rows(
            PUBLIC_AI_MESSAGES_TABLE,
            [
                {
                    "session_id": session_id_value,
                    "anonymous_id": normalized_anonymous_id,
                    "user_id": user_id_value,
                    "article_slug": article_slug,
                    "role": "user",
                    "content": normalized_message,
                    "created_at": self._now(),
                }
            ],
        )
        try:
            self.log_public_events(
                anonymous_id=normalized_anonymous_id,
                session_id=session_id_value,
                claimed_user_id=user_id_value,
                events=[
                    {
                        "event_type": "article_ai_message_sent",
                        "article_slug": article_slug,
                        "metadata": {
                            "message_length": len(normalized_message),
                            "quota_scope": quota_state["quota_scope"],
                        },
                    }
                ],
            )
        except Exception:
            pass
        history = self._recent_session_history(session_id_value, limit=8)
        topic_tags = self.derive_topic_tags(article)
        therapist_suggestions = self.recommend_therapists(
            article_slug=article_slug,
            anonymous_id=normalized_anonymous_id,
            claimed_user_id=user_id_value,
            limit=2,
        )["recommended_therapists"]
        therapist_lines = []
        for therapist in therapist_suggestions:
            name = self._normalize_text(therapist.get("display_name"), max_length=120)
            if not name:
                continue
            specs = ", ".join(self._normalize_tags(therapist.get("specializations")))
            therapist_lines.append(f"- {name}: {specs or 'co the ho tro chu de nay'}")
        prompt = (
            "Ban la Miru mini companion trong bai viet kien thuc suc khoe tinh than.\n"
            "- Tra loi bang tieng Viet, ngan, am, khong chan doan.\n"
            "- Bam vao chu de cua bai viet va cau hoi hien tai.\n"
            "- Neu hop ly, goi y mot buoc nho hoac mot therapist phu hop.\n\n"
            f"Tieu de bai viet: {article.get('title')}\n"
            f"Tom tat: {article.get('excerpt') or article.get('seo_description') or ''}\n"
            f"Chu de: {', '.join(topic_tags)}\n"
            f"Therapist lien quan:\n{os.linesep.join(therapist_lines) if therapist_lines else '- Chua co goi y therapist cu the'}\n\n"
            f"Cau hoi cua nguoi dung: {normalized_message}"
        )
        ai_reply = await get_summarizer_service().generate_response(prompt, history=history[:-1] if history else None)
        normalized_reply = self._normalize_text(ai_reply, max_length=2400) or (
            "Miru dang thay chu de nay can duoc di cham lai mot chut. Neu ban muon, minh co the cung ban goi ten dieu dang cham toi ban nhat va goi y mot buoc nho tiep theo."
        )
        self._insert_rows(
            PUBLIC_AI_MESSAGES_TABLE,
            [
                {
                    "session_id": session_id_value,
                    "anonymous_id": normalized_anonymous_id,
                    "user_id": user_id_value,
                    "article_slug": article_slug,
                    "role": "assistant",
                    "content": normalized_reply,
                    "created_at": self._now(),
                }
            ],
        )
        try:
            self.supabase.table(PUBLIC_AI_SESSIONS_TABLE).update(
                {
                    "user_id": user_id_value,
                    "quota_scope": quota_state["quota_scope"],
                    "updated_at": self._now(),
                    "last_message_at": self._now(),
                }
            ).eq("session_id", session_id_value).execute()
        except Exception:
            pass
        after_quota = self.get_quota_state(
            anonymous_id=normalized_anonymous_id,
            claimed_user_id=user_id_value,
        )
        return {
            "session_id": session_id_value,
            "reply": normalized_reply,
            "remaining_quota": after_quota["remaining"],
            "quota_scope": after_quota["quota_scope"],
            "is_authenticated": after_quota["is_authenticated"],
            "upgrade_prompt": after_quota["upgrade_prompt"],
            "exhausted": False,
        }

    def list_my_article_analytics(self, user_id: str) -> Dict[str, Any]:
        articles = self.article_service.list_my_articles(user_id)
        article_by_slug = {
            str(article.get("slug")): article
            for article in articles
            if isinstance(article, dict) and article.get("slug")
        }
        slugs = list(article_by_slug.keys())
        if not slugs:
            return {"available": True, "analytics": []}
        event_rows = self._select_rows(
            PUBLIC_EVENTS_TABLE,
            in_filters={"article_slug": slugs},
            order_by="occurred_at",
            desc=True,
            limit=500,
        )
        ai_messages = self._select_rows(
            PUBLIC_AI_MESSAGES_TABLE,
            in_filters={"article_slug": slugs},
            order_by="created_at",
            desc=True,
            limit=500,
        )
        ai_sessions = self._select_rows(
            PUBLIC_AI_SESSIONS_TABLE,
            in_filters={"article_slug": slugs},
            order_by="updated_at",
            desc=True,
            limit=300,
        )
        try:
            contact_rows = self._select_rows(
                "therapist_contact_requests",
                in_filters={"source_article_slug": slugs},
                order_by="created_at",
                desc=True,
                limit=300,
            )
        except Exception:
            contact_rows = []
        analytics: List[Dict[str, Any]] = []
        for slug in slugs:
            article = article_by_slug[slug]
            article_events = [row for row in event_rows if row.get("article_slug") == slug]
            article_ai_messages = [row for row in ai_messages if row.get("article_slug") == slug]
            article_ai_sessions = [row for row in ai_sessions if row.get("article_slug") == slug]
            article_contacts = [
                row
                for row in contact_rows
                if self._normalize_text(row.get("source_article_slug"), max_length=240) == slug
            ]
            engaged_readers = {
                f"{row.get('anonymous_id')}::{row.get('session_id')}"
                for row in article_events
                if row.get("event_type") == "article_read_depth" and (row.get("read_depth_percent") or 0) >= 50
            }
            source_counter: Counter[str] = Counter()
            topic_counter: Counter[str] = Counter()
            for row in article_events:
                metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
                if row.get("event_type") in {"article_to_profile_click", "therapist_contact_request_started"}:
                    source_counter[self._normalize_text(metadata.get("source"), max_length=80) or "article"] += 1
                for tag in self._normalize_tags(row.get("topic_tags")):
                    topic_counter[tag] += 1
            for row in article_contacts:
                source_counter[self._normalize_text(row.get("source"), max_length=80) or "article"] += 1
            analytics.append(
                {
                    "article_id": article.get("id"),
                    "article_slug": slug,
                    "view_count": sum(1 for row in article_events if row.get("event_type") == "article_view"),
                    "engaged_read_count": len(engaged_readers),
                    "profile_click_count": sum(1 for row in article_events if row.get("event_type") == "article_to_profile_click"),
                    "contact_request_count": len(article_contacts),
                    "pairing_count": sum(1 for row in article_contacts if self._normalize_text(row.get("funnel_status"), max_length=40) == "paired"),
                    "ai_session_count": len({str(row.get("session_id")) for row in article_ai_sessions if row.get("session_id")}),
                    "ai_message_count": sum(1 for row in article_ai_messages if self._normalize_text(row.get("role"), max_length=20) == "user"),
                    "login_prompt_click_count": sum(1 for row in article_events if row.get("event_type") == "article_ai_login_prompt_clicked"),
                    "top_topics": [
                        {"tag": tag, "label": tag, "count": count}
                        for tag, count in topic_counter.most_common(6)
                    ],
                    "attribution_sources": [
                        {
                            "source": source,
                            "label": SOURCE_LABELS.get(source, source.replace("_", " ")),
                            "count": count,
                        }
                        for source, count in source_counter.most_common(6)
                    ],
                    "last_activity_at": max(
                        [
                            value
                            for value in [
                                *[row.get("occurred_at") for row in article_events],
                                *[row.get("created_at") for row in article_ai_messages],
                                *[row.get("updated_at") for row in article_ai_sessions],
                                *[row.get("created_at") for row in article_contacts],
                            ]
                            if isinstance(value, str) and value
                        ],
                        default=None,
                    ),
                }
            )
        return {"available": True, "analytics": analytics}


_public_content_service: Optional[PublicContentService] = None


def get_public_content_service() -> PublicContentService:
    global _public_content_service
    if _public_content_service is None:
        _public_content_service = PublicContentService()
    return _public_content_service

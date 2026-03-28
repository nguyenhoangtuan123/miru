"""Semantic article recommendation for the app chat flow.

Uses Gemini gemini-embedding-001 embeddings + Supabase vector search
(RPC ``match_therapist_articles``) to find published articles whose
content is semantically close to the chat conversation.

Replaces the earlier keyword-based scoring approach.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from supabase import create_client, Client

from embedding_service import get_query_embedding

# Reuse topic rules only for reason_text generation (not for matching).
from article_service import ARTICLE_TOPIC_RULES

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_supabase: Optional[Client] = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "").strip().strip('"').strip("'")
        key = os.environ.get("SUPABASE_KEY", "").strip().strip('"').strip("'")
        _supabase = create_client(url, key)
    return _supabase


_TAG_LABELS: Dict[str, str] = {
    "Lo au": "lo âu",
    "Burnout": "kiệt sức",
    "Moi quan he": "mối quan hệ",
    "Tu cham soc": "tự chăm sóc",
    "Tu ti": "tự ti",
    "Mo loi": "mở lời",
    "Lang nghe ban than": "lắng nghe bản thân",
}


def _build_reason_text(topic_tags: List[str]) -> str:
    """Create a short Vietnamese reason string from the article's tags."""
    if not topic_tags:
        return "Có nội dung gần với điều bạn vừa chia sẻ"
    labels = [_TAG_LABELS.get(t, t) for t in topic_tags[:2]]
    if len(labels) == 1:
        return f"Liên quan đến {labels[0]}"
    return f"Liên quan đến {labels[0]} và {labels[1]}"


def _fetch_therapist_name(therapist_id: str) -> Optional[str]:
    """Best-effort fetch of therapist display_name."""
    try:
        resp = (
            _get_supabase()
            .table("therapists")
            .select("display_name")
            .eq("id", therapist_id)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0].get("display_name")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def recommend_for_chat(
    user_message: str,
    ai_message: str,
    *,
    max_results: int = 3,
    match_threshold: float = 0.65,
) -> List[Dict[str, Any]]:
    """Return up to *max_results* semantically relevant article suggestions.

    Each item is a dict with keys:
        id, slug, title, excerpt, cover_image_url,
        therapist_name, topic_tags, reason_text
    """
    query_text = f"{user_message}\n{ai_message}"
    # Truncate to avoid huge embedding inputs
    if len(query_text) > 1500:
        query_text = query_text[:1500]

    try:
        query_embedding = get_query_embedding(query_text)
    except Exception as exc:
        print(f"[chat_recommender] Embedding failed: {exc}")
        return []

    # A zero vector means the embedding API failed — skip search.
    if all(v == 0.0 for v in query_embedding[:10]):
        return []

    try:
        resp = _get_supabase().rpc(
            "match_therapist_articles",
            {
                "query_embedding": query_embedding,
                "match_count": max_results,
                "match_threshold": match_threshold,
            },
        ).execute()
    except Exception as exc:
        print(f"[chat_recommender] RPC search failed: {exc}")
        return []

    if not resp.data:
        return []

    results: List[Dict[str, Any]] = []
    for row in resp.data:
        therapist_id = row.get("therapist_id") or ""
        therapist_name = _fetch_therapist_name(therapist_id) if therapist_id else None

        # Derive topic_tags from article content for display
        topic_tags = _derive_display_tags(row)

        results.append(
            {
                "id": row.get("id"),
                "slug": row.get("slug") or "",
                "title": row.get("title") or "Bài viết Miru",
                "excerpt": row.get("excerpt"),
                "cover_image_url": row.get("cover_image_url"),
                "therapist_name": therapist_name,
                "topic_tags": topic_tags[:4],
                "reason_text": _build_reason_text(topic_tags),
            }
        )

    return results


def _derive_display_tags(row: Dict[str, Any]) -> List[str]:
    """Lightweight tag derivation for display purposes only."""
    haystack = " ".join(
        str(row.get(k) or "") for k in ("title", "excerpt", "seo_description")
    ).lower()

    import unicodedata

    def _strip(text: str) -> str:
        text = text.replace("đ", "d").replace("Đ", "D")
        nfd = unicodedata.normalize("NFD", text)
        return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")

    haystack = _strip(haystack)
    return [
        tag
        for tag, keywords in ARTICLE_TOPIC_RULES.items()
        if any(kw in haystack for kw in keywords)
    ]

"""Shared embedding helper using Google Gemini gemini-embedding-001.

Provides a single place to generate embeddings that both
``article_service`` and ``chat_article_recommender`` can import.
Uses the new ``google-genai`` SDK (``google.genai``).
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Client (lazy singleton)
# ---------------------------------------------------------------------------

_client: Optional[genai.Client] = None

_EMBED_MODEL = "gemini-embedding-001"
_DIMENSIONS = 768


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
        _client = genai.Client(api_key=api_key)
    return _client


# ---------------------------------------------------------------------------
# Core embedding functions
# ---------------------------------------------------------------------------


def get_embedding(text: str, *, task_type: str = "RETRIEVAL_DOCUMENT") -> List[float]:
    """Return a 768-dim embedding for *text*, or a zero vector on failure."""
    try:
        result = _get_client().models.embed_content(
            model=_EMBED_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                output_dimensionality=_DIMENSIONS,
                task_type=task_type,
            ),
        )
        return list(result.embeddings[0].values)
    except Exception as exc:
        print(f"[embedding_service] Error getting embedding: {exc}")
        return [0.0] * _DIMENSIONS


def get_query_embedding(text: str) -> List[float]:
    """Convenience wrapper using RETRIEVAL_QUERY task type."""
    return get_embedding(text, task_type="RETRIEVAL_QUERY")


# ---------------------------------------------------------------------------
# Article-specific helpers
# ---------------------------------------------------------------------------

_MD_STRIP_RE = re.compile(r"[#*_`>\[\]()!|~]")


def _strip_markdown(text: str, max_len: int = 2000) -> str:
    """Remove common markdown syntax and truncate."""
    cleaned = _MD_STRIP_RE.sub(" ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_len]


def build_article_embed_text(article: Dict[str, Any]) -> str:
    """Build a single text blob from article fields for embedding.

    Includes title, excerpt, seo_description, stripped content,
    topic_tags and therapist specializations.
    """
    parts: List[str] = []

    for key in ("title", "excerpt", "seo_description"):
        val = article.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val.strip())

    content = article.get("content_markdown")
    if isinstance(content, str) and content.strip():
        parts.append(_strip_markdown(content))

    tags = article.get("topic_tags")
    if isinstance(tags, list):
        parts.append(", ".join(str(t) for t in tags if t))

    therapist = article.get("therapist")
    if isinstance(therapist, dict):
        specs = therapist.get("specializations")
        if isinstance(specs, list):
            parts.append(", ".join(str(s) for s in specs if s))

    return "\n".join(parts)

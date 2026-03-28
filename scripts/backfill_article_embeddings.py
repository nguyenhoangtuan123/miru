"""Backfill embeddings for published therapist articles.

Idempotent: skips articles that already have a non-null embedding.
Rate-limited to avoid Gemini API throttling (1 req/sec).

Usage:
    cd d:/miru_-main
    python scripts/backfill_article_embeddings.py
"""

from __future__ import annotations

import os
import sys
import time

# Ensure the src directory is on the import path.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from supabase import create_client
from embedding_service import get_embedding, build_article_embed_text
from article_service import get_article_service


def main() -> None:
    url = os.environ.get("SUPABASE_URL", "").strip().strip('"').strip("'")
    key = os.environ.get("SUPABASE_KEY", "").strip().strip('"').strip("'")
    if not url or not key:
        print("[ERROR] SUPABASE_URL and SUPABASE_KEY must be set in .env")
        sys.exit(1)

    sb = create_client(url, key)

    # Fetch published articles without embeddings
    resp = (
        sb.table("therapist_articles")
        .select("id, title, slug, excerpt, content_markdown, seo_description, therapist_id, status, published_at")
        .eq("status", "published")
        .is_("embedding", "null")
        .order("published_at", desc=True)
        .execute()
    )

    articles = resp.data or []
    total = len(articles)
    if total == 0:
        print("[OK] All published articles already have embeddings. Nothing to do.")
        return

    print(f"[START] Backfilling {total} article(s)...\n")

    svc = get_article_service()
    success = 0
    skipped = 0

    for i, article in enumerate(articles, 1):
        article_id = article.get("id")
        title = article.get("title", "???")[:60]

        # Re-serialize to get topic_tags and therapist info
        try:
            full_row_resp = (
                sb.table("therapist_articles")
                .select("*")
                .eq("id", article_id)
                .limit(1)
                .execute()
            )
            if not full_row_resp.data:
                print(f"  [{i}/{total}] SKIP: Article {article_id} not found")
                skipped += 1
                continue

            full_row = full_row_resp.data[0]
            serialized = svc._serialize_article(full_row)
            text = build_article_embed_text(serialized)

            if not text.strip():
                print(f"  [{i}/{total}] SKIP: Empty text for \"{title}\"")
                skipped += 1
                continue

            embedding = get_embedding(text, task_type="RETRIEVAL_DOCUMENT")

            # Check for zero vector (API failure)
            if all(v == 0.0 for v in embedding[:10]):
                print(f"  [{i}/{total}] FAIL: Zero embedding for \"{title}\"")
                skipped += 1
                continue

            sb.table("therapist_articles").update(
                {"embedding": embedding}
            ).eq("id", article_id).execute()

            success += 1
            print(f"  [{i}/{total}] OK: \"{title}\"")

        except Exception as exc:
            print(f"  [{i}/{total}] ERROR: \"{title}\" — {exc}")
            skipped += 1

        # Rate limit: 1 request per second
        if i < total:
            time.sleep(1.0)

    print(f"\n[DONE] {success} embedded, {skipped} skipped out of {total} total.")


if __name__ == "__main__":
    main()

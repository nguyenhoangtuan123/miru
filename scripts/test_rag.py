"""Quick test for semantic article retrieval (RAG).

Usage:
    cd d:/miru_-main
    $env:PYTHONIOENCODING='utf-8'; python scripts/test_rag.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from supabase import create_client
from embedding_service import get_query_embedding

url = os.environ["SUPABASE_URL"].strip().strip('"')
key = os.environ["SUPABASE_KEY"].strip().strip('"')
sb = create_client(url, key)

TEST_QUERIES = [
    "công nghệ trị liệu tâm lý",            # should match the published article
    "ứng dụng AI trong chăm sóc sức khỏe",   # semantically related
    "xin chào bạn khỏe không",               # generic greeting — should NOT match
    "lo âu và trầm cảm",                     # mental health topic
]

print("=" * 60)
print("SEMANTIC ARTICLE RETRIEVAL TEST")
print("=" * 60)

for query in TEST_QUERIES:
    print(f"\n--- Query: \"{query}\"")
    try:
        embedding = get_query_embedding(query)
        result = sb.rpc("match_therapist_articles", {
            "query_embedding": embedding,
            "match_count": 3,
            "match_threshold": 0.65,
        }).execute()

        if result.data:
            for art in result.data:
                sim = art.get("similarity", 0)
                title = art.get("title", "???")
                print(f"    -> [{sim:.3f}] {title}")
        else:
            print("    -> (no matches above threshold 0.35)")
    except Exception as e:
        print(f"    -> ERROR: {e}")

print("\n" + "=" * 60)
print("DONE")

import base64
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from dotenv import load_dotenv
from supabase import Client, create_client

from therapist_service import get_therapist_service

load_dotenv()

VERIFICATION_BUCKET = "therapist-verification-docs"
VERIFICATION_DOCS_TABLE = "therapist_verification_documents"
VERIFICATION_STATUSES = {"not_submitted", "pending", "approved", "rejected"}
SIGNED_URL_TTL_SECONDS = 60 * 60


class TherapistVerificationService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.therapist_service = get_therapist_service()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _safe_filename(self, filename: str) -> str:
        return re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)

    def _ensure_bucket(self) -> None:
        try:
            self.supabase.storage.create_bucket(VERIFICATION_BUCKET, options={"public": False})
        except Exception:
            pass

    def _signed_url(self, path: str) -> Optional[str]:
        try:
            signed = self.supabase.storage.from_(VERIFICATION_BUCKET).create_signed_url(
                path,
                SIGNED_URL_TTL_SECONDS,
            )
        except Exception:
            return None

        if isinstance(signed, dict):
            return signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
        return getattr(signed, "signedURL", None)

    def _media_id(self, path: str) -> str:
        raw = f"{VERIFICATION_BUCKET}:{path}".encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")

    def _decode_media_id(self, media_id: str) -> Optional[str]:
        padded = media_id + "=" * (-len(media_id) % 4)
        try:
            decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        except Exception:
            return None
        bucket_name, _, path = decoded.partition(":")
        if bucket_name != VERIFICATION_BUCKET or not path:
            return None
        return path

    def _validate_file(self, filename: str, mime_type: Optional[str], size: int) -> None:
        extension = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
        allowed_mime_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
        }

        if size <= 0:
            raise ValueError("Uploaded file is empty")
        if size > 10 * 1024 * 1024:
            raise ValueError("Uploaded file exceeds the 10 MB limit")
        if extension not in allowed_extensions and (mime_type or "").lower() not in allowed_mime_types:
            raise ValueError("Unsupported verification document type")

    def _therapist_row(self, user_id: str, email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        return self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)

    def is_admin_reviewer(self, email: str) -> bool:
        normalized = email.strip().lower()
        if not normalized:
            return False
        allowlist = {
            item.strip().lower()
            for item in os.getenv("ADMIN_REVIEWER_EMAILS", "").split(",")
            if item.strip()
        }
        return normalized in allowlist

    def therapist_status(self, user_id: str) -> Optional[str]:
        therapist = self.therapist_service.get_therapist(user_id)
        if not therapist:
            return None
        status = therapist.get("verification_status")
        if isinstance(status, str) and status in VERIFICATION_STATUSES:
            return status
        if therapist.get("is_verified"):
            return "approved"
        return "not_submitted"

    def can_access_portal(self, user_id: str) -> bool:
        return self.therapist_status(user_id) == "approved"

    def has_therapist_role(self, user_id: str) -> bool:
        try:
            response = (
                self.supabase.table("user_profiles")
                .select("role")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if response.data and response.data[0].get("role") == "therapist":
                return True
        except Exception:
            pass

        therapist = self.therapist_service.get_therapist(user_id)
        return therapist is not None

    def _serialize_document(self, row: Dict[str, Any]) -> Dict[str, Any]:
        path = row.get("file_path")
        if not isinstance(path, str) or not path:
            return {
                "id": str(row.get("id") or ""),
                "file_name": row.get("file_name"),
                "mime_type": row.get("mime_type"),
                "size_bytes": row.get("size_bytes"),
                "uploaded_at": row.get("uploaded_at"),
                "url": None,
                "media_id": None,
            }
        return {
            "id": str(row.get("id") or ""),
            "file_name": row.get("file_name") or Path(path).name,
            "mime_type": row.get("mime_type"),
            "size_bytes": row.get("size_bytes"),
            "uploaded_at": row.get("uploaded_at"),
            "url": self._signed_url(path),
            "media_id": self._media_id(path),
        }

    def _fetch_exact_therapist_row(self, therapist_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("therapists")
                .select("*")
                .eq("id", therapist_id)
                .limit(1)
                .execute()
            )
        except Exception:
            return None
        return response.data[0] if response.data else None

    def _related_review_rows(self, therapist_row: Dict[str, Any]) -> List[Dict[str, Any]]:
        related: List[Dict[str, Any]] = []
        user_id = therapist_row.get("user_id")
        email = therapist_row.get("email")

        if isinstance(user_id, str) and user_id:
            try:
                response = self.supabase.table("therapists").select("*").eq("user_id", user_id).execute()
                related.extend(response.data or [])
            except Exception:
                pass

        if isinstance(email, str) and email:
            try:
                response = self.supabase.table("therapists").select("*").eq("email", email).execute()
                related.extend(response.data or [])
            except Exception:
                pass

        related.append(therapist_row)
        deduped: Dict[str, Dict[str, Any]] = {}
        for row in related:
            if not isinstance(row, dict):
                continue
            row_id = row.get("id")
            if isinstance(row_id, str) and row_id:
                deduped[row_id] = row
        return list(deduped.values())

    def _review_group_key(self, row: Dict[str, Any]) -> str:
        user_id = row.get("user_id")
        if isinstance(user_id, str) and user_id:
            return f"user:{user_id}"
        email = row.get("email")
        if isinstance(email, str) and email.strip():
            return f"email:{email.strip().lower()}"
        row_id = row.get("id")
        return f"id:{row_id}" if isinstance(row_id, str) and row_id else f"fallback:{id(row)}"

    def _review_row_priority(self, row: Dict[str, Any]) -> Tuple[int, int, int, int, int, str]:
        status = row.get("verification_status")
        documents_count = len(self._list_documents(str(row.get("id"))))
        filled_fields = sum(
            1
            for key in (
                "verification_full_name",
                "verification_profession_title",
                "verification_license_number",
                "verification_issuing_organization",
                "verification_note",
            )
            if isinstance(row.get(key), str) and row.get(key).strip()
        )
        status_rank = {
            "approved": 4,
            "pending": 3,
            "rejected": 2,
            "not_submitted": 1,
        }.get(status, 0)
        has_submitted_at = 1 if row.get("verification_submitted_at") else 0
        uuid_rank = 1 if self.therapist_service._is_uuid_like(row.get("id")) else 0
        updated_at = str(row.get("updated_at") or row.get("verification_submitted_at") or row.get("created_at") or "")
        return (documents_count, status_rank, filled_fields, has_submitted_at, uuid_rank, updated_at)

    def _canonical_review_row(self, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        normalized_rows = [row for row in rows if isinstance(row, dict)]
        if not normalized_rows:
            return None
        return max(normalized_rows, key=self._review_row_priority)

    def _list_documents(self, therapist_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(VERIFICATION_DOCS_TABLE)
                .select("*")
                .eq("therapist_id", therapist_id)
                .order("uploaded_at", desc=True)
                .execute()
            )
        except Exception:
            return []
        return [self._serialize_document(row) for row in (response.data or []) if isinstance(row, dict)]

    def get_my_submission(self, user_id: str, email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        therapist = self._therapist_row(user_id, email=email, name=name)
        if not therapist:
            return None
        return {
            "therapist_id": therapist.get("id"),
            "verification_status": self.therapist_status(user_id),
            "verification_submitted_at": therapist.get("verification_submitted_at"),
            "verified_at": therapist.get("verified_at"),
            "verified_by_email": therapist.get("verified_by_email"),
            "rejection_reason": therapist.get("rejection_reason"),
            "verification_full_name": therapist.get("verification_full_name") or therapist.get("name"),
            "verification_profession_title": therapist.get("verification_profession_title"),
            "verification_license_number": therapist.get("verification_license_number") or therapist.get("license_number"),
            "verification_issuing_organization": therapist.get("verification_issuing_organization"),
            "verification_note": therapist.get("verification_note"),
            "documents": self._list_documents(str(therapist.get("id"))),
        }

    def update_my_submission(self, user_id: str, payload: Dict[str, Any], email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        therapist = self._therapist_row(user_id, email=email, name=name)
        if not therapist:
            return None

        update_payload = {
            "verification_full_name": payload.get("verification_full_name"),
            "verification_profession_title": payload.get("verification_profession_title"),
            "verification_license_number": payload.get("verification_license_number"),
            "verification_issuing_organization": payload.get("verification_issuing_organization"),
            "verification_note": payload.get("verification_note"),
            "updated_at": self._now(),
        }
        update_payload = {key: value for key, value in update_payload.items() if value is not None}
        if update_payload:
            try:
                self.supabase.table("therapists").update(update_payload).eq("id", therapist["id"]).execute()
            except Exception:
                pass
        return self.get_my_submission(user_id, email=email, name=name)

    def upload_documents(self, user_id: str, files: List[Dict[str, Any]], email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        therapist = self._therapist_row(user_id, email=email, name=name)
        if not therapist:
            return None
        therapist_id = str(therapist.get("id"))
        self._ensure_bucket()

        for file in files:
            filename = str(file.get("filename") or "verification-document")
            content = file.get("content") or b""
            mime_type = file.get("mime_type")
            self._validate_file(filename, mime_type, len(content))

            safe_name = self._safe_filename(filename)
            path = f"{therapist_id}/{uuid4()}-{safe_name}"
            self.supabase.storage.from_(VERIFICATION_BUCKET).upload(
                path,
                content,
                file_options={"content-type": mime_type or "application/octet-stream", "upsert": "false"},
            )
            self.supabase.table(VERIFICATION_DOCS_TABLE).insert(
                {
                    "therapist_id": therapist_id,
                    "file_path": path,
                    "file_name": safe_name,
                    "mime_type": mime_type,
                    "size_bytes": len(content),
                }
            ).execute()

        return self.get_my_submission(user_id, email=email, name=name)

    def delete_document(self, user_id: str, media_id: str, email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        therapist = self._therapist_row(user_id, email=email, name=name)
        if not therapist:
            return None
        therapist_id = str(therapist.get("id"))
        path = self._decode_media_id(media_id)
        if not path:
            return None

        try:
            existing = (
                self.supabase.table(VERIFICATION_DOCS_TABLE)
                .select("id, file_path")
                .eq("therapist_id", therapist_id)
                .eq("file_path", path)
                .limit(1)
                .execute()
            )
        except Exception:
            existing = None

        if not existing or not existing.data:
            return None

        try:
            self.supabase.storage.from_(VERIFICATION_BUCKET).remove([path])
        except Exception:
            pass

        self.supabase.table(VERIFICATION_DOCS_TABLE).delete().eq("id", existing.data[0]["id"]).execute()
        return self.get_my_submission(user_id, email=email, name=name)

    def submit_for_review(self, user_id: str, email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        therapist = self._therapist_row(user_id, email=email, name=name)
        if not therapist:
            return None
        therapist_id = str(therapist.get("id"))
        documents = self._list_documents(therapist_id)
        if not documents:
            raise ValueError("Please upload at least one verification document before submitting")

        self.supabase.table("therapists").update(
            {
                "verification_status": "pending",
                "verification_submitted_at": self._now(),
                "rejection_reason": None,
                "is_verified": False,
                "verified_at": None,
                "verified_by_email": None,
                "updated_at": self._now(),
            }
        ).eq("id", therapist_id).execute()
        return self.get_my_submission(user_id, email=email, name=name)

    def list_reviews(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            query = self.supabase.table("therapists").select("*").order("updated_at", desc=True)
            response = query.execute()
        except Exception:
            return []

        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            grouped.setdefault(self._review_group_key(row), []).append(row)

        canonical_rows = [
            canonical
            for canonical in (self._canonical_review_row(group_rows) for group_rows in grouped.values())
            if canonical
        ]
        if status and status in VERIFICATION_STATUSES:
            canonical_rows = [
                row for row in canonical_rows
                if (row.get("verification_status") or ("approved" if row.get("is_verified") else "not_submitted")) == status
            ]

        canonical_rows.sort(
            key=lambda row: (
                str(row.get("verification_submitted_at") or ""),
                str(row.get("updated_at") or ""),
            ),
            reverse=True,
        )
        return [
            {
                "therapist_id": row.get("id"),
                "email": row.get("email"),
                "name": row.get("name"),
                "verification_status": row.get("verification_status") or ("approved" if row.get("is_verified") else "not_submitted"),
                "verification_submitted_at": row.get("verification_submitted_at"),
                "verified_at": row.get("verified_at"),
                "verified_by_email": row.get("verified_by_email"),
                "rejection_reason": row.get("rejection_reason"),
                "verification_full_name": row.get("verification_full_name") or row.get("name"),
                "verification_profession_title": row.get("verification_profession_title"),
                "verification_license_number": row.get("verification_license_number") or row.get("license_number"),
                "verification_issuing_organization": row.get("verification_issuing_organization"),
                "documents_count": len(self._list_documents(str(row.get("id")))),
            }
            for row in canonical_rows
        ]

    def get_review_detail(self, therapist_id: str) -> Optional[Dict[str, Any]]:
        exact_row = self._fetch_exact_therapist_row(therapist_id)
        if not exact_row:
            return None
        therapist = self._canonical_review_row(self._related_review_rows(exact_row)) or exact_row
        if not therapist:
            return None
        return {
            "therapist_id": therapist.get("id"),
            "user_id": therapist.get("user_id"),
            "email": therapist.get("email"),
            "name": therapist.get("name"),
            "verification_status": self.therapist_status(str(therapist.get("user_id") or therapist.get("id"))),
            "verification_submitted_at": therapist.get("verification_submitted_at"),
            "verified_at": therapist.get("verified_at"),
            "verified_by_email": therapist.get("verified_by_email"),
            "rejection_reason": therapist.get("rejection_reason"),
            "verification_full_name": therapist.get("verification_full_name") or therapist.get("name"),
            "verification_profession_title": therapist.get("verification_profession_title"),
            "verification_license_number": therapist.get("verification_license_number") or therapist.get("license_number"),
            "verification_issuing_organization": therapist.get("verification_issuing_organization"),
            "verification_note": therapist.get("verification_note"),
            "documents": self._list_documents(str(therapist.get("id"))),
        }

    def review_submission(self, therapist_id: str, reviewer_email: str, approved: bool, rejection_reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
        exact_row = self._fetch_exact_therapist_row(therapist_id)
        therapist = self._canonical_review_row(self._related_review_rows(exact_row)) if exact_row else None
        if not therapist:
            return None

        payload = {
            "verification_status": "approved" if approved else "rejected",
            "is_verified": bool(approved),
            "verified_at": self._now() if approved else None,
            "verified_by_email": reviewer_email if approved else None,
            "rejection_reason": None if approved else (rejection_reason or "Application needs more verification details."),
            "updated_at": self._now(),
        }
        self.supabase.table("therapists").update(payload).eq("id", therapist_id).execute()
        return self.get_review_detail(therapist_id)


_verification_service: Optional[TherapistVerificationService] = None


def get_therapist_verification_service() -> TherapistVerificationService:
    global _verification_service
    if _verification_service is None:
        _verification_service = TherapistVerificationService()
    return _verification_service

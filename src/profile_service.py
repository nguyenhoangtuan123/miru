import base64
import json
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

THERAPIST_PUBLIC_PROFILE_TABLE = "therapist_public_profiles"
CLIENT_PRIVATE_PROFILE_TABLE = "client_private_profiles"
THERAPIST_BILLING_PROFILE_TABLE = "therapist_billing_profiles"
THERAPIST_CONTACT_REQUEST_TABLE = "therapist_contact_requests"
THERAPIST_PUBLIC_MEDIA_BUCKET = "therapist-public-media"
CLIENT_PRIVATE_MEDIA_BUCKET = "client-private-media"
PRIVATE_MEDIA_TTL_SECONDS = 60 * 60
VALID_SERVICE_MODES = {"free", "paid", "both"}
VALID_PRICING_UNITS = {"session", "package", "custom"}
VALID_CONTACT_REQUEST_STATUSES = {"pending", "approved", "declined", "archived"}
VALID_CONTACT_REQUEST_FUNNEL_STATUSES = {"new", "replied", "approved", "paired", "lost"}
VALID_CONTACT_REQUEST_SOURCES = {"directory", "profile_direct_link", "therapist_invite", "referral", "article"}
VALID_CONTACT_REQUEST_ENTRY_INTENTS = {"message", "therapy"}


class ProfileService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.therapist_service = get_therapist_service()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _parse_json_list(self, value: Any) -> List[Any]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except Exception:
                return []
            return parsed if isinstance(parsed, list) else []
        return []

    def _normalize_specializations(self, value: Any) -> List[str]:
        if isinstance(value, list):
            candidates = value
        elif isinstance(value, str):
            if value.strip().startswith("["):
                try:
                    parsed = json.loads(value)
                    candidates = parsed if isinstance(parsed, list) else []
                except Exception:
                    candidates = re.split(r"[,;\n]", value)
            else:
                candidates = re.split(r"[,;\n]", value)
        else:
            candidates = []

        normalized: List[str] = []
        for item in candidates:
            if not isinstance(item, str):
                continue
            cleaned = item.strip()
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        return normalized

    def _normalize_text(self, value: Any, max_length: Optional[int] = None) -> Optional[str]:
        if not isinstance(value, str):
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if isinstance(max_length, int) and max_length > 0:
            return cleaned[:max_length]
        return cleaned

    def _normalize_string_list(self, value: Any, max_items: int = 5, max_length: int = 120) -> List[str]:
        if isinstance(value, list):
            candidates = value
        elif isinstance(value, str):
            try:
                parsed = json.loads(value)
                candidates = parsed if isinstance(parsed, list) else []
            except Exception:
                candidates = [segment.strip() for segment in value.split("\n")]
        else:
            candidates = []

        normalized: List[str] = []
        for item in candidates:
            cleaned = self._normalize_text(item, max_length=max_length)
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
            if len(normalized) >= max_items:
                break
        return normalized

    def _normalize_service_mode(self, value: Any) -> str:
        if isinstance(value, str) and value.strip().lower() in VALID_SERVICE_MODES:
            return value.strip().lower()
        return "both"

    def _normalize_pricing_unit(self, value: Any) -> str:
        if isinstance(value, str) and value.strip().lower() in VALID_PRICING_UNITS:
            return value.strip().lower()
        return "session"

    def _normalize_contact_request_status(self, value: Any) -> str:
        if isinstance(value, str) and value.strip().lower() in VALID_CONTACT_REQUEST_STATUSES:
            return value.strip().lower()
        return "pending"

    def _normalize_contact_request_funnel_status(self, value: Any) -> str:
        if isinstance(value, str) and value.strip().lower() in VALID_CONTACT_REQUEST_FUNNEL_STATUSES:
            return value.strip().lower()
        return "new"

    def _normalize_contact_request_source(self, value: Any) -> str:
        if isinstance(value, str) and value.strip().lower() in VALID_CONTACT_REQUEST_SOURCES:
            return value.strip().lower()
        return "directory"

    def _normalize_contact_request_entry_intent(self, value: Any) -> str:
        if isinstance(value, str) and value.strip().lower() in VALID_CONTACT_REQUEST_ENTRY_INTENTS:
            return value.strip().lower()
        return "therapy"

    def _normalize_vnd_amount(self, value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        try:
            amount = int(value)
        except Exception:
            return None
        return amount if amount >= 0 else None

    def _safe_non_negative_int(self, value: Any, default: int = 0) -> int:
        try:
            normalized = int(value)
        except Exception:
            return default
        return normalized if normalized >= 0 else default

    def _parse_timestamp(self, value: Any) -> Optional[datetime]:
        if not isinstance(value, str) or not value.strip():
            return None
        normalized = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except Exception:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def _select_single(self, table_name: str, column: str, value: str) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(table_name)
                .select("*")
                .eq(column, value)
                .limit(1)
                .execute()
            )
        except Exception:
            return None
        return response.data[0] if response.data else None

    def _write_single(
        self,
        table_name: str,
        key_column: str,
        key_value: str,
        payload: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        now_value = self._now()
        existing = self._select_single(table_name, key_column, key_value)
        if existing:
            clean_payload = dict(payload)
            clean_payload["updated_at"] = now_value
            try:
                response = (
                    self.supabase.table(table_name)
                    .update(clean_payload)
                    .eq(key_column, key_value)
                    .execute()
                )
                if response.data:
                    return response.data[0]
            except Exception:
                pass
            return self._select_single(table_name, key_column, key_value)

        insert_payload = {
            key_column: key_value,
            "created_at": now_value,
            "updated_at": now_value,
            **payload,
        }
        try:
            response = self.supabase.table(table_name).insert(insert_payload).execute()
            if response.data:
                return response.data[0]
        except Exception:
            pass
        return self._select_single(table_name, key_column, key_value)

    def _insert_with_variants(self, table_name: str, payload_variants: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for payload in payload_variants:
            try:
                response = self.supabase.table(table_name).insert(payload).execute()
                if response.data:
                    return response.data[0]
            except Exception:
                continue
        return None

    def _update_with_variants(
        self,
        table_name: str,
        key_column: str,
        key_value: Any,
        payload_variants: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        for payload in payload_variants:
            try:
                response = (
                    self.supabase.table(table_name)
                    .update(payload)
                    .eq(key_column, key_value)
                    .execute()
                )
                if response.data:
                    return response.data[0]
            except Exception:
                continue
        return None

    def _get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("users")
                .select("id, email, name, picture")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
        except Exception:
            return None
        return response.data[0] if response.data else None

    def _get_users_by_ids(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        normalized_ids = [user_id for user_id in dict.fromkeys(user_ids) if isinstance(user_id, str) and user_id]
        if not normalized_ids:
            return {}
        try:
            response = (
                self.supabase.table("users")
                .select("id, email, name, picture")
                .in_("id", normalized_ids)
                .execute()
            )
        except Exception:
            return {}
        return {
            row["id"]: row
            for row in (response.data or [])
            if isinstance(row, dict) and isinstance(row.get("id"), str)
        }

    def _get_therapists_by_ids(self, therapist_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        normalized_ids = [therapist_id for therapist_id in dict.fromkeys(therapist_ids) if therapist_id]
        if not normalized_ids:
            return {}
        try:
            response = (
                self.supabase.table("therapists")
                .select("*")
                .in_("id", normalized_ids)
                .execute()
            )
        except Exception:
            return {}
        return {
            row["id"]: row
            for row in (response.data or [])
            if isinstance(row, dict) and isinstance(row.get("id"), str)
        }

    def _get_therapist_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        therapist_id = self.therapist_service._resolve_therapist_id(user_id)
        if not therapist_id:
            return None
        return self.therapist_service.get_therapist(therapist_id)

    def _count_contact_requests_for_therapist(self, therapist_id: str) -> int:
        return self.therapist_service._safe_exact_count(
            THERAPIST_CONTACT_REQUEST_TABLE,
            eq_filters={"therapist_id": therapist_id},
        )

    def _count_pair_conversions_for_therapist(self, therapist_id: str) -> int:
        return self.therapist_service._safe_exact_count(
            "therapist_clients",
            eq_filters={"therapist_id": therapist_id, "status": "active"},
        )

    def _increment_profile_metric(self, therapist_id: str, metric_column: str) -> bool:
        row = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist_id)
        if not row:
            return False
        current_value = self._safe_non_negative_int(row.get(metric_column), default=0)
        try:
            (
                self.supabase.table(THERAPIST_PUBLIC_PROFILE_TABLE)
                .update({metric_column: current_value + 1, "updated_at": self._now()})
                .eq("therapist_id", therapist_id)
                .execute()
            )
            return True
        except Exception:
            return False

    def _default_billing_profile(self, therapist_id: str) -> Dict[str, Any]:
        return {
            "therapist_id": therapist_id,
            "payment_mode": "manual",
            "bank_account_name": "",
            "bank_name": "",
            "bank_account_number": "",
            "momo_phone": "",
            "transfer_note": "",
            "updated_at": None,
        }

    def _ensure_bucket(self, bucket_name: str, public: bool) -> None:
        try:
            self.supabase.storage.create_bucket(bucket_name, options={"public": public})
        except Exception:
            pass

    def _validate_image(self, filename: str, mime_type: Optional[str], size: int) -> None:
        extension = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        allowed_mime_types = {"image/jpeg", "image/png", "image/webp"}

        if size <= 0:
            raise ValueError("Uploaded file is empty")
        if size > 5 * 1024 * 1024:
            raise ValueError("Uploaded file exceeds the 5 MB limit")
        if extension not in allowed_extensions and (mime_type or "").lower() not in allowed_mime_types:
            raise ValueError("Unsupported image type")

    def _safe_filename(self, filename: str) -> str:
        return re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)

    def _media_id(self, bucket_name: str, path: str) -> str:
        raw = f"{bucket_name}:{path}".encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")

    def _decode_media_id(self, media_id: str) -> Optional[Tuple[str, str]]:
        padded = media_id + "=" * (-len(media_id) % 4)
        try:
            decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        except Exception:
            return None
        if ":" not in decoded:
            return None
        bucket_name, path = decoded.split(":", 1)
        if not bucket_name or not path:
            return None
        return bucket_name, path

    def _public_url(self, bucket_name: str, path: str) -> Optional[str]:
        try:
            return self.supabase.storage.from_(bucket_name).get_public_url(path)
        except Exception:
            return None

    def _signed_url(self, bucket_name: str, path: str) -> Optional[str]:
        try:
            signed = self.supabase.storage.from_(bucket_name).create_signed_url(
                path,
                PRIVATE_MEDIA_TTL_SECONDS,
            )
        except Exception:
            return None

        if isinstance(signed, dict):
            return signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
        return getattr(signed, "signedURL", None)

    def _serialize_media_asset(
        self,
        item: Any,
        bucket_name: str,
        public: bool,
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(item, dict):
            return None

        path = item.get("path")
        url = item.get("url") if isinstance(item.get("url"), str) else None
        if isinstance(path, str) and path.strip():
            path = path.strip()
            generated_url = self._public_url(bucket_name, path) if public else self._signed_url(bucket_name, path)
            url = generated_url or url
            media_id = self._media_id(bucket_name, path)
        else:
            media_id = None
            path = None

        name = item.get("name") if isinstance(item.get("name"), str) else (Path(path).name if path else None)
        return {
            "id": media_id,
            "name": name,
            "mime_type": item.get("mime_type") if isinstance(item.get("mime_type"), str) else None,
            "size": item.get("size") if isinstance(item.get("size"), int) else None,
            "uploaded_at": item.get("uploaded_at") if isinstance(item.get("uploaded_at"), str) else None,
            "url": url,
            "source": "upload" if path else "external",
        }

    def _serialize_media_list(self, value: Any, bucket_name: str, public: bool) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in self._parse_json_list(value):
            serialized = self._serialize_media_asset(item, bucket_name, public)
            if serialized:
                normalized.append(serialized)
        return normalized

    def _external_media(self, url: Optional[str], source: str) -> Optional[Dict[str, Any]]:
        if not isinstance(url, str) or not url.strip():
            return None
        return {
            "id": None,
            "name": "external-image",
            "mime_type": None,
            "size": None,
            "uploaded_at": None,
            "url": url.strip(),
            "source": source,
        }

    def _upload_file(
        self,
        bucket_name: str,
        owner_prefix: str,
        folder_name: str,
        file_info: Dict[str, Any],
    ) -> Dict[str, Any]:
        filename = file_info.get("filename")
        content = file_info.get("content")
        mime_type = file_info.get("mime_type")
        size = file_info.get("size")

        if not isinstance(filename, str) or not filename.strip() or not isinstance(content, bytes):
            raise ValueError("Invalid upload payload")

        size_value = size if isinstance(size, int) else len(content)
        self._validate_image(filename, mime_type if isinstance(mime_type, str) else None, size_value)
        safe_name = self._safe_filename(filename)
        object_path = f"{owner_prefix}/{folder_name}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:10]}-{safe_name}"
        options = {"content-type": mime_type} if isinstance(mime_type, str) and mime_type else None
        self.supabase.storage.from_(bucket_name).upload(object_path, content, file_options=options)
        return {
            "path": object_path,
            "name": Path(filename).name,
            "mime_type": mime_type if isinstance(mime_type, str) else None,
            "size": size_value,
            "uploaded_at": self._now(),
        }

    def _remove_storage_paths(self, bucket_name: str, paths: List[str]) -> None:
        normalized_paths = [path for path in paths if isinstance(path, str) and path]
        if not normalized_paths:
            return
        try:
            self.supabase.storage.from_(bucket_name).remove(normalized_paths)
        except Exception:
            pass

    def _resolve_display_name(
        self,
        profile_row: Optional[Dict[str, Any]],
        therapist: Optional[Dict[str, Any]] = None,
        user: Optional[Dict[str, Any]] = None,
    ) -> str:
        for value in (
            profile_row.get("display_name") if isinstance(profile_row, dict) else None,
            therapist.get("name") if isinstance(therapist, dict) else None,
            user.get("name") if isinstance(user, dict) else None,
            therapist.get("email") if isinstance(therapist, dict) else None,
            user.get("email") if isinstance(user, dict) else None,
        ):
            if isinstance(value, str) and value.strip():
                return value.strip()
        return "Therapist"

    def _serialize_therapist_profile(
        self,
        therapist: Dict[str, Any],
        profile_row: Optional[Dict[str, Any]],
        user: Optional[Dict[str, Any]],
        public_view: bool,
    ) -> Dict[str, Any]:
        avatar = None
        if isinstance(profile_row, dict):
            avatar = self._serialize_media_asset(
                profile_row.get("avatar_image"),
                THERAPIST_PUBLIC_MEDIA_BUCKET,
                public=True,
            )
        if not avatar:
            fallback_url = therapist.get("avatar_url")
            if (not isinstance(fallback_url, str) or not fallback_url.strip()) and isinstance(user, dict):
                fallback_url = user.get("picture")
            avatar = self._external_media(fallback_url, "oauth")

        specializations = []
        if isinstance(profile_row, dict) and profile_row.get("specializations") is not None:
            specializations = self._normalize_specializations(profile_row.get("specializations"))
        elif therapist.get("specializations") is not None:
            specializations = self._normalize_specializations(therapist.get("specializations"))

        result = {
            "therapist_id": therapist.get("id"),
            "display_name": self._resolve_display_name(profile_row, therapist=therapist, user=user),
            "headline": profile_row.get("headline") if isinstance(profile_row, dict) and isinstance(profile_row.get("headline"), str) else None,
            "bio": profile_row.get("bio") if isinstance(profile_row, dict) and isinstance(profile_row.get("bio"), str) else therapist.get("bio"),
            "specializations": specializations,
            "contact_phone": profile_row.get("contact_phone") if isinstance(profile_row, dict) and isinstance(profile_row.get("contact_phone"), str) else None,
            "contact_email": profile_row.get("contact_email") if isinstance(profile_row, dict) and isinstance(profile_row.get("contact_email"), str) else None,
            "contact_zalo_url": profile_row.get("contact_zalo_url") if isinstance(profile_row, dict) and isinstance(profile_row.get("contact_zalo_url"), str) else None,
            "contact_facebook_url": profile_row.get("contact_facebook_url") if isinstance(profile_row, dict) and isinstance(profile_row.get("contact_facebook_url"), str) else None,
            "contact_website_url": profile_row.get("contact_website_url") if isinstance(profile_row, dict) and isinstance(profile_row.get("contact_website_url"), str) else None,
            "avatar_image": avatar,
            "certificate_images": self._serialize_media_list(
                profile_row.get("certificate_images") if isinstance(profile_row, dict) else [],
                THERAPIST_PUBLIC_MEDIA_BUCKET,
                public=True,
            ),
            "is_public": bool(profile_row.get("is_public")) if isinstance(profile_row, dict) else False,
            "accepting_new_clients": True if not isinstance(profile_row, dict) or profile_row.get("accepting_new_clients") is None else bool(profile_row.get("accepting_new_clients")),
            "service_mode": self._normalize_service_mode(profile_row.get("service_mode") if isinstance(profile_row, dict) else None),
            "starting_price_vnd": self._normalize_vnd_amount(profile_row.get("starting_price_vnd") if isinstance(profile_row, dict) else None),
            "pricing_unit": self._normalize_pricing_unit(profile_row.get("pricing_unit") if isinstance(profile_row, dict) else None),
            "pricing_note": profile_row.get("pricing_note") if isinstance(profile_row, dict) and isinstance(profile_row.get("pricing_note"), str) else None,
            "public_payment_note": profile_row.get("public_payment_note") if isinstance(profile_row, dict) and isinstance(profile_row.get("public_payment_note"), str) else None,
            "public_workflow_steps": self._normalize_string_list(
                profile_row.get("public_workflow_steps") if isinstance(profile_row, dict) else [],
                max_items=5,
                max_length=160,
            ),
            "profile_view_count": self._safe_non_negative_int(
                profile_row.get("profile_view_count") if isinstance(profile_row, dict) else 0,
                default=0,
            ),
            "contact_request_count": self._safe_non_negative_int(
                profile_row.get("contact_request_count") if isinstance(profile_row, dict) else None,
                default=self._count_contact_requests_for_therapist(str(therapist.get("id") or "")),
            ),
            "pair_conversion_count": self._safe_non_negative_int(
                profile_row.get("pair_conversion_count") if isinstance(profile_row, dict) else None,
                default=self._count_pair_conversions_for_therapist(str(therapist.get("id") or "")),
            ),
            "is_verified": bool(therapist.get("is_verified")),
            "verification_status": therapist.get("verification_status")
            or ("approved" if therapist.get("is_verified") else "not_submitted"),
        }
        result["can_receive_contact_requests"] = bool(
            result["is_public"]
            and result["accepting_new_clients"]
            and result["verification_status"] == "approved"
        )
        if not public_view:
            account_email = therapist.get("email")
            if (not isinstance(account_email, str) or not account_email.strip()) and isinstance(user, dict):
                account_email = user.get("email")
            result["account_email"] = account_email
            result["therapist_name"] = therapist.get("name")
        return result

    def _serialize_client_profile(
        self,
        user: Dict[str, Any],
        profile_row: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        avatar = None
        if isinstance(profile_row, dict):
            avatar = self._serialize_media_asset(
                profile_row.get("avatar_image"),
                CLIENT_PRIVATE_MEDIA_BUCKET,
                public=False,
            )
        if not avatar:
            avatar = self._external_media(user.get("picture"), "oauth")

        return {
            "user_id": user.get("id"),
            "display_name": user.get("name") or user.get("email") or "Client",
            "email": user.get("email"),
            "intro": profile_row.get("intro") if isinstance(profile_row, dict) and isinstance(profile_row.get("intro"), str) else "",
            "avatar_image": avatar,
            "gallery_images": self._serialize_media_list(
                profile_row.get("gallery_images") if isinstance(profile_row, dict) else [],
                CLIENT_PRIVATE_MEDIA_BUCKET,
                public=False,
            ),
        }

    def get_public_therapists(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(THERAPIST_PUBLIC_PROFILE_TABLE)
                .select("*")
                .eq("is_public", True)
                .execute()
            )
        except Exception:
            return []

        rows = [row for row in (response.data or []) if isinstance(row, dict) and isinstance(row.get("therapist_id"), str)]
        therapists_by_id = self._get_therapists_by_ids([row["therapist_id"] for row in rows])
        user_ids = [
            therapist.get("user_id")
            for therapist in therapists_by_id.values()
            if isinstance(therapist, dict) and isinstance(therapist.get("user_id"), str)
        ]
        users_by_id = self._get_users_by_ids(user_ids)

        cards: List[Dict[str, Any]] = []
        for row in rows:
            therapist = therapists_by_id.get(str(row.get("therapist_id")))
            verification_status = (
                therapist.get("verification_status")
                if isinstance(therapist, dict)
                else None
            ) or ("approved" if isinstance(therapist, dict) and therapist.get("is_verified") else "not_submitted")
            if not therapist or therapist.get("is_active") is False or verification_status != "approved":
                continue
            user = users_by_id.get(therapist.get("user_id")) if isinstance(therapist.get("user_id"), str) else None
            cards.append(self._serialize_therapist_profile(therapist, row, user, public_view=True))

        cards.sort(key=lambda item: (not bool(item.get("is_verified")), str(item.get("display_name") or "").lower()))
        if isinstance(limit, int) and limit > 0:
            return cards[:limit]
        return cards

    def get_public_therapist(self, therapist_id: str, track_view: bool = False) -> Optional[Dict[str, Any]]:
        profile_row = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist_id)
        if not profile_row or not profile_row.get("is_public"):
            return None
        therapist = self.therapist_service.get_therapist(therapist_id)
        verification_status = (
            therapist.get("verification_status")
            if isinstance(therapist, dict)
            else None
        ) or ("approved" if isinstance(therapist, dict) and therapist.get("is_verified") else "not_submitted")
        if not therapist or therapist.get("is_active") is False or verification_status != "approved":
            return None
        if track_view and self._increment_profile_metric(therapist_id, "profile_view_count"):
            profile_row = dict(profile_row)
            profile_row["profile_view_count"] = self._safe_non_negative_int(
                profile_row.get("profile_view_count"),
                default=0,
            ) + 1
        user = self._get_user(therapist.get("user_id")) if isinstance(therapist.get("user_id"), str) else None
        return self._serialize_therapist_profile(therapist, profile_row, user, public_view=True)

    def get_my_therapist_profile(
        self,
        user_id: str,
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            return None
        profile_row = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist["id"])
        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_therapist_profile(therapist, profile_row, user, public_view=False)

    def update_my_therapist_profile(
        self,
        user_id: str,
        payload: Dict[str, Any],
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            return None

        clean_payload: Dict[str, Any] = {}
        for key in (
            "display_name",
            "headline",
            "bio",
            "contact_phone",
            "contact_email",
            "contact_zalo_url",
            "contact_facebook_url",
            "contact_website_url",
            "pricing_note",
            "public_payment_note",
        ):
            if key in payload:
                value = payload.get(key)
                clean_payload[key] = value.strip() if isinstance(value, str) else value
        if "specializations" in payload:
            clean_payload["specializations"] = self._normalize_specializations(payload.get("specializations"))
        if "accepting_new_clients" in payload:
            clean_payload["accepting_new_clients"] = bool(payload.get("accepting_new_clients"))
        if "service_mode" in payload:
            clean_payload["service_mode"] = self._normalize_service_mode(payload.get("service_mode"))
        if "starting_price_vnd" in payload:
            clean_payload["starting_price_vnd"] = self._normalize_vnd_amount(payload.get("starting_price_vnd"))
        if "pricing_unit" in payload:
            clean_payload["pricing_unit"] = self._normalize_pricing_unit(payload.get("pricing_unit"))
        if "public_workflow_steps" in payload:
            clean_payload["public_workflow_steps"] = self._normalize_string_list(
                payload.get("public_workflow_steps"),
                max_items=5,
                max_length=160,
            )
        if "is_public" in payload:
            verification_status = therapist.get("verification_status") or (
                "approved" if therapist.get("is_verified") else "not_submitted"
            )
            if bool(payload.get("is_public")) and verification_status != "approved":
                raise ValueError("Therapist must be approved before the public profile can be published")
            clean_payload["is_public"] = bool(payload.get("is_public"))

        written = self._write_single(
            THERAPIST_PUBLIC_PROFILE_TABLE,
            "therapist_id",
            therapist["id"],
            clean_payload,
        )
        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_therapist_profile(therapist, written, user, public_view=False) if written else None

    def upload_my_therapist_avatar(
        self,
        user_id: str,
        file_info: Dict[str, Any],
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            return None

        self._ensure_bucket(THERAPIST_PUBLIC_MEDIA_BUCKET, public=True)
        existing = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist["id"]) or {}
        old_avatar = existing.get("avatar_image") if isinstance(existing, dict) else None

        uploaded = self._upload_file(
            THERAPIST_PUBLIC_MEDIA_BUCKET,
            f"therapists/{therapist['id']}",
            "avatar",
            file_info,
        )
        written = self._write_single(
            THERAPIST_PUBLIC_PROFILE_TABLE,
            "therapist_id",
            therapist["id"],
            {"avatar_image": uploaded},
        )
        if not written:
            self._remove_storage_paths(THERAPIST_PUBLIC_MEDIA_BUCKET, [uploaded.get("path")])
            return None
        if isinstance(old_avatar, dict) and isinstance(old_avatar.get("path"), str):
            self._remove_storage_paths(THERAPIST_PUBLIC_MEDIA_BUCKET, [old_avatar["path"]])

        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_therapist_profile(therapist, written, user, public_view=False)

    def upload_my_therapist_certificates(
        self,
        user_id: str,
        files: List[Dict[str, Any]],
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            return None

        self._ensure_bucket(THERAPIST_PUBLIC_MEDIA_BUCKET, public=True)
        existing = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist["id"]) or {}
        current_items = self._parse_json_list(existing.get("certificate_images"))
        if len(current_items) + len(files) > 8:
            raise ValueError("Therapists can upload at most 8 certificate images")

        uploaded_items: List[Dict[str, Any]] = []
        for file_info in files:
            uploaded_items.append(
                self._upload_file(
                    THERAPIST_PUBLIC_MEDIA_BUCKET,
                    f"therapists/{therapist['id']}",
                    "certificates",
                    file_info,
                )
            )

        written = self._write_single(
            THERAPIST_PUBLIC_PROFILE_TABLE,
            "therapist_id",
            therapist["id"],
            {"certificate_images": current_items + uploaded_items},
        )
        if not written:
            self._remove_storage_paths(
                THERAPIST_PUBLIC_MEDIA_BUCKET,
                [item.get("path") for item in uploaded_items if isinstance(item.get("path"), str)],
            )
            return None

        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_therapist_profile(therapist, written, user, public_view=False)

    def delete_my_therapist_media(
        self,
        user_id: str,
        media_id: str,
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        decoded = self._decode_media_id(media_id)
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not decoded or not therapist:
            return None
        bucket_name, path = decoded
        if bucket_name != THERAPIST_PUBLIC_MEDIA_BUCKET:
            return None

        existing = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist["id"])
        if not existing:
            return None

        payload: Dict[str, Any] = {}
        avatar = existing.get("avatar_image")
        if isinstance(avatar, dict) and avatar.get("path") == path:
            payload["avatar_image"] = None
        else:
            previous_items = self._parse_json_list(existing.get("certificate_images"))
            certificates = [
                item
                for item in previous_items
                if not (isinstance(item, dict) and item.get("path") == path)
            ]
            if len(certificates) == len(previous_items):
                return None
            payload["certificate_images"] = certificates

        written = self._write_single(
            THERAPIST_PUBLIC_PROFILE_TABLE,
            "therapist_id",
            therapist["id"],
            payload,
        )
        if not written:
            return None
        self._remove_storage_paths(THERAPIST_PUBLIC_MEDIA_BUCKET, [path])

        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_therapist_profile(therapist, written, user, public_view=False)

    def get_my_therapist_billing_profile(self, user_id: str, email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            return None
        profile_row = self._select_single(THERAPIST_BILLING_PROFILE_TABLE, "therapist_id", therapist["id"])
        if not profile_row:
            return self._default_billing_profile(therapist["id"])
        return {**self._default_billing_profile(therapist["id"]), **profile_row}

    def update_my_therapist_billing_profile(
        self,
        user_id: str,
        payload: Dict[str, Any],
        email: str = "",
        name: str = "",
    ) -> Optional[Dict[str, Any]]:
        therapist = self.therapist_service.ensure_therapist_profile(user_id, email=email, name=name)
        if not therapist:
            return None
        clean_payload = {
            "payment_mode": self._normalize_text(payload.get("payment_mode"), 40) or "manual",
            "bank_account_name": self._normalize_text(payload.get("bank_account_name"), 120) or "",
            "bank_name": self._normalize_text(payload.get("bank_name"), 120) or "",
            "bank_account_number": self._normalize_text(payload.get("bank_account_number"), 60) or "",
            "momo_phone": self._normalize_text(payload.get("momo_phone"), 40) or "",
            "transfer_note": self._normalize_text(payload.get("transfer_note"), 240) or "",
        }
        written = self._write_single(
            THERAPIST_BILLING_PROFILE_TABLE,
            "therapist_id",
            therapist["id"],
            clean_payload,
        )
        if not written:
            return None
        return {**self._default_billing_profile(therapist["id"]), **written}

    def _serialize_contact_request(
        self,
        row: Dict[str, Any],
        therapist_profile: Optional[Dict[str, Any]] = None,
        client_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        created_at = self._parse_timestamp(row.get("created_at"))
        handled_at = self._parse_timestamp(row.get("handled_at"))
        response_time_hours = None
        if created_at and handled_at:
            response_time_hours = round(max((handled_at - created_at).total_seconds(), 0) / 3600, 2)

        return {
            "id": row.get("id"),
            "therapist_id": row.get("therapist_id"),
            "client_id": row.get("client_id"),
            "status": self._normalize_contact_request_status(row.get("status")),
            "funnel_status": self._normalize_contact_request_funnel_status(row.get("funnel_status")),
            "source": self._normalize_contact_request_source(row.get("source")),
            "source_article_slug": row.get("source_article_slug") if isinstance(row.get("source_article_slug"), str) else None,
            "entry_intent": self._normalize_contact_request_entry_intent(row.get("entry_intent")),
            "message": row.get("message") if isinstance(row.get("message"), str) else "",
            "preferred_contact_method": row.get("preferred_contact_method") if isinstance(row.get("preferred_contact_method"), str) else None,
            "client_contact_phone": row.get("client_contact_phone") if isinstance(row.get("client_contact_phone"), str) else None,
            "client_contact_zalo": row.get("client_contact_zalo") if isinstance(row.get("client_contact_zalo"), str) else None,
            "service_interest": row.get("service_interest") if isinstance(row.get("service_interest"), str) else "unsure",
            "therapist_reply": row.get("therapist_reply") if isinstance(row.get("therapist_reply"), str) else None,
            "shared_pairing_code": row.get("shared_pairing_code") if isinstance(row.get("shared_pairing_code"), str) else None,
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "handled_at": row.get("handled_at"),
            "paired_at": row.get("paired_at"),
            "response_time_hours": response_time_hours,
            "therapist": therapist_profile,
            "client": {
                "id": client_user.get("id"),
                "name": client_user.get("name"),
                "email": client_user.get("email"),
                "picture": client_user.get("picture"),
            }
            if isinstance(client_user, dict)
            else None,
        }

    def _get_contact_request_row(self, request_id: int | str) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(THERAPIST_CONTACT_REQUEST_TABLE)
                .select("*")
                .eq("id", request_id)
                .limit(1)
                .execute()
            )
        except Exception:
            return None
        return response.data[0] if response.data else None

    def create_contact_request(self, client_id: str, therapist_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        therapist = self.therapist_service.get_therapist(therapist_id)
        profile = self.get_public_therapist(therapist_id, track_view=False)
        if not therapist or not profile or not profile.get("can_receive_contact_requests"):
            raise ValueError("Therapist hiện không nhận yêu cầu liên hệ mới")

        try:
            existing = (
                self.supabase.table(THERAPIST_CONTACT_REQUEST_TABLE)
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .eq("status", "pending")
                .limit(1)
                .execute()
            )
            if existing.data:
                raise ValueError("Bạn đang có một yêu cầu liên hệ đang chờ xử lý với therapist này")
        except ValueError:
            raise
        except Exception:
            pass

        insert_payload = {
            "therapist_id": therapist_id,
            "client_id": client_id,
            "status": "pending",
            "funnel_status": "new",
            "source": self._normalize_contact_request_source(payload.get("source")),
            "source_article_slug": self._normalize_text(payload.get("source_article_slug"), 240),
            "entry_intent": self._normalize_contact_request_entry_intent(payload.get("entry_intent")),
            "message": self._normalize_text(payload.get("message"), 1200) or "",
            "preferred_contact_method": self._normalize_text(payload.get("preferred_contact_method"), 40),
            "client_contact_phone": self._normalize_text(payload.get("client_contact_phone"), 40),
            "client_contact_zalo": self._normalize_text(payload.get("client_contact_zalo"), 120),
            "service_interest": self._normalize_text(payload.get("service_interest"), 20) or "unsure",
            "therapist_reply": None,
            "shared_pairing_code": None,
            "created_at": self._now(),
            "updated_at": self._now(),
            "handled_at": None,
        }
        row = self._insert_with_variants(
            THERAPIST_CONTACT_REQUEST_TABLE,
            [
                insert_payload,
                {
                    key: value
                    for key, value in insert_payload.items()
                    if key not in {"source", "source_article_slug", "entry_intent"}
                },
                {
                    key: value
                    for key, value in insert_payload.items()
                    if key not in {"source", "source_article_slug", "funnel_status", "entry_intent"}
                },
            ],
        ) or insert_payload
        self._increment_profile_metric(therapist_id, "contact_request_count")
        try:
            from trajectory_service import get_trajectory_service

            trajectory_service = get_trajectory_service()
            trajectory_service.log_event(
                client_id,
                "contact_request_submitted",
                {
                    "therapist_id": therapist_id,
                    "source": insert_payload.get("source"),
                    "source_article_slug": insert_payload.get("source_article_slug"),
                    "entry_intent": insert_payload.get("entry_intent"),
                },
                dedupe_seconds=0,
            )
            trajectory_service.recompute_snapshot(client_id, trigger="manual")
        except Exception:
            pass
        return self._serialize_contact_request(row, therapist_profile=profile)

    def get_my_contact_requests(self, client_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(THERAPIST_CONTACT_REQUEST_TABLE)
                .select("*")
                .eq("client_id", client_id)
                .order("updated_at", desc=True)
                .execute()
            )
        except Exception:
            return []

        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        therapist_ids = [str(row.get("therapist_id")) for row in rows if isinstance(row.get("therapist_id"), str)]
        profiles = {
            therapist_id: self.get_public_therapist(therapist_id, track_view=False)
            for therapist_id in therapist_ids
        }
        return [self._serialize_contact_request(row, therapist_profile=profiles.get(str(row.get("therapist_id")))) for row in rows]

    def get_therapist_contact_requests(self, therapist_user_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        therapist = self._get_therapist_by_user_id(therapist_user_id)
        if not therapist:
            return []
        try:
            response = (
                self.supabase.table(THERAPIST_CONTACT_REQUEST_TABLE)
                .select("*")
                .eq("therapist_id", therapist["id"])
                .order("updated_at", desc=True)
                .execute()
            )
        except Exception:
            return []

        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        client_users = self._get_users_by_ids([str(row.get("client_id")) for row in rows if isinstance(row.get("client_id"), str)])
        therapist_profile = self.get_public_therapist(therapist["id"], track_view=False)
        serialized_rows = [
            self._serialize_contact_request(
                row,
                therapist_profile=therapist_profile,
                client_user=client_users.get(str(row.get("client_id"))),
            )
            for row in rows
        ]
        normalized_filter = str(status or "").strip().lower()
        if not normalized_filter or normalized_filter == "all":
            return serialized_rows
        return [
            item
            for item in serialized_rows
            if item.get("status") == normalized_filter or item.get("funnel_status") == normalized_filter
        ]

    def get_therapist_contact_request_detail(self, therapist_user_id: str, request_id: int | str) -> Optional[Dict[str, Any]]:
        therapist = self._get_therapist_by_user_id(therapist_user_id)
        if not therapist:
            return None
        row = self._get_contact_request_row(request_id)
        if not row or row.get("therapist_id") != therapist["id"]:
            return None
        client_user = self._get_user(str(row.get("client_id"))) if isinstance(row.get("client_id"), str) else None
        therapist_profile = self.get_public_therapist(therapist["id"], track_view=False)
        return self._serialize_contact_request(row, therapist_profile=therapist_profile, client_user=client_user)

    def handle_contact_request(
        self,
        therapist_user_id: str,
        request_id: int | str,
        action: str,
        therapist_reply: Optional[str] = None,
        share_pairing_code: bool = False,
    ) -> Optional[Dict[str, Any]]:
        therapist = self._get_therapist_by_user_id(therapist_user_id)
        if not therapist:
            return None
        row = self._get_contact_request_row(request_id)
        if not row or row.get("therapist_id") != therapist["id"]:
            return None

        normalized_action = "approved" if action == "approve" else "declined" if action == "decline" else "archived"
        current_funnel_status = self._normalize_contact_request_funnel_status(row.get("funnel_status"))
        next_funnel_status = (
            "approved"
            if normalized_action == "approved" and share_pairing_code
            else "replied"
            if normalized_action == "approved"
            else "lost"
            if normalized_action == "declined"
            else current_funnel_status
            if current_funnel_status in {"approved", "paired"}
            else "lost"
        )
        pairing_code = None
        if normalized_action == "approved" and share_pairing_code:
            pairing = self.therapist_service.create_pairing_code(therapist_user_id)
            if pairing:
                pairing_code = pairing.get("pairing_code")

        payload = {
            "status": normalized_action,
            "funnel_status": next_funnel_status,
            "therapist_reply": self._normalize_text(therapist_reply, 1200),
            "shared_pairing_code": pairing_code,
            "updated_at": self._now(),
            "handled_at": self._now(),
        }
        try:
            updated = self._update_with_variants(
                THERAPIST_CONTACT_REQUEST_TABLE,
                "id",
                request_id,
                [
                    payload,
                    {key: value for key, value in payload.items() if key != "funnel_status"},
                ],
            ) or self._get_contact_request_row(request_id)
        except Exception:
            updated = self._get_contact_request_row(request_id)
        if not updated:
            return None
        client_id = str(updated.get("client_id") or "")
        if client_id:
            try:
                from trajectory_service import get_trajectory_service

                get_trajectory_service().recompute_snapshot(client_id, trigger="manual")
            except Exception:
                pass
        client_user = self._get_user(str(updated.get("client_id"))) if isinstance(updated.get("client_id"), str) else None
        therapist_profile = self.get_public_therapist(therapist["id"], track_view=False)
        return self._serialize_contact_request(updated, therapist_profile=therapist_profile, client_user=client_user)

    def mark_contact_request_paired(self, therapist_id: str, client_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(THERAPIST_CONTACT_REQUEST_TABLE)
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .order("updated_at", desc=True)
                .limit(10)
                .execute()
            )
        except Exception:
            return None

        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        selected = next(
            (
                row
                for row in rows
                if self._normalize_contact_request_funnel_status(row.get("funnel_status")) in {"approved", "replied", "new"}
                or self._normalize_contact_request_status(row.get("status")) in {"pending", "approved"}
            ),
            None,
        )
        if not selected:
            return None
        if self._normalize_contact_request_funnel_status(selected.get("funnel_status")) == "paired":
            return self._serialize_contact_request(selected)

        paired_at = self._now()
        updated = self._update_with_variants(
            THERAPIST_CONTACT_REQUEST_TABLE,
            "id",
            selected.get("id"),
            [
                {
                    "status": "approved",
                    "funnel_status": "paired",
                    "paired_at": paired_at,
                    "updated_at": paired_at,
                },
                {
                    "status": "approved",
                    "paired_at": paired_at,
                    "updated_at": paired_at,
                },
            ],
        ) or self._get_contact_request_row(selected.get("id"))
        if updated:
            self._increment_profile_metric(therapist_id, "pair_conversion_count")
            try:
                from trajectory_service import get_trajectory_service

                get_trajectory_service().recompute_snapshot(client_id, trigger="manual")
            except Exception:
                pass
            return self._serialize_contact_request(updated)
        return None

    def get_my_client_profile(self, user_id: str, email: str = "", name: str = "", picture: str = "") -> Optional[Dict[str, Any]]:
        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        profile_row = self._select_single(CLIENT_PRIVATE_PROFILE_TABLE, "user_id", user_id)
        return self._serialize_client_profile(user, profile_row)

    def update_my_client_profile(
        self,
        user_id: str,
        payload: Dict[str, Any],
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        clean_payload = {}
        if "intro" in payload:
            value = payload.get("intro")
            clean_payload["intro"] = value.strip() if isinstance(value, str) else ""
        written = self._write_single(
            CLIENT_PRIVATE_PROFILE_TABLE,
            "user_id",
            user_id,
            clean_payload,
        )
        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_client_profile(user, written)

    def upload_my_client_avatar(
        self,
        user_id: str,
        file_info: Dict[str, Any],
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        self._ensure_bucket(CLIENT_PRIVATE_MEDIA_BUCKET, public=False)
        existing = self._select_single(CLIENT_PRIVATE_PROFILE_TABLE, "user_id", user_id) or {}
        old_avatar = existing.get("avatar_image") if isinstance(existing, dict) else None
        uploaded = self._upload_file(
            CLIENT_PRIVATE_MEDIA_BUCKET,
            f"clients/{user_id}",
            "avatar",
            file_info,
        )
        written = self._write_single(
            CLIENT_PRIVATE_PROFILE_TABLE,
            "user_id",
            user_id,
            {"avatar_image": uploaded},
        )
        if not written:
            self._remove_storage_paths(CLIENT_PRIVATE_MEDIA_BUCKET, [uploaded.get("path")])
            return None
        if isinstance(old_avatar, dict) and isinstance(old_avatar.get("path"), str):
            self._remove_storage_paths(CLIENT_PRIVATE_MEDIA_BUCKET, [old_avatar["path"]])

        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_client_profile(user, written)

    def upload_my_client_gallery(
        self,
        user_id: str,
        files: List[Dict[str, Any]],
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        self._ensure_bucket(CLIENT_PRIVATE_MEDIA_BUCKET, public=False)
        existing = self._select_single(CLIENT_PRIVATE_PROFILE_TABLE, "user_id", user_id) or {}
        current_items = self._parse_json_list(existing.get("gallery_images"))
        if len(current_items) + len(files) > 4:
            raise ValueError("Clients can upload at most 4 gallery images")

        uploaded_items: List[Dict[str, Any]] = []
        for file_info in files:
            uploaded_items.append(
                self._upload_file(
                    CLIENT_PRIVATE_MEDIA_BUCKET,
                    f"clients/{user_id}",
                    "gallery",
                    file_info,
                )
            )

        written = self._write_single(
            CLIENT_PRIVATE_PROFILE_TABLE,
            "user_id",
            user_id,
            {"gallery_images": current_items + uploaded_items},
        )
        if not written:
            self._remove_storage_paths(
                CLIENT_PRIVATE_MEDIA_BUCKET,
                [item.get("path") for item in uploaded_items if isinstance(item.get("path"), str)],
            )
            return None

        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_client_profile(user, written)

    def delete_my_client_media(
        self,
        user_id: str,
        media_id: str,
        email: str = "",
        name: str = "",
        picture: str = "",
    ) -> Optional[Dict[str, Any]]:
        decoded = self._decode_media_id(media_id)
        if not decoded:
            return None
        bucket_name, path = decoded
        if bucket_name != CLIENT_PRIVATE_MEDIA_BUCKET:
            return None

        existing = self._select_single(CLIENT_PRIVATE_PROFILE_TABLE, "user_id", user_id)
        if not existing:
            return None

        payload: Dict[str, Any] = {}
        avatar = existing.get("avatar_image")
        if isinstance(avatar, dict) and avatar.get("path") == path:
            payload["avatar_image"] = None
        else:
            previous_items = self._parse_json_list(existing.get("gallery_images"))
            gallery = [
                item
                for item in previous_items
                if not (isinstance(item, dict) and item.get("path") == path)
            ]
            if len(gallery) == len(previous_items):
                return None
            payload["gallery_images"] = gallery

        written = self._write_single(
            CLIENT_PRIVATE_PROFILE_TABLE,
            "user_id",
            user_id,
            payload,
        )
        if not written:
            return None
        self._remove_storage_paths(CLIENT_PRIVATE_MEDIA_BUCKET, [path])

        user = self._get_user(user_id) or {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
        }
        return self._serialize_client_profile(user, written)

    def get_client_profile_for_therapist(self, therapist_user_id: str, client_id: str) -> Optional[Dict[str, Any]]:
        if not self.therapist_service.has_active_relationship(therapist_user_id, client_id):
            return None
        user = self._get_user(client_id)
        if not user:
            return None
        profile_row = self._select_single(CLIENT_PRIVATE_PROFILE_TABLE, "user_id", client_id)
        return self._serialize_client_profile(user, profile_row)


_profile_service: Optional[ProfileService] = None


def get_profile_service() -> ProfileService:
    global _profile_service
    if _profile_service is None:
        _profile_service = ProfileService()
    return _profile_service

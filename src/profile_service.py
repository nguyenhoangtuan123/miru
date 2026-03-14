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
THERAPIST_PUBLIC_MEDIA_BUCKET = "therapist-public-media"
CLIENT_PRIVATE_MEDIA_BUCKET = "client-private-media"
PRIVATE_MEDIA_TTL_SECONDS = 60 * 60


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
            "is_verified": bool(therapist.get("is_verified")),
        }
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
            if not therapist or therapist.get("is_active") is False:
                continue
            user = users_by_id.get(therapist.get("user_id")) if isinstance(therapist.get("user_id"), str) else None
            cards.append(self._serialize_therapist_profile(therapist, row, user, public_view=True))

        cards.sort(key=lambda item: (not bool(item.get("is_verified")), str(item.get("display_name") or "").lower()))
        if isinstance(limit, int) and limit > 0:
            return cards[:limit]
        return cards

    def get_public_therapist(self, therapist_id: str) -> Optional[Dict[str, Any]]:
        profile_row = self._select_single(THERAPIST_PUBLIC_PROFILE_TABLE, "therapist_id", therapist_id)
        if not profile_row or not profile_row.get("is_public"):
            return None
        therapist = self.therapist_service.get_therapist(therapist_id)
        if not therapist or therapist.get("is_active") is False:
            return None
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
        ):
            if key in payload:
                value = payload.get(key)
                clean_payload[key] = value.strip() if isinstance(value, str) else value
        if "specializations" in payload:
            clean_payload["specializations"] = self._normalize_specializations(payload.get("specializations"))
        if "is_public" in payload:
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

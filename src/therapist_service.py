import json
import os
import random
import re
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from supabase import Client, create_client
from utils import LOCAL_TZ

load_dotenv()

ASSIGNMENT_SUBMISSION_BUCKET = "assignment-submissions"
ASSIGNMENT_SIGNED_URL_TTL = 60 * 60


class TherapistService:
    """Therapist-client service used by the active API routes."""

    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self._pairing_store_path = Path(__file__).resolve().parent.parent / "pairing_codes.json"
        self._pairing_store_lock = Lock()
        print("[OK] TherapistService initialized")

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _is_uuid_like(self, value: Optional[str]) -> bool:
        if not isinstance(value, str):
            return False
        return bool(
            re.fullmatch(
                r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}",
                value,
            )
        )

    def _new_therapist_id(self) -> str:
        return str(uuid4())

    def _choose_preferred_therapist(self, rows: List[Dict[str, Any]], user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        normalized_rows = [row for row in rows if isinstance(row, dict)]
        if not normalized_rows:
            return None

        if user_id:
            uuid_row = next(
                (
                    row for row in normalized_rows
                    if row.get("user_id") == user_id and self._is_uuid_like(row.get("id"))
                ),
                None,
            )
            if uuid_row:
                return uuid_row

            user_row = next((row for row in normalized_rows if row.get("user_id") == user_id), None)
            if user_row:
                return user_row

        uuid_row = next((row for row in normalized_rows if self._is_uuid_like(row.get("id"))), None)
        if uuid_row:
            return uuid_row

        return normalized_rows[0]

    def _generate_pairing_code(self, length: int = 8) -> str:
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return "".join(random.choice(alphabet) for _ in range(length))

    def _pairing_marker(self, code: str) -> str:
        return f"PAIRING_CODE:{code.upper()}"

    def _load_local_pairing_store(self) -> Dict[str, Dict[str, Any]]:
        if not self._pairing_store_path.exists():
            return {}
        try:
            return json.loads(self._pairing_store_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save_local_pairing_store(self, data: Dict[str, Dict[str, Any]]) -> None:
        self._pairing_store_path.write_text(
            json.dumps(data, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    def _store_local_pairing_code(self, therapist_id: str, code: str) -> Dict[str, Any]:
        normalized_code = code.upper()
        with self._pairing_store_lock:
            data = self._load_local_pairing_store()
            data[normalized_code] = {
                "therapist_id": therapist_id,
                "created_at": self._now(),
            }
            self._save_local_pairing_store(data)
        return {
            "therapist_id": therapist_id,
            "client_id": None,
            "status": "pending",
            "pairing_code": normalized_code,
            "source": "local_fallback",
        }

    def _clear_local_codes_for_therapist(self, therapist_id: str) -> None:
        with self._pairing_store_lock:
            data = self._load_local_pairing_store()
            next_data = {
                code: entry
                for code, entry in data.items()
                if not isinstance(entry, dict) or entry.get("therapist_id") != therapist_id
            }
            if next_data != data:
                self._save_local_pairing_store(next_data)

    def _get_local_pairing_code(self, code: str) -> Optional[Dict[str, Any]]:
        normalized_code = code.upper()
        with self._pairing_store_lock:
            data = self._load_local_pairing_store()
            entry = data.get(normalized_code)
        if not isinstance(entry, dict):
            return None
        return {"pairing_code": normalized_code, **entry}

    def _pop_local_pairing_code(self, code: str) -> None:
        normalized_code = code.upper()
        with self._pairing_store_lock:
            data = self._load_local_pairing_store()
            if normalized_code in data:
                data.pop(normalized_code, None)
                self._save_local_pairing_store(data)

    def _fetch_therapist_client_row(self, row_id: int) -> Optional[Dict[str, Any]]:
        response = (
            self.supabase.table("therapist_clients")
            .select("*")
            .eq("id", row_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def _update_pairing_row(self, row_id: int, payload_variants: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for payload in payload_variants:
            try:
                response = (
                    self.supabase.table("therapist_clients")
                    .update(payload)
                    .eq("id", row_id)
                    .execute()
                )
                if response.data:
                    return response.data[0]
                fetched = self._fetch_therapist_client_row(row_id)
                if fetched:
                    return fetched
            except Exception:
                continue
        return None

    def _find_pending_pairing_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        normalized_code = code.upper()
        query_builders = [
            lambda: (
                self.supabase.table("therapist_clients")
                .select("*")
                .eq("pairing_code", normalized_code)
                .eq("status", "pending")
                .execute()
            ),
            lambda: (
                self.supabase.table("therapist_clients")
                .select("*")
                .eq("notes", self._pairing_marker(normalized_code))
                .eq("status", "pending")
                .execute()
            ),
        ]

        for build_query in query_builders:
            try:
                response = build_query()
                rows = [row for row in (response.data or []) if not row.get("client_id")]
                if rows:
                    selected = dict(rows[0])
                    selected["pairing_code"] = normalized_code
                    return selected
            except Exception:
                continue
        return None

    def _get_users_by_ids(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        normalized_ids = [user_id for user_id in dict.fromkeys(user_ids) if user_id]
        if not normalized_ids:
            return {}
        try:
            response = (
                self.supabase.table("users")
                .select("id, name, email, picture")
                .in_("id", normalized_ids)
                .execute()
            )
        except Exception:
            return {}
        return {
            row["id"]: row
            for row in (response.data or [])
            if isinstance(row, dict) and row.get("id")
        }

    def _safe_exact_count(
        self,
        table_name: str,
        eq_filters: Optional[Dict[str, Any]] = None,
        in_filters: Optional[Dict[str, List[Any]]] = None,
    ) -> int:
        try:
            query = self.supabase.table(table_name).select("id", count="exact")
            for key, value in (eq_filters or {}).items():
                query = query.eq(key, value)
            for key, values in (in_filters or {}).items():
                query = query.in_(key, values)
            response = query.execute()
            return int(response.count or 0)
        except Exception:
            return 0

    def _select_rows_by_column(
        self,
        table_name: str,
        column: str,
        value: Any,
        order_column: Optional[str] = "created_at",
        desc: bool = True,
        limit: Optional[int] = None,
        eq_filters: Optional[Dict[str, Any]] = None,
        in_filters: Optional[Dict[str, List[Any]]] = None,
    ) -> List[Dict[str, Any]]:
        def _build_query(include_order: bool):
            query = self.supabase.table(table_name).select("*").eq(column, value)
            for key, item in (eq_filters or {}).items():
                query = query.eq(key, item)
            for key, values in (in_filters or {}).items():
                if values:
                    query = query.in_(key, values)
            if include_order and order_column:
                query = query.order(order_column, desc=desc)
            if isinstance(limit, int) and limit > 0:
                query = query.limit(limit)
            return query

        for include_order in (True, False):
            try:
                response = _build_query(include_order).execute()
                return [row for row in (response.data or []) if isinstance(row, dict)]
            except Exception:
                continue
        return []

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

    def _latest_timestamp_from_rows(self, rows: List[Dict[str, Any]], fields: List[str]) -> Optional[datetime]:
        latest: Optional[datetime] = None
        for row in rows:
            if not isinstance(row, dict):
                continue
            for field in fields:
                parsed = self._parse_timestamp(row.get(field))
                if parsed and (latest is None or parsed > latest):
                    latest = parsed
        return latest

    def _iso_or_none(self, value: Optional[datetime]) -> Optional[str]:
        if not value:
            return None
        return value.astimezone(timezone.utc).isoformat()

    def _sharing_preferences(self, therapist_id: str, client_id: str) -> Dict[str, str]:
        try:
            response = (
                self.supabase.table("therapist_sharing_preferences")
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .limit(1)
                .execute()
            )
        except Exception:
            return {
                "ai_chat_access": "none",
                "web_activity_access": "none",
                "assessment_access": "none",
                "insights_access": "none",
            }
        row = response.data[0] if response.data else {}
        return {
            "ai_chat_access": str(row.get("ai_chat_access") or "none"),
            "web_activity_access": str(row.get("web_activity_access") or "none"),
            "assessment_access": str(row.get("assessment_access") or "none"),
            "insights_access": str(row.get("insights_access") or "none"),
        }

    def _has_deep_share_access(self, therapist_id: str, client_id: str) -> bool:
        preferences = self._sharing_preferences(therapist_id, client_id)
        return any(
            preferences.get(key) in {"ai_report", "direct"}
            for key in ("ai_chat_access", "web_activity_access", "assessment_access", "insights_access")
        )

    def _attach_client_users(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        users_by_id = self._get_users_by_ids(
            [
                row.get("client_id")
                for row in rows
                if isinstance(row, dict) and isinstance(row.get("client_id"), str)
            ]
        )
        enriched_rows: List[Dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            row_copy = dict(row)
            client_id = row_copy.get("client_id")
            if isinstance(client_id, str) and client_id in users_by_id:
                row_copy["users"] = users_by_id[client_id]
            enriched_rows.append(row_copy)
        return enriched_rows

    def _attach_therapist_to_pairing(self, pairing: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not pairing or not isinstance(pairing, dict):
            return pairing
        pairing_copy = dict(pairing)
        therapist_id = pairing_copy.get("therapist_id")
        if isinstance(therapist_id, str):
            therapist = self.get_therapist(therapist_id)
            if therapist:
                pairing_copy["therapist"] = therapist
        return pairing_copy

    def _select_rows(self, table_name: str, therapist_id: str, order_column: str = "created_at") -> List[Dict[str, Any]]:
        if not self._is_uuid_like(therapist_id):
            return []
        query = self.supabase.table(table_name).select("*").eq("therapist_id", therapist_id)
        try:
            response = query.order(order_column, desc=True).execute()
        except Exception:
            try:
                response = query.execute()
            except Exception:
                return []
        return response.data or []

    def _parse_json_list(self, value: Any) -> List[Any]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return []

    def _ensure_assignment_bucket(self) -> None:
        try:
            self.supabase.storage.create_bucket(ASSIGNMENT_SUBMISSION_BUCKET)
        except Exception:
            pass

    def _normalize_submission_attachments(self, attachments: Any) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in self._parse_json_list(attachments):
            if not isinstance(item, dict):
                continue
            path = item.get("path")
            name = item.get("name")
            if not isinstance(path, str) or not path.strip():
                continue
            if not isinstance(name, str) or not name.strip():
                name = Path(path).name
            row = {
                "path": path.strip(),
                "name": name.strip(),
                "mime_type": item.get("mime_type") if isinstance(item.get("mime_type"), str) else None,
                "size": item.get("size") if isinstance(item.get("size"), int) else None,
                "uploaded_at": item.get("uploaded_at") if isinstance(item.get("uploaded_at"), str) else None,
            }
            try:
                signed = self.supabase.storage.from_(ASSIGNMENT_SUBMISSION_BUCKET).create_signed_url(
                    row["path"],
                    ASSIGNMENT_SIGNED_URL_TTL,
                )
                if isinstance(signed, dict):
                    row["url"] = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
                else:
                    row["url"] = getattr(signed, "get", lambda *_args, **_kwargs: None)("signedURL")
            except Exception:
                row["url"] = None
            normalized.append(row)
        return normalized

    def _normalize_checklist_items(self, checklist_items: Any) -> List[Dict[str, str]]:
        normalized: List[Dict[str, str]] = []
        seen_ids: set[str] = set()

        for index, item in enumerate(self._parse_json_list(checklist_items)):
            label = ""
            item_id = ""

            if isinstance(item, str):
                label = item.strip()
            elif isinstance(item, dict):
                raw_label = item.get("label")
                raw_id = item.get("id")
                if isinstance(raw_label, str):
                    label = raw_label.strip()
                if isinstance(raw_id, str):
                    item_id = raw_id.strip()

            if not label:
                continue

            if not item_id:
                item_id = f"step-{index + 1}"

            if item_id in seen_ids:
                suffix = 2
                candidate = f"{item_id}-{suffix}"
                while candidate in seen_ids:
                    suffix += 1
                    candidate = f"{item_id}-{suffix}"
                item_id = candidate

            seen_ids.add(item_id)
            normalized.append({"id": item_id, "label": label})

        return normalized

    def _normalize_checked_item_ids(self, checked_item_ids: Any, checklist_items: List[Dict[str, str]]) -> List[str]:
        allowed_ids = {
            item["id"]
            for item in checklist_items
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        normalized: List[str] = []

        for item_id in self._parse_json_list(checked_item_ids):
            if not isinstance(item_id, str):
                continue
            cleaned = item_id.strip()
            if not cleaned or cleaned not in allowed_ids or cleaned in normalized:
                continue
            normalized.append(cleaned)

        return normalized

    def _parse_due_date(self, value: Any) -> Optional[date]:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            return date.fromisoformat(value.strip()[:10])
        except Exception:
            return None

    def _hydrate_assignment(self, assignment: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not assignment or not isinstance(assignment, dict):
            return None

        row = dict(assignment)
        checklist_items = self._normalize_checklist_items(row.get("checklist_items"))
        checked_item_ids = self._normalize_checked_item_ids(row.get("checked_item_ids"), checklist_items)
        total_steps = len(checklist_items)
        status = str(row.get("status") or "pending")

        if total_steps > 0:
            completed_steps = total_steps if status == "completed" else len(checked_item_ids)
            progress_percent = 100 if status == "completed" else int((completed_steps / total_steps) * 100)
        else:
            completed_steps = 0
            progress_percent = 100 if status == "completed" else 0

        due_date_value = self._parse_due_date(row.get("due_date"))
        today_local = datetime.now(LOCAL_TZ).date()
        is_overdue = bool(
            due_date_value
            and due_date_value < today_local
            and status not in {"completed", "cancelled", "skipped"}
        )

        row["type"] = row.get("type") or "task"
        row["priority"] = row.get("priority") or "medium"
        row["checklist_items"] = checklist_items
        row["checked_item_ids"] = checked_item_ids
        row["completion_notes"] = row.get("completion_notes") or row.get("client_feedback")
        row["submission_attachments"] = self._normalize_submission_attachments(row.get("submission_attachments"))
        row["completed_steps"] = completed_steps
        row["total_steps"] = total_steps
        row["progress_percent"] = progress_percent
        row["is_overdue"] = is_overdue
        return row

    def _hydrate_assignments(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        hydrated: List[Dict[str, Any]] = []
        for row in rows:
            normalized = self._hydrate_assignment(row)
            if normalized:
                hydrated.append(normalized)
        return hydrated

    def _update_assignment_row(self, assignment_id: int, payload_variants: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for payload in payload_variants:
            try:
                response = (
                    self.supabase.table("assignments")
                    .update(payload)
                    .eq("id", assignment_id)
                    .execute()
                )
                if response.data:
                    return response.data[0]
            except Exception:
                continue
        return None

    def get_therapist(self, therapist_identifier: str) -> Optional[Dict[str, Any]]:
        candidates: List[Dict[str, Any]] = []

        try:
            response = self.supabase.table("therapists").select("*").eq("user_id", therapist_identifier).execute()
            candidates.extend(response.data or [])
        except Exception:
            pass

        try:
            response = self.supabase.table("therapists").select("*").eq("id", therapist_identifier).execute()
            candidates.extend(response.data or [])
        except Exception:
            pass

        return self._choose_preferred_therapist(candidates, user_id=therapist_identifier)

    def create_therapist(self, email: str, name: str, license_number: str = None, user_id: str = None) -> Optional[Dict[str, Any]]:
        created_at = self._now()
        therapist_id = self._new_therapist_id()
        variants = [
            {
                "id": therapist_id,
                "user_id": user_id,
                "email": email,
                "name": name,
                "license_number": license_number,
                "created_at": created_at,
            },
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "license_number": license_number,
                "created_at": created_at,
            },
            {
                "id": therapist_id,
                "email": email,
                "name": name,
                "license_number": license_number,
                "created_at": created_at,
            },
            {
                "email": email,
                "name": name,
                "license_number": license_number,
                "created_at": created_at,
            },
        ]

        for variant in variants:
            payload = {key: value for key, value in variant.items() if value is not None}
            try:
                response = self.supabase.table("therapists").insert(payload).execute()
                if response.data:
                    return response.data[0]
            except Exception:
                continue

        return self.get_therapist(user_id) if user_id else None

    def ensure_therapist_profile(self, user_id: str, email: str = "", name: str = "") -> Optional[Dict[str, Any]]:
        existing = self.get_therapist(user_id)
        if existing:
            if existing.get("user_id") != user_id:
                try:
                    updated = (
                        self.supabase.table("therapists")
                        .update({"user_id": user_id, "updated_at": self._now()})
                        .eq("id", existing["id"])
                        .execute()
                    )
                    if updated.data:
                        existing = updated.data[0]
                except Exception:
                    pass

            preferred = self.get_therapist(user_id) or existing
            if preferred and self._is_uuid_like(preferred.get("id")):
                return preferred

        return self.create_therapist(email=email or "", name=name or "Therapist", user_id=user_id)

    def _resolve_therapist_id(self, therapist_identifier: str) -> Optional[str]:
        therapist = self.get_therapist(therapist_identifier)
        if not therapist:
            return None
        therapist_id = therapist.get("id")
        return therapist_id if isinstance(therapist_id, str) else None

    def get_my_clients(self, therapist_identifier: str) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        rows = self._select_rows("therapist_clients", therapist_id, order_column="paired_at")
        rows = [row for row in rows if row.get("status") == "active" and row.get("client_id")]
        return self._attach_client_users(rows)

    def has_active_relationship(self, therapist_identifier: str, client_id: str) -> bool:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return False
        response = (
            self.supabase.table("therapist_clients")
            .select("id")
            .eq("therapist_id", therapist_id)
            .eq("client_id", client_id)
            .eq("status", "active")
            .execute()
        )
        return bool(response.data)

    def create_pairing_code(self, therapist_identifier: str) -> Optional[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return None
        code = self._generate_pairing_code()
        self._clear_local_codes_for_therapist(therapist_id)
        pending = (
            self.supabase.table("therapist_clients")
            .select("*")
            .eq("therapist_id", therapist_id)
            .eq("status", "pending")
            .execute()
        )
        pending_rows = [row for row in (pending.data or []) if not row.get("client_id")]
        if pending_rows:
            updated_row = self._update_pairing_row(
                pending_rows[0]["id"],
                [
                    {"pairing_code": code, "updated_at": self._now()},
                    {"pairing_code": code},
                    {"notes": self._pairing_marker(code), "updated_at": self._now()},
                    {"notes": self._pairing_marker(code)},
                ],
            ) or pending_rows[0]
            updated_row = dict(updated_row)
            updated_row["pairing_code"] = code
            self._store_local_pairing_code(therapist_id, code)
            return updated_row

        payload_variants = [
            {
                "therapist_id": therapist_id,
                "client_id": None,
                "status": "pending",
                "pairing_code": code,
                "created_at": self._now(),
                "updated_at": self._now(),
            },
            {
                "therapist_id": therapist_id,
                "client_id": None,
                "status": "pending",
                "pairing_code": code,
                "created_at": self._now(),
            },
            {
                "therapist_id": therapist_id,
                "status": "pending",
                "pairing_code": code,
            },
            {
                "therapist_id": therapist_id,
                "client_id": None,
                "status": "pending",
                "notes": self._pairing_marker(code),
                "created_at": self._now(),
                "updated_at": self._now(),
            },
            {
                "therapist_id": therapist_id,
                "status": "pending",
                "notes": self._pairing_marker(code),
            },
        ]

        for payload in payload_variants:
            try:
                response = self.supabase.table("therapist_clients").insert(payload).execute()
                if response.data:
                    row = dict(response.data[0])
                    row["pairing_code"] = code
                    self._store_local_pairing_code(therapist_id, code)
                    return row
            except Exception:
                continue

        fallback = self._find_pending_pairing_by_code(code)
        if fallback and fallback.get("therapist_id") == therapist_id:
            self._store_local_pairing_code(therapist_id, code)
            return fallback
        return self._store_local_pairing_code(therapist_id, code)

    def pair_client(self, therapist_identifier: str, client_id: str, pairing_code: str = None) -> Optional[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return None
        existing = (
            self.supabase.table("therapist_clients")
            .select("*")
            .eq("therapist_id", therapist_id)
            .eq("client_id", client_id)
            .execute()
        )
        if existing.data:
            updated = self._update_pairing_row(
                existing.data[0]["id"],
                [
                    {"status": "active", "paired_at": self._now(), "pairing_code": None, "updated_at": self._now()},
                    {"status": "active", "paired_at": self._now(), "notes": None, "updated_at": self._now()},
                    {"status": "active", "paired_at": self._now(), "pairing_code": None},
                    {"status": "active", "paired_at": self._now(), "notes": None},
                    {"status": "active", "paired_at": self._now(), "updated_at": self._now()},
                    {"status": "active", "paired_at": self._now()},
                ],
            )
            row = updated or existing.data[0]
            row = dict(row)
            row["pairing_code"] = None
            return row
        payload_variants = [
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "paired_at": self._now(),
                "status": "active",
                "pairing_code": pairing_code,
                "created_at": self._now(),
                "updated_at": self._now(),
            },
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "paired_at": self._now(),
                "status": "active",
                "notes": None,
                "created_at": self._now(),
                "updated_at": self._now(),
            },
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "paired_at": self._now(),
                "status": "active",
                "created_at": self._now(),
                "updated_at": self._now(),
            },
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "paired_at": self._now(),
                "status": "active",
            },
        ]
        for payload in payload_variants:
            try:
                response = self.supabase.table("therapist_clients").insert(payload).execute()
                if response.data:
                    row = dict(response.data[0])
                    row["pairing_code"] = pairing_code
                    return row
            except Exception:
                continue
        return None

    def connect_client_by_code(self, client_id: str, pairing_code: str) -> Optional[Dict[str, Any]]:
        existing = self.get_client_therapist(client_id)
        if existing:
            return existing
        selected = self._find_pending_pairing_by_code(pairing_code)
        if selected:
            updated = self._update_pairing_row(
                selected["id"],
                [
                    {
                        "client_id": client_id,
                        "status": "active",
                        "paired_at": self._now(),
                        "pairing_code": None,
                        "updated_at": self._now(),
                    },
                    {
                        "client_id": client_id,
                        "status": "active",
                        "paired_at": self._now(),
                        "notes": None,
                        "updated_at": self._now(),
                    },
                    {
                        "client_id": client_id,
                        "status": "active",
                        "paired_at": self._now(),
                        "pairing_code": None,
                    },
                    {
                        "client_id": client_id,
                        "status": "active",
                        "paired_at": self._now(),
                        "notes": None,
                    },
                    {
                        "client_id": client_id,
                        "status": "active",
                        "paired_at": self._now(),
                        "updated_at": self._now(),
                    },
                    {
                        "client_id": client_id,
                        "status": "active",
                        "paired_at": self._now(),
                    },
                ],
            )
            if updated and updated.get("client_id") == client_id and updated.get("status") == "active":
                updated_row = dict(updated)
                updated_row["pairing_code"] = None
                self._pop_local_pairing_code(pairing_code)
                return self._attach_therapist_to_pairing(updated_row)

            therapist_id = selected.get("therapist_id")
            if isinstance(therapist_id, str):
                paired = self.pair_client(therapist_id, client_id)
                if paired:
                    self._pop_local_pairing_code(pairing_code)
                    return self._attach_therapist_to_pairing(paired)

        local_entry = self._get_local_pairing_code(pairing_code)
        if not local_entry or not isinstance(local_entry.get("therapist_id"), str):
            return None

        paired = self.pair_client(local_entry["therapist_id"], client_id)
        if not paired:
            return None
        self._pop_local_pairing_code(pairing_code)
        return self._attach_therapist_to_pairing(paired)

    def unpair_client(self, therapist_identifier: str, client_id: str) -> bool:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return False
        self.supabase.table("therapist_clients").update(
            {"status": "inactive", "updated_at": self._now()}
        ).eq("therapist_id", therapist_id).eq("client_id", client_id).execute()
        return True

    def get_client_therapist(self, client_id: str) -> Optional[Dict[str, Any]]:
        response = (
            self.supabase.table("therapist_clients")
            .select("*")
            .eq("client_id", client_id)
            .eq("status", "active")
            .execute()
        )
        if not response.data:
            return None
        return self._attach_therapist_to_pairing(response.data[0])

    # === Assignments ===

    def create_assignment(
        self,
        therapist_identifier: str,
        client_id: str,
        title: str,
        description: str,
        assignment_type: str = "task",
        priority: str = "medium",
        due_date: str = None,
        checklist_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return None

        normalized_checklist = self._normalize_checklist_items(checklist_items or [])
        created_at = self._now()
        payload_variants = [
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "title": title,
                "description": description,
                "type": assignment_type,
                "priority": priority,
                "due_date": due_date,
                "checklist_items": normalized_checklist,
                "checked_item_ids": [],
                "status": "pending",
                "created_at": created_at,
                "updated_at": created_at,
            },
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "title": title,
                "description": description,
                "type": assignment_type,
                "priority": priority,
                "due_date": due_date,
                "status": "pending",
                "created_at": created_at,
                "updated_at": created_at,
            },
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "title": title,
                "description": description,
                "due_date": due_date,
                "status": "pending",
                "created_at": created_at,
                "updated_at": created_at,
            },
        ]

        for payload in payload_variants:
            try:
                response = self.supabase.table("assignments").insert(payload).execute()
                if response.data:
                    return self._hydrate_assignment(response.data[0])
            except Exception:
                continue
        return None

    def get_client_assignments(self, client_id: str, status: str = None) -> List[Dict[str, Any]]:
        query = self.supabase.table("assignments").select("*").eq("client_id", client_id)
        if status:
            query = query.eq("status", status)
        try:
            response = query.order("created_at", desc=True).execute()
        except Exception:
            response = query.execute()
        return self._hydrate_assignments(response.data or [])

    def get_therapist_assignments(self, therapist_identifier: str) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        rows = self._select_rows("assignments", therapist_id)
        return self._hydrate_assignments(self._attach_client_users(rows))

    def get_assignment(self, assignment_id: int) -> Optional[Dict[str, Any]]:
        response = (
            self.supabase.table("assignments")
            .select("*")
            .eq("id", assignment_id)
            .limit(1)
            .execute()
        )
        return self._hydrate_assignment(response.data[0]) if response.data else None

    def update_assignment_progress(
        self,
        assignment_id: int,
        checked_item_ids: Optional[List[str]] = None,
        completion_notes: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        assignment = self.get_assignment(assignment_id)
        if not assignment:
            return None

        checklist_items = assignment.get("checklist_items") or []
        normalized_checked = self._normalize_checked_item_ids(
            checked_item_ids if checked_item_ids is not None else assignment.get("checked_item_ids"),
            checklist_items if isinstance(checklist_items, list) else [],
        )

        cleaned_notes = completion_notes if isinstance(completion_notes, str) else assignment.get("completion_notes")
        has_progress = bool(normalized_checked or (isinstance(cleaned_notes, str) and cleaned_notes.strip()))
        current_status = str(assignment.get("status") or "pending")
        next_status = current_status

        if current_status not in {"completed", "cancelled", "skipped"} and has_progress:
            next_status = "in_progress"

        now_value = self._now()
        payload_variants = [
            {
                "checked_item_ids": normalized_checked,
                "completion_notes": cleaned_notes,
                "client_feedback": cleaned_notes,
                "status": next_status,
                "started_at": assignment.get("started_at") or (now_value if has_progress else None),
                "last_progress_at": now_value,
                "updated_at": now_value,
            },
            {
                "client_feedback": cleaned_notes,
                "status": next_status,
                "updated_at": now_value,
            },
            {
                "status": next_status,
                "updated_at": now_value,
            },
        ]
        updated = self._update_assignment_row(assignment_id, payload_variants)
        return self._hydrate_assignment(updated) if updated else None

    def complete_assignment(self, assignment_id: int, completion_notes: str = None) -> Optional[Dict[str, Any]]:
        assignment = self.get_assignment(assignment_id)
        if not assignment:
            return None

        checklist_items = assignment.get("checklist_items") or []
        checklist_ids = [
            item["id"]
            for item in checklist_items
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]
        cleaned_notes = completion_notes if isinstance(completion_notes, str) else assignment.get("completion_notes")
        now_value = self._now()

        payload_variants = [
            {
                "status": "completed",
                "completed_at": now_value,
                "completion_notes": cleaned_notes,
                "client_feedback": cleaned_notes,
                "checked_item_ids": checklist_ids,
                "last_progress_at": now_value,
                "updated_at": now_value,
            },
            {
                "status": "completed",
                "completed_at": now_value,
                "client_feedback": cleaned_notes,
                "updated_at": now_value,
            },
            {
                "status": "completed",
                "completed_at": now_value,
                "updated_at": now_value,
            },
        ]
        updated = self._update_assignment_row(assignment_id, payload_variants)
        hydrated = self._hydrate_assignment(updated) if updated else None
        client_id = str((hydrated or assignment).get("client_id") or "")
        if client_id:
            try:
                from trajectory_service import get_trajectory_service

                trajectory_service = get_trajectory_service()
                trajectory_service.log_event(
                    client_id,
                    "assignment_completed",
                    {"assignment_id": assignment_id},
                    dedupe_seconds=0,
                )
                trajectory_service.recompute_snapshot(client_id, trigger="manual")
            except Exception:
                pass
        return hydrated

    def add_assignment_submission_attachments(
        self,
        assignment_id: int,
        client_id: str,
        files: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        assignment = self.get_assignment(assignment_id)
        if not assignment or assignment.get("client_id") != client_id:
            return None

        if not files:
            return assignment

        self._ensure_assignment_bucket()
        uploaded_entries: List[Dict[str, Any]] = []
        timestamp_prefix = datetime.now(LOCAL_TZ).strftime("%Y%m%d%H%M%S")

        for index, file_info in enumerate(files):
            filename = file_info.get("filename")
            content = file_info.get("content")
            mime_type = file_info.get("mime_type")
            size = file_info.get("size")
            if not isinstance(filename, str) or not filename.strip() or not isinstance(content, bytes):
                continue

            safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)
            object_path = f"{client_id}/assignment-{assignment_id}/{timestamp_prefix}-{index}-{safe_name}"
            upload_options = {"content-type": mime_type} if isinstance(mime_type, str) and mime_type else None

            self.supabase.storage.from_(ASSIGNMENT_SUBMISSION_BUCKET).upload(
                object_path,
                content,
                file_options=upload_options,
            )
            uploaded_entries.append(
                {
                    "path": object_path,
                    "name": Path(filename).name,
                    "mime_type": mime_type if isinstance(mime_type, str) else None,
                    "size": size if isinstance(size, int) else None,
                    "uploaded_at": self._now(),
                }
            )

        if not uploaded_entries:
            return assignment

        existing_attachments = self._parse_json_list(assignment.get("submission_attachments"))
        merged_attachments = existing_attachments + uploaded_entries
        now_value = self._now()
        payload_variants = [
            {
                "submission_attachments": merged_attachments,
                "status": "in_progress" if assignment.get("status") == "pending" else assignment.get("status"),
                "started_at": assignment.get("started_at") or now_value,
                "last_progress_at": now_value,
                "updated_at": now_value,
            },
        ]
        updated = self._update_assignment_row(assignment_id, payload_variants)
        if updated:
            return self._hydrate_assignment(updated)

        try:
            self.supabase.storage.from_(ASSIGNMENT_SUBMISSION_BUCKET).remove(
                [entry["path"] for entry in uploaded_entries if isinstance(entry.get("path"), str)]
            )
        except Exception:
            pass
        return None

    def get_assignments_due_for_reminder(self, lookahead_hours: int = 24) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("assignments")
                .select("*")
                .in_("status", ["pending", "in_progress"])
                .execute()
            )
        except Exception:
            return []

        now_local = datetime.now(LOCAL_TZ)
        reminder_window = timedelta(hours=max(lookahead_hours, 1))
        due_assignments: List[Dict[str, Any]] = []

        for assignment in self._hydrate_assignments(response.data or []):
            if not isinstance(assignment, dict):
                continue
            if assignment.get("near_due_reminded_at"):
                continue

            client_id = assignment.get("client_id")
            if not isinstance(client_id, str) or not client_id:
                continue

            due_date_value = self._parse_due_date(assignment.get("due_date"))
            if not due_date_value:
                continue

            due_at = datetime.combine(due_date_value, time(hour=23, minute=59, second=59), LOCAL_TZ)
            if now_local < due_at - reminder_window:
                continue

            due_assignments.append(assignment)

        return due_assignments

    def mark_assignment_near_due_reminded(self, assignment_id: int) -> bool:
        payload_variants = [
            {
                "near_due_reminded_at": self._now(),
                "updated_at": self._now(),
            },
            {
                "updated_at": self._now(),
            },
        ]
        return bool(self._update_assignment_row(assignment_id, payload_variants))

    # === Messaging ===

    def get_messages(self, therapist_identifier: str, client_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        try:
            response = (
                self.supabase.table("therapist_client_messages")
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
        except Exception:
            response = (
                self.supabase.table("therapist_client_messages")
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .limit(limit)
                .execute()
            )
        return response.data or []

    def send_message(
        self,
        therapist_identifier: str,
        client_id: str,
        sender_type: str,
        message_content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return None
        response = self.supabase.table("therapist_client_messages").insert(
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "sender_type": sender_type,
                "message_content": message_content,
                "attachments": attachments or [],
                "is_read": False,
                "created_at": self._now(),
            }
        ).execute()
        return response.data[0] if response.data else None

    def get_client_messages(self, client_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        pairing = self.get_client_therapist(client_id)
        if not pairing or not isinstance(pairing.get("therapist_id"), str):
            return []
        try:
            response = (
                self.supabase.table("therapist_client_messages")
                .select("*")
                .eq("therapist_id", pairing["therapist_id"])
                .eq("client_id", client_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
        except Exception:
            response = (
                self.supabase.table("therapist_client_messages")
                .select("*")
                .eq("therapist_id", pairing["therapist_id"])
                .eq("client_id", client_id)
                .limit(limit)
                .execute()
            )
        return response.data or []

    def send_client_message(self, client_id: str, message_content: str, attachments: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
        pairing = self.get_client_therapist(client_id)
        if not pairing or not isinstance(pairing.get("therapist_id"), str):
            return None
        response = self.supabase.table("therapist_client_messages").insert(
            {
                "therapist_id": pairing["therapist_id"],
                "client_id": client_id,
                "sender_type": "client",
                "message_content": message_content,
                "attachments": attachments or [],
                "is_read": False,
                "created_at": self._now(),
            }
        ).execute()
        return response.data[0] if response.data else None

    def mark_messages_as_read(self, therapist_identifier: str, client_id: str, sender_type: str) -> bool:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return False
        self.supabase.table("therapist_client_messages").update(
            {"is_read": True, "read_at": self._now()}
        ).eq("therapist_id", therapist_id).eq("client_id", client_id).eq("sender_type", sender_type).eq("is_read", False).execute()
        return True

    def mark_client_messages_as_read(self, client_id: str) -> bool:
        pairing = self.get_client_therapist(client_id)
        if not pairing or not isinstance(pairing.get("therapist_id"), str):
            return False
        self.supabase.table("therapist_client_messages").update(
            {"is_read": True, "read_at": self._now()}
        ).eq("therapist_id", pairing["therapist_id"]).eq("client_id", client_id).eq("sender_type", "therapist").eq("is_read", False).execute()
        return True

    def get_unread_message_count(self, therapist_identifier: str, client_id: str = None) -> int:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return 0
        query = (
            self.supabase.table("therapist_client_messages")
            .select("id", count="exact")
            .eq("therapist_id", therapist_id)
            .eq("sender_type", "client")
            .eq("is_read", False)
        )
        if client_id:
            query = query.eq("client_id", client_id)
        response = query.execute()
        return response.count if response.count else 0

    def get_recent_conversations(self, therapist_identifier: str, limit: int = 20) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        response = (
            self.supabase.table("therapist_client_messages")
            .select("*")
            .eq("therapist_id", therapist_id)
            .order("created_at", desc=True)
            .limit(limit * 10)
            .execute()
        )
        conversations: Dict[str, Dict[str, Any]] = {}
        for message in response.data or []:
            client_id = message.get("client_id")
            if not isinstance(client_id, str):
                continue
            if client_id not in conversations:
                conversations[client_id] = {
                    "client_id": client_id,
                    "last_message": message.get("message_content"),
                    "last_sender": message.get("sender_type"),
                    "last_time": message.get("created_at"),
                    "unread_count": 0,
                }
            if message.get("sender_type") == "client" and not message.get("is_read", False):
                conversations[client_id]["unread_count"] += 1
        users_by_id = self._get_users_by_ids(list(conversations.keys()))
        for client_id, conversation in conversations.items():
            conversation["client"] = users_by_id.get(
                client_id,
                {"id": client_id, "name": client_id, "email": "", "picture": None},
            )
        return list(conversations.values())[:limit]

    # === Appointments ===

    def get_appointments(self, therapist_identifier: str, client_id: str = None, status: str = None) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        query = self.supabase.table("appointments").select("*").eq("therapist_id", therapist_id)
        if client_id:
            query = query.eq("client_id", client_id)
        if status:
            query = query.eq("status", status)
        try:
            response = query.order("appointment_date", desc=False).execute()
        except Exception:
            response = query.execute()
        return self._attach_client_users(response.data or [])

    def get_client_appointments(self, client_id: str) -> List[Dict[str, Any]]:
        query = self.supabase.table("appointments").select("*").eq("client_id", client_id)
        try:
            response = query.order("appointment_date", desc=False).execute()
        except Exception:
            response = query.execute()
        return response.data or []

    def create_appointment(
        self,
        therapist_identifier: str,
        client_id: str,
        appointment_date: str,
        duration_minutes: int = 60,
        appointment_type: str = "online",
        location: str = None,
        meeting_link: str = None,
        notes: str = None,
    ) -> Optional[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return None
        response = self.supabase.table("appointments").insert(
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "appointment_date": appointment_date,
                "duration_minutes": duration_minutes,
                "type": appointment_type,
                "location": location,
                "meeting_link": meeting_link,
                "notes": notes,
                "status": "scheduled",
                "therapist_confirmed": True,
                "client_confirmed": False,
                "created_at": self._now(),
                "updated_at": self._now(),
            }
        ).execute()
        return response.data[0] if response.data else None

    def cancel_appointment(self, appointment_id: int, therapist_identifier: str, reason: str = None) -> bool:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return False
        self.supabase.table("appointments").update(
            {"status": "cancelled", "cancellation_reason": reason, "updated_at": self._now()}
        ).eq("id", appointment_id).eq("therapist_id", therapist_id).execute()
        return True

    def complete_appointment(self, appointment_id: int, therapist_identifier: str) -> bool:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return False
        self.supabase.table("appointments").update(
            {"status": "completed", "updated_at": self._now()}
        ).eq("id", appointment_id).eq("therapist_id", therapist_id).execute()
        return True

    def confirm_client_appointment(self, client_id: str, appointment_id: int) -> bool:
        self.supabase.table("appointments").update(
            {"client_confirmed": True, "updated_at": self._now()}
        ).eq("id", appointment_id).eq("client_id", client_id).execute()
        return True

    # === Crisis ===

    def log_crisis_event(self, client_id: str, crisis_level: str, message_snippet: str) -> Optional[Dict[str, Any]]:
        pairing = self.get_client_therapist(client_id)
        therapist_id = pairing.get("therapist_id") if pairing else None
        legacy_data = {
            "client_id": client_id,
            "therapist_id": therapist_id,
            "crisis_level": crisis_level,
            "message_snippet": message_snippet[:200],
            "created_at": self._now(),
            "acknowledged": False,
        }
        try:
            response = self.supabase.table("crisis_events").insert(legacy_data).execute()
        except Exception:
            response = self.supabase.table("crisis_events").insert(
                {
                    "client_id": client_id,
                    "therapist_id": therapist_id,
                    "severity": crisis_level.lower(),
                    "description": message_snippet[:200],
                    "trigger_source": "ai_detection",
                    "status": "new",
                    "detected_at": self._now(),
                    "created_at": self._now(),
                    "updated_at": self._now(),
                }
            ).execute()
        event = response.data[0] if response.data else None

        therapist = self.get_therapist(str(therapist_id)) if therapist_id else None
        therapist_user_id = therapist.get("user_id") if isinstance(therapist, dict) else None
        if isinstance(therapist_user_id, str) and therapist_user_id:
            try:
                from push_service import get_push_service

                get_push_service().send_push_to_user(
                    user_id=therapist_user_id,
                    title="Canh bao tu AI",
                    body=f"Phat hien dau hieu {crisis_level.lower()} o than chu. Can xem ngay.",
                    url="/therapist/messages",
                    tag="ai-crisis-alert",
                    extra={
                        "kind": "crisis_alert",
                        "client_id": client_id,
                        "crisis_level": crisis_level.lower(),
                        "message_snippet": message_snippet[:200],
                    },
                )
            except Exception:
                pass

        return event

    def get_unacknowledged_crises(self, therapist_identifier: str) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        rows = self._attach_client_users(self._select_rows("crisis_events", therapist_id, order_column="detected_at"))
        open_rows: List[Dict[str, Any]] = []
        for row in rows:
            if row.get("acknowledged") is False:
                open_rows.append(row)
                continue
            status = row.get("status")
            if isinstance(status, str) and status not in {"acknowledged", "resolved"}:
                open_rows.append(row)
        return open_rows

    def acknowledge_crisis(self, crisis_id: int, notes: str = None) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("crisis_events")
                .update({"acknowledged": True, "acknowledged_at": self._now(), "therapist_notes": notes})
                .eq("id", crisis_id)
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception:
            response = (
                self.supabase.table("crisis_events")
                .update({"status": "acknowledged", "resolution_notes": notes, "updated_at": self._now()})
                .eq("id", crisis_id)
                .execute()
            )
            return response.data[0] if response.data else None

    # === Summary ===

    def get_crisis_event(self, crisis_id: int) -> Optional[Dict[str, Any]]:
        response = (
            self.supabase.table("crisis_events")
            .select("*")
            .eq("id", crisis_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_client_summary(
        self,
        client_id: str,
        therapist_identifier: Optional[str] = None,
        client_row: Optional[Dict[str, Any]] = None,
        open_crises: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        therapist_id = self._resolve_therapist_id(therapist_identifier) if therapist_identifier else None
        now_value = datetime.now(timezone.utc)
        client_user = None
        if isinstance(client_row, dict) and isinstance(client_row.get("users"), dict):
            client_user = client_row.get("users")
        if not isinstance(client_user, dict):
            client_user = self._get_users_by_ids([client_id]).get(
                client_id,
                {"id": client_id, "name": client_id, "email": "", "picture": None},
            )

        assignments = self.get_client_assignments(client_id)
        completed_assignments = sum(1 for item in assignments if str(item.get("status") or "").lower() == "completed")
        pending_assignment_rows = [
            item for item in assignments if str(item.get("status") or "").lower() in {"pending", "in_progress"}
        ]
        overdue_assignments = sum(
            1
            for item in pending_assignment_rows
            if (due_dt := self._parse_timestamp(item.get("due_date"))) and due_dt < now_value
        )

        message_filters = {"therapist_id": therapist_id} if therapist_id else None
        message_rows = self._select_rows_by_column(
            "therapist_client_messages",
            "client_id",
            client_id,
            order_column="created_at",
            desc=True,
            limit=80,
            eq_filters=message_filters,
        )
        unread_client_messages = sum(
            1
            for row in message_rows
            if str(row.get("sender_type") or "") == "client" and not bool(row.get("is_read"))
        )
        latest_client_message_at = self._latest_timestamp_from_rows(
            [row for row in message_rows if str(row.get("sender_type") or "") == "client"],
            ["created_at"],
        )
        latest_therapist_message_at = self._latest_timestamp_from_rows(
            [row for row in message_rows if str(row.get("sender_type") or "") == "therapist"],
            ["created_at", "read_at"],
        )

        appointments = self.get_appointments(therapist_id, client_id) if therapist_id else self.get_client_appointments(client_id)
        upcoming_appointments: List[Dict[str, Any]] = []
        today_appointments: List[Dict[str, Any]] = []
        for appointment in appointments:
            appointment_dt = self._parse_timestamp(appointment.get("appointment_date"))
            if not appointment_dt:
                continue
            status = str(appointment.get("status") or "scheduled").lower()
            if status in {"cancelled", "completed"}:
                continue
            if appointment_dt >= now_value:
                upcoming_appointments.append(appointment)
            local_appointment_date = appointment_dt.astimezone(LOCAL_TZ).date()
            if local_appointment_date == now_value.astimezone(LOCAL_TZ).date():
                today_appointments.append(appointment)
        next_appointment_at = self._latest_timestamp_from_rows(
            sorted(
                upcoming_appointments,
                key=lambda item: self._parse_timestamp(item.get("appointment_date")) or now_value,
            )[:1],
            ["appointment_date"],
        )

        pending_assessment_rows = [
            row
            for row in self._select_rows_by_column(
                "assessment_assignments",
                "client_id",
                client_id,
                order_column="assigned_at",
                desc=True,
                eq_filters={"therapist_id": therapist_id} if therapist_id else None,
            )
            if str(row.get("status") or "assigned").lower() not in {"completed", "cancelled"}
        ]

        active_crises = [
            row
            for row in (open_crises or [])
            if isinstance(row, dict) and str(row.get("client_id") or "") == client_id
        ]
        if not active_crises and therapist_id:
            active_crises = [
                row
                for row in self.get_unacknowledged_crises(therapist_id)
                if isinstance(row, dict) and str(row.get("client_id") or "") == client_id
            ]
        open_crisis_count = len(active_crises)

        deep_share_enabled = bool(therapist_id) and self._has_deep_share_access(therapist_id, client_id)
        analyzed_rows = (
            self._select_rows_by_column("analyzed_sessions", "user_id", client_id, order_column="analyzed_at", desc=True, limit=3)
            if deep_share_enabled
            else []
        )
        journal_rows = (
            self._select_rows_by_column("journal_entries", "user_id", client_id, order_column="created_at", desc=True, limit=3)
            if deep_share_enabled
            else []
        )
        checkin_rows = (
            self._select_rows_by_column("moment_checkins", "user_id", client_id, order_column="created_at", desc=True, limit=5)
            if deep_share_enabled
            else []
        )
        latest_checkin_score = None
        if checkin_rows:
            try:
                latest_checkin_score = float(checkin_rows[0].get("emotion_score"))
            except Exception:
                latest_checkin_score = None

        summary_candidates: List[str] = []
        if analyzed_rows:
            latest_analysis = analyzed_rows[0]
            for key in ("ai_summary", "facts_content"):
                value = latest_analysis.get(key)
                if isinstance(value, str) and value.strip():
                    summary_candidates.append(value.strip())
        if journal_rows:
            journal_text = journal_rows[0].get("content")
            if isinstance(journal_text, str) and journal_text.strip():
                summary_candidates.append(journal_text.strip())
        combined_text = " ".join(summary_candidates).lower()

        trajectory_summary = None
        trajectory_share_enabled = False
        if therapist_id:
            try:
                trajectory_share_enabled = (
                    str(self._sharing_preferences(therapist_id, client_id).get("insights_access") or "none")
                    in {"ai_report", "direct"}
                )
                from trajectory_service import get_trajectory_service

                candidate = get_trajectory_service().get_clinician_summary(client_id, therapist_id)
                if candidate.get("visible"):
                    trajectory_summary = candidate
            except Exception:
                trajectory_summary = None

        if trajectory_summary:
            trajectory_state = str(
                trajectory_summary.get("trajectory_state")
                or trajectory_summary.get("chapter_title")
                or "Đang cần theo dõi thêm"
            )
            trend_summary = str(
                trajectory_summary.get("trend_summary")
                or trajectory_summary.get("reflection_text")
                or "Miru đã có bản tóm tắt clinician-safe cho ca này."
            )
        elif not deep_share_enabled:
            trajectory_state = "Chưa có dữ liệu chia sẻ sâu"
            trend_summary = "Thân chủ chưa bật chia sẻ AI hoặc insights. Miru đang hiển thị các tín hiệu vận hành cơ bản."
        elif open_crisis_count > 0 or (latest_checkin_score is not None and latest_checkin_score <= 3):
            trajectory_state = "Quá tải gần đây"
            trend_summary = (summary_candidates[0] if summary_candidates else "Các tín hiệu gần đây cho thấy thân chủ cần được theo dõi sát hơn.")[:220]
        elif any(keyword in combined_text for keyword in ["né", "tránh", "im lặng", "thu mình", "một mình", "cô lập"]):
            trajectory_state = "Có dấu hiệu cô lập"
            trend_summary = (summary_candidates[0] if summary_candidates else "Nội dung gần đây cho thấy xu hướng thu mình hoặc tránh né.")[:220]
        elif any(keyword in combined_text for keyword in ["mở lời", "chia sẻ", "kết nối", "thổ lộ"]):
            trajectory_state = "Bắt đầu mở lời"
            trend_summary = (summary_candidates[0] if summary_candidates else "Thân chủ đang cởi mở hơn trong cách chia sẻ gần đây.")[:220]
        elif latest_checkin_score is not None and latest_checkin_score >= 7 and completed_assignments > 0 and open_crisis_count == 0:
            trajectory_state = "Ổn định dần"
            trend_summary = (summary_candidates[0] if summary_candidates else "Các tín hiệu gần đây cho thấy nhịp ổn định đang tốt hơn trước.")[:220]
        else:
            trajectory_state = "Đang cần theo dõi thêm"
            trend_summary = (summary_candidates[0] if summary_candidates else "Miru đang gom thêm dữ liệu gần đây để làm rõ tiến trình của ca.")[:220]

        if not trajectory_summary:
            if not trajectory_share_enabled:
                trajectory_state = "Chưa có quỹ đạo được chia sẻ"
                trend_summary = "Thân chủ chưa bật chia sẻ AI insights, nên Miru không hiển thị bản quỹ đạo cho therapist."
            else:
                trajectory_state = "Chờ thêm dữ liệu quỹ đạo"
                trend_summary = "Miru chưa có đủ dữ liệu để dựng bản tóm tắt quỹ đạo clinician-safe cho ca này."

        last_client_activity_at = max(
            [
                item
                for item in [
                    latest_client_message_at,
                    self._latest_timestamp_from_rows(analyzed_rows, ["analyzed_at", "updated_at", "created_at"]),
                    self._latest_timestamp_from_rows(journal_rows, ["created_at", "updated_at"]),
                    self._latest_timestamp_from_rows(checkin_rows, ["created_at", "updated_at"]),
                    self._latest_timestamp_from_rows(assignments, ["last_progress_at", "completed_at", "updated_at", "created_at"]),
                    self._latest_timestamp_from_rows(pending_assessment_rows, ["completed_at", "updated_at", "assigned_at", "created_at"]),
                ]
                if item is not None
            ],
            default=None,
        )
        last_therapist_action_at = max(
            [
                item
                for item in [
                    latest_therapist_message_at,
                    self._latest_timestamp_from_rows(assignments, ["updated_at", "created_at"]),
                    self._latest_timestamp_from_rows(appointments, ["updated_at", "created_at"]),
                    self._latest_timestamp_from_rows(pending_assessment_rows, ["updated_at", "assigned_at", "created_at"]),
                ]
                if item is not None
            ],
            default=None,
        )

        pending_items_count = len(pending_assignment_rows) + len(pending_assessment_rows) + unread_client_messages + open_crisis_count

        attention_level = "low"
        attention_reason = "Ca đang ổn định và chưa có tín hiệu cần can thiệp ngay."
        suggested_next_action = "Xem summary ca"

        inactivity_days = None
        if last_client_activity_at:
            inactivity_days = max((now_value - last_client_activity_at).days, 0)

        if open_crisis_count > 0:
            attention_level = "high"
            attention_reason = "Có cảnh báo khủng hoảng chưa được xác nhận."
            suggested_next_action = "Xác nhận cảnh báo"
        elif unread_client_messages > 0:
            attention_level = "high" if unread_client_messages >= 3 else "medium"
            attention_reason = "Thân chủ vừa nhắn và đang chờ phản hồi."
            suggested_next_action = "Nhắn follow-up"
        elif overdue_assignments > 0:
            attention_level = "medium"
            attention_reason = "Có bài tập đang quá hạn và chưa được thân chủ hoàn thành."
            suggested_next_action = "Giao bài tập"
        elif pending_assessment_rows:
            attention_level = "medium"
            attention_reason = "Có thang đo đã giao nhưng thân chủ chưa nộp."
            suggested_next_action = "Gửi assessment"
        elif next_appointment_at and next_appointment_at <= now_value + timedelta(hours=24):
            attention_level = "medium"
            attention_reason = "Có lịch hẹn diễn ra trong hôm nay hoặc 24 giờ tới."
            suggested_next_action = "Xem summary ca"
        elif not deep_share_enabled and therapist_id:
            attention_level = "medium" if pending_items_count > 0 else "low"
            attention_reason = "Thân chủ chưa bật chia sẻ dữ liệu sâu cho therapist."
            suggested_next_action = "Mời cập nhật quyền chia sẻ"
        elif inactivity_days is not None and inactivity_days >= 3:
            attention_level = "medium"
            attention_reason = "Thân chủ đã ít tương tác trong khoảng ba ngày gần đây."
            suggested_next_action = "Nhắn follow-up"

        total_sessions = self._safe_exact_count("chat_sessions", eq_filters={"user_id": client_id})
        if total_sessions == 0:
            total_sessions = self._safe_exact_count("analyzed_sessions", eq_filters={"user_id": client_id})

        return {
            "client_id": client_id,
            "client": client_user,
            "total_sessions": total_sessions,
            "completed_assignments": completed_assignments,
            "pending_assignments": len(pending_assignment_rows),
            "pending_assessments": len(pending_assessment_rows),
            "crisis_events": self._safe_exact_count("crisis_events", eq_filters={"client_id": client_id}),
            "open_crisis_count": open_crisis_count,
            "unread_client_messages": unread_client_messages,
            "today_appointments_count": len(today_appointments),
            "pending_items_count": pending_items_count,
            "attention_level": attention_level,
            "attention_reason": attention_reason,
            "trajectory_state": trajectory_state,
            "trend_summary": trend_summary,
            "suggested_next_action": suggested_next_action,
            "last_client_activity_at": self._iso_or_none(last_client_activity_at),
            "last_therapist_action_at": self._iso_or_none(last_therapist_action_at),
            "next_appointment_at": self._iso_or_none(next_appointment_at),
            "share_access_enabled": deep_share_enabled,
            "trajectory_summary": trajectory_summary,
        }

    def get_morning_board(self, therapist_identifier: str) -> Dict[str, Any]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return {
                "attention_clients": [],
                "new_contact_requests": [],
                "today_appointments": [],
                "pending_assignments": [],
                "pending_assessments": [],
                "open_crises": [],
                "stats": {},
            }

        clients = self.get_my_clients(therapist_id)
        open_crises = self.get_unacknowledged_crises(therapist_id)
        crises_by_client: Dict[str, List[Dict[str, Any]]] = {}
        for row in open_crises:
            client_id = str(row.get("client_id") or "")
            if client_id:
                crises_by_client.setdefault(client_id, []).append(row)

        attention_clients = []
        for client in clients:
            client_id = str(client.get("client_id") or client.get("id") or "")
            if not client_id:
                continue
            attention_clients.append(
                self.get_client_summary(
                    client_id,
                    therapist_id,
                    client_row=client,
                    open_crises=crises_by_client.get(client_id, []),
                )
            )

        level_rank = {"high": 3, "medium": 2, "low": 1}
        attention_clients.sort(
            key=lambda item: (
                level_rank.get(str(item.get("attention_level")), 0),
                int(item.get("pending_items_count") or 0),
                str(item.get("last_client_activity_at") or ""),
            ),
            reverse=True,
        )

        contact_request_rows = self._select_rows_by_column(
            "therapist_contact_requests",
            "therapist_id",
            therapist_id,
            order_column="updated_at",
            desc=True,
            limit=20,
        )
        lead_users = self._get_users_by_ids(
            [str(row.get("client_id")) for row in contact_request_rows if isinstance(row.get("client_id"), str)]
        )
        lead_items = []
        for row in contact_request_rows:
            funnel_status = str(row.get("funnel_status") or "").strip().lower()
            legacy_status = str(row.get("status") or "").strip().lower()
            if not funnel_status:
                if legacy_status == "approved" and row.get("shared_pairing_code"):
                    funnel_status = "approved"
                elif legacy_status == "approved":
                    funnel_status = "replied"
                elif legacy_status in {"declined", "archived"}:
                    funnel_status = "lost"
                else:
                    funnel_status = "new"
            if funnel_status in {"paired", "lost"}:
                continue
            client_id = str(row.get("client_id") or "")
            lead_items.append(
                {
                    "id": row.get("id"),
                    "client_id": client_id,
                    "client": lead_users.get(client_id, {"id": client_id, "name": client_id, "email": ""}),
                    "funnel_status": funnel_status,
                    "source": str(row.get("source") or "directory"),
                    "message": row.get("message") if isinstance(row.get("message"), str) else "",
                    "service_interest": row.get("service_interest") if isinstance(row.get("service_interest"), str) else "unsure",
                    "updated_at": row.get("updated_at"),
                    "shared_pairing_code": row.get("shared_pairing_code") if isinstance(row.get("shared_pairing_code"), str) else None,
                }
            )

        appointments = self.get_appointments(therapist_id)
        local_today = datetime.now(LOCAL_TZ).date()
        today_appointments = [
            appointment
            for appointment in appointments
            if (appointment_dt := self._parse_timestamp(appointment.get("appointment_date")))
            and appointment_dt.astimezone(LOCAL_TZ).date() == local_today
            and str(appointment.get("status") or "scheduled").lower() not in {"cancelled", "completed"}
        ]

        pending_assignments = [
            assignment
            for assignment in self.get_therapist_assignments(therapist_id)
            if str(assignment.get("status") or "").lower() in {"pending", "in_progress"}
        ]

        pending_assessment_rows = [
            row
            for row in self._select_rows_by_column(
                "assessment_assignments",
                "therapist_id",
                therapist_id,
                order_column="assigned_at",
                desc=True,
                limit=50,
            )
            if str(row.get("status") or "assigned").lower() not in {"completed", "cancelled"}
        ]
        pending_assessment_users = self._get_users_by_ids(
            [str(row.get("client_id")) for row in pending_assessment_rows if isinstance(row.get("client_id"), str)]
        )
        pending_assessments = [
            {
                **row,
                "client": pending_assessment_users.get(
                    str(row.get("client_id") or ""),
                    {
                        "id": str(row.get("client_id") or ""),
                        "name": str(row.get("client_id") or ""),
                        "email": "",
                    },
                ),
            }
            for row in pending_assessment_rows
        ]

        return {
            "attention_clients": attention_clients,
            "new_contact_requests": lead_items,
            "today_appointments": today_appointments,
            "pending_assignments": pending_assignments,
            "pending_assessments": pending_assessments,
            "open_crises": open_crises,
            "stats": {
                "total_clients": len(clients),
                "attention_clients": len([item for item in attention_clients if item.get("attention_level") in {"high", "medium"}]),
                "new_contact_requests": len(lead_items),
                "today_appointments": len(today_appointments),
                "pending_assignments": len(pending_assignments),
                "pending_assessments": len(pending_assessments),
                "open_crises": len(open_crises),
            },
        }


_service_instance = None


def get_therapist_service() -> TherapistService:
    global _service_instance
    if _service_instance is None:
        _service_instance = TherapistService()
    return _service_instance

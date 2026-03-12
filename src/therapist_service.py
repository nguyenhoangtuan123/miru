import json
import os
import random
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


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
        due_date: str = None,
    ) -> Optional[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return None
        response = self.supabase.table("assignments").insert(
            {
                "therapist_id": therapist_id,
                "client_id": client_id,
                "title": title,
                "description": description,
                "due_date": due_date,
                "status": "pending",
                "created_at": self._now(),
                "updated_at": self._now(),
            }
        ).execute()
        return response.data[0] if response.data else None

    def get_client_assignments(self, client_id: str, status: str = None) -> List[Dict[str, Any]]:
        query = self.supabase.table("assignments").select("*").eq("client_id", client_id)
        if status:
            query = query.eq("status", status)
        try:
            response = query.order("created_at", desc=True).execute()
        except Exception:
            response = query.execute()
        return response.data or []

    def get_therapist_assignments(self, therapist_identifier: str) -> List[Dict[str, Any]]:
        therapist_id = self._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            return []
        rows = self._select_rows("assignments", therapist_id)
        return self._attach_client_users(rows)

    def get_assignment(self, assignment_id: int) -> Optional[Dict[str, Any]]:
        response = (
            self.supabase.table("assignments")
            .select("*")
            .eq("id", assignment_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def complete_assignment(self, assignment_id: int, completion_notes: str = None) -> Optional[Dict[str, Any]]:
        response = (
            self.supabase.table("assignments")
            .update(
                {
                    "status": "completed",
                    "completed_at": self._now(),
                    "completion_notes": completion_notes,
                    "updated_at": self._now(),
                }
            )
            .eq("id", assignment_id)
            .execute()
        )
        return response.data[0] if response.data else None

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

    def get_client_summary(self, client_id: str) -> Dict[str, int]:
        sessions = self.supabase.table("chat_sessions").select("id", count="exact").eq("user_id", client_id).execute()
        completed = self.supabase.table("assignments").select("id", count="exact").eq("client_id", client_id).eq("status", "completed").execute()
        pending = self.supabase.table("assignments").select("id", count="exact").eq("client_id", client_id).eq("status", "pending").execute()
        crises = self.supabase.table("crisis_events").select("id", count="exact").eq("client_id", client_id).execute()
        return {
            "total_sessions": sessions.count if sessions.count else 0,
            "completed_assignments": completed.count if completed.count else 0,
            "pending_assignments": pending.count if pending.count else 0,
            "crisis_events": crises.count if crises.count else 0,
        }


_service_instance = None


def get_therapist_service() -> TherapistService:
    global _service_instance
    if _service_instance is None:
        _service_instance = TherapistService()
    return _service_instance

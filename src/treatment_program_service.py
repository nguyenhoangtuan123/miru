from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

from therapist_service import get_therapist_service
from therapist_verification_service import get_therapist_verification_service

load_dotenv()

PROGRAMS_TABLE = "treatment_programs"
GOALS_TABLE = "treatment_goals"
SESSIONS_TABLE = "treatment_session_plans"
CACHE_TTL_MINUTES = 5


class TreatmentProgramSchemaError(RuntimeError):
    pass


class TreatmentProgramAccessError(PermissionError):
    pass


class TreatmentProgramValidationError(ValueError):
    pass


class TreatmentProgramNotFoundError(LookupError):
    pass


@dataclass
class CachedProjection:
    payload: Dict[str, Any]
    expires_at: datetime


class TreatmentProgramService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.therapist_service = get_therapist_service()
        self.verification_service = get_therapist_verification_service()
        self._client_read_cache: Dict[str, CachedProjection] = {}
        self._summary_cache: Dict[str, CachedProjection] = {}

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _now_iso(self) -> str:
        return self._now().isoformat()

    def _raise_schema_error(self, exc: Exception) -> None:
        lowered = str(exc).lower()
        if "treatment_program" in lowered or "treatment_goal" in lowered or "treatment_session_plan" in lowered:
            raise TreatmentProgramSchemaError(
                "Treatment program schema is unavailable. Please run migration 024_add_treatment_programs.sql."
            ) from exc
        if "could not find the table" in lowered and (
            PROGRAMS_TABLE in lowered or GOALS_TABLE in lowered or SESSIONS_TABLE in lowered
        ):
            raise TreatmentProgramSchemaError(
                "Treatment program schema is unavailable. Please run migration 024_add_treatment_programs.sql."
            ) from exc
        raise exc

    def _require_verified_therapist(self, therapist_user_id: str) -> str:
        if not self.verification_service.can_access_portal(therapist_user_id):
            raise TreatmentProgramAccessError("Therapist verification approval required")
        therapist_id = self.therapist_service._resolve_therapist_id(therapist_user_id)
        if not therapist_id:
            raise TreatmentProgramAccessError("Therapist profile is unavailable")
        return therapist_id

    def _ensure_relationship(self, therapist_id: str, client_id: str) -> None:
        if not self.therapist_service.has_active_relationship(therapist_id, client_id):
            raise TreatmentProgramAccessError("No active therapist-client relationship")

    def _normalize_status(self, status: Optional[str], allowed: List[str], fallback: str) -> str:
        value = str(status or fallback).strip().lower()
        if value not in allowed:
            raise TreatmentProgramValidationError("Invalid status")
        return value

    def _normalize_string_list(self, value: Any) -> List[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    def _serialize_program(self, row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        return {
            "id": int(row.get("id")),
            "client_id": str(row.get("client_id") or ""),
            "therapist_id": str(row.get("therapist_id") or ""),
            "title": row.get("title"),
            "status": row.get("status") or "draft",
            "approaches": self._normalize_string_list(row.get("approaches")),
            "summary": row.get("summary"),
            "total_sessions": row.get("total_sessions"),
            "start_date": row.get("start_date"),
            "review_date": row.get("review_date"),
            "published_at": row.get("published_at"),
            "archived_at": row.get("archived_at"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }

    def _serialize_goal(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": int(row.get("id")),
            "program_id": int(row.get("program_id")),
            "title": row.get("title"),
            "description": row.get("description"),
            "success_criteria": row.get("success_criteria"),
            "status": row.get("status") or "not_started",
            "order_index": row.get("order_index") or 0,
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }

    def _serialize_session(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": int(row.get("id")),
            "program_id": int(row.get("program_id")),
            "session_number": row.get("session_number") or 1,
            "title": row.get("title"),
            "objectives": row.get("objectives"),
            "interventions": row.get("interventions"),
            "homework_plan": row.get("homework_plan"),
            "status": row.get("status") or "planned",
            "scheduled_for": row.get("scheduled_for"),
            "appointment_id": row.get("appointment_id"),
            "session_note_id": row.get("session_note_id"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }

    def _list_goals(self, program_id: int) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(GOALS_TABLE)
                .select("*")
                .eq("program_id", program_id)
                .order("order_index", desc=False)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return []
        return [self._serialize_goal(row) for row in (response.data or []) if isinstance(row, dict)]

    def _list_sessions(self, program_id: int) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(SESSIONS_TABLE)
                .select("*")
                .eq("program_id", program_id)
                .order("session_number", desc=False)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return []
        return [self._serialize_session(row) for row in (response.data or []) if isinstance(row, dict)]

    def _fetch_program_by_id(self, program_id: int) -> Dict[str, Any]:
        try:
            response = (
                self.supabase.table(PROGRAMS_TABLE)
                .select("*")
                .eq("id", program_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise TreatmentProgramNotFoundError("Treatment program not found")
        return response.data[0]

    def _get_active_program_row(self, therapist_id: str, client_id: str) -> Optional[Dict[str, Any]]:
        try:
            query = (
                self.supabase.table(PROGRAMS_TABLE)
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .neq("status", "archived")
            )
            try:
                response = query.order("updated_at", desc=True).limit(1).execute()
            except Exception:
                response = query.limit(1).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            return None
        return response.data[0] if response.data else None

    def _get_published_program_row(self, therapist_id: str, client_id: str) -> Optional[Dict[str, Any]]:
        try:
            query = (
                self.supabase.table(PROGRAMS_TABLE)
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .eq("status", "published")
            )
            try:
                response = query.order("published_at", desc=True).limit(1).execute()
            except Exception:
                response = query.limit(1).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            return None
        return response.data[0] if response.data else None

    def _fetch_available_appointments(self, therapist_id: str, client_id: str) -> List[Dict[str, Any]]:
        try:
            appointments = self.therapist_service.get_appointments(therapist_id, client_id=client_id)
        except Exception:
            appointments = []
        results = []
        for row in appointments:
            if not isinstance(row, dict) or row.get("id") is None:
                continue
            results.append(
                {
                    "id": int(row.get("id")),
                    "appointment_date": row.get("appointment_date"),
                    "status": row.get("status"),
                    "type": row.get("type"),
                    "notes": row.get("notes"),
                }
            )
        return results

    def _fetch_available_session_notes(self, therapist_id: str, client_id: str) -> List[Dict[str, Any]]:
        try:
            query = (
                self.supabase.table("therapist_session_notes")
                .select("id, session_date, session_type, progress_assessment, next_session_plan")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
            )
            try:
                response = query.order("session_date", desc=True).limit(20).execute()
            except Exception:
                response = query.limit(20).execute()
        except Exception:
            return []
        results = []
        for row in response.data or []:
            if not isinstance(row, dict) or row.get("id") is None:
                continue
            results.append(
                {
                    "id": int(row.get("id")),
                    "session_date": row.get("session_date"),
                    "session_type": row.get("session_type"),
                    "progress_assessment": row.get("progress_assessment"),
                    "next_session_plan": row.get("next_session_plan"),
                }
            )
        return results

    def _summary_cache_key(self, program: Dict[str, Any]) -> str:
        return f"{program.get('id')}::{program.get('updated_at')}::{program.get('published_at')}"

    def _client_cache_key(self, program: Dict[str, Any]) -> str:
        return self._summary_cache_key(program)

    def _prune_cache(self) -> None:
        now = self._now()
        for cache_map in (self._client_read_cache, self._summary_cache):
            expired = [key for key, item in cache_map.items() if item.expires_at <= now]
            for key in expired:
                cache_map.pop(key, None)

    def _invalidate_program_cache(self, program_id: int) -> None:
        prefix = f"{program_id}::"
        for cache_map in (self._client_read_cache, self._summary_cache):
            for key in [item for item in cache_map.keys() if item.startswith(prefix)]:
                cache_map.pop(key, None)

    def _build_summary_projection(
        self,
        program: Dict[str, Any],
        goals: List[Dict[str, Any]],
        sessions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        self._prune_cache()
        key = self._summary_cache_key(program)
        cached = self._summary_cache.get(key)
        if cached and cached.expires_at > self._now():
            return cached.payload

        goals_text = "\n".join([f"- {goal['title']}" for goal in goals]) if goals else None
        session_text = "\n".join(
            [
                f"Phiên {session['session_number']}: {session.get('title') or 'Chưa đặt tiêu đề'}"
                for session in sessions
            ]
        ) or None
        payload = {
            "treatment_goals": goals_text,
            "treatment_plan": session_text or program.get("summary"),
            "estimated_sessions": program.get("total_sessions") or (len(sessions) if sessions else None),
        }
        self._summary_cache[key] = CachedProjection(
            payload=payload,
            expires_at=self._now() + timedelta(minutes=CACHE_TTL_MINUTES),
        )
        return payload

    def _sync_medical_profile_summary(
        self,
        therapist_id: str,
        client_id: str,
        program: Dict[str, Any],
        goals: List[Dict[str, Any]],
        sessions: List[Dict[str, Any]],
    ) -> None:
        projection = self._build_summary_projection(program, goals, sessions)
        try:
            existing = (
                self.supabase.table("client_medical_profiles")
                .select("id")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .limit(1)
                .execute()
            )
        except Exception:
            existing = None

        payload = {
            "therapist_id": therapist_id,
            "client_id": client_id,
            "treatment_goals": projection.get("treatment_goals"),
            "treatment_plan": projection.get("treatment_plan"),
            "estimated_sessions": projection.get("estimated_sessions"),
            "updated_at": self._now_iso(),
        }

        try:
            if existing and existing.data:
                self.supabase.table("client_medical_profiles").update(payload).eq("id", existing.data[0]["id"]).execute()
            else:
                insert_payload = {**payload, "created_at": self._now_iso()}
                self.supabase.table("client_medical_profiles").insert(insert_payload).execute()
        except Exception:
            return

    def _build_payload(
        self,
        program_row: Optional[Dict[str, Any]],
        goals: List[Dict[str, Any]],
        sessions: List[Dict[str, Any]],
        *,
        include_lookups: bool = False,
        therapist_id: Optional[str] = None,
        client_id: Optional[str] = None,
        cache_expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {
            "program": self._serialize_program(program_row),
            "goals": goals,
            "sessions": sessions,
            "is_published": bool(program_row and program_row.get("status") == "published"),
            "client_can_view": bool(program_row and program_row.get("status") == "published"),
            "cache_expires_at": cache_expires_at,
        }
        if include_lookups and therapist_id and client_id:
            payload["available_appointments"] = self._fetch_available_appointments(therapist_id, client_id)
            payload["available_session_notes"] = self._fetch_available_session_notes(therapist_id, client_id)
        return payload

    def get_therapist_program_detail(self, therapist_user_id: str, client_id: str) -> Dict[str, Any]:
        therapist_id = self._require_verified_therapist(therapist_user_id)
        self._ensure_relationship(therapist_id, client_id)
        program_row = self._get_active_program_row(therapist_id, client_id)
        if not program_row:
            return self._build_payload(None, [], [], include_lookups=True, therapist_id=therapist_id, client_id=client_id)
        goals = self._list_goals(int(program_row["id"]))
        sessions = self._list_sessions(int(program_row["id"]))
        return self._build_payload(
            program_row,
            goals,
            sessions,
            include_lookups=True,
            therapist_id=therapist_id,
            client_id=client_id,
        )

    def upsert_therapist_program(
        self,
        therapist_user_id: str,
        client_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        therapist_id = self._require_verified_therapist(therapist_user_id)
        self._ensure_relationship(therapist_id, client_id)
        existing = self._get_active_program_row(therapist_id, client_id)
        record = {
            "therapist_id": therapist_id,
            "client_id": client_id,
            "title": payload.get("title"),
            "approaches": self._normalize_string_list(payload.get("approaches")),
            "summary": payload.get("summary"),
            "total_sessions": payload.get("total_sessions"),
            "start_date": payload.get("start_date"),
            "review_date": payload.get("review_date"),
            "updated_at": self._now_iso(),
        }

        try:
            if existing:
                response = (
                    self.supabase.table(PROGRAMS_TABLE)
                    .update(record)
                    .eq("id", existing["id"])
                    .execute()
                )
                row = response.data[0] if response.data else existing
            else:
                response = (
                    self.supabase.table(PROGRAMS_TABLE)
                    .insert({**record, "status": "draft", "created_at": self._now_iso()})
                    .execute()
                )
                row = response.data[0] if response.data else None
        except Exception as exc:
            self._raise_schema_error(exc)
            raise

        if not row:
            raise TreatmentProgramValidationError("Failed to save treatment program")
        self._invalidate_program_cache(int(row["id"]))
        return self.get_therapist_program_detail(therapist_user_id, client_id)

    def _verify_program_access(self, therapist_user_id: str, program_id: int) -> Dict[str, Any]:
        therapist_id = self._require_verified_therapist(therapist_user_id)
        program = self._fetch_program_by_id(program_id)
        if str(program.get("therapist_id")) != therapist_id:
            raise TreatmentProgramAccessError("Access denied")
        self._ensure_relationship(therapist_id, str(program.get("client_id") or ""))
        return program

    def add_goal(self, therapist_user_id: str, program_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        program = self._verify_program_access(therapist_user_id, program_id)
        record = {
            "program_id": program_id,
            "title": str(payload.get("title") or "").strip(),
            "description": payload.get("description"),
            "success_criteria": payload.get("success_criteria"),
            "status": self._normalize_status(payload.get("status"), ["not_started", "in_progress", "achieved", "paused"], "not_started"),
            "order_index": payload.get("order_index") or len(self._list_goals(program_id)),
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        if not record["title"]:
            raise TreatmentProgramValidationError("Goal title is required")
        try:
            response = self.supabase.table(GOALS_TABLE).insert(record).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        self._invalidate_program_cache(program_id)
        return self._serialize_goal(response.data[0])

    def update_goal(self, therapist_user_id: str, program_id: int, goal_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        self._verify_program_access(therapist_user_id, program_id)
        updates = {"updated_at": self._now_iso()}
        if "title" in payload:
            title = str(payload.get("title") or "").strip()
            if not title:
                raise TreatmentProgramValidationError("Goal title is required")
            updates["title"] = title
        if "description" in payload:
            updates["description"] = payload.get("description")
        if "success_criteria" in payload:
            updates["success_criteria"] = payload.get("success_criteria")
        if "status" in payload:
            updates["status"] = self._normalize_status(payload.get("status"), ["not_started", "in_progress", "achieved", "paused"], "not_started")
        if "order_index" in payload:
            updates["order_index"] = payload.get("order_index") or 0
        try:
            response = (
                self.supabase.table(GOALS_TABLE)
                .update(updates)
                .eq("id", goal_id)
                .eq("program_id", program_id)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise TreatmentProgramNotFoundError("Treatment goal not found")
        self._invalidate_program_cache(program_id)
        return self._serialize_goal(response.data[0])

    def delete_goal(self, therapist_user_id: str, program_id: int, goal_id: int) -> bool:
        self._verify_program_access(therapist_user_id, program_id)
        try:
            self.supabase.table(GOALS_TABLE).delete().eq("id", goal_id).eq("program_id", program_id).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        self._invalidate_program_cache(program_id)
        return True

    def add_session(self, therapist_user_id: str, program_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        program = self._verify_program_access(therapist_user_id, program_id)
        record = {
            "program_id": program_id,
            "session_number": payload.get("session_number") or (len(self._list_sessions(program_id)) + 1),
            "title": payload.get("title"),
            "objectives": payload.get("objectives"),
            "interventions": payload.get("interventions"),
            "homework_plan": payload.get("homework_plan"),
            "status": self._normalize_status(payload.get("status"), ["planned", "completed", "skipped"], "planned"),
            "scheduled_for": payload.get("scheduled_for"),
            "appointment_id": payload.get("appointment_id"),
            "session_note_id": payload.get("session_note_id"),
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        try:
            response = self.supabase.table(SESSIONS_TABLE).insert(record).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        self._invalidate_program_cache(int(program["id"]))
        return self._serialize_session(response.data[0])

    def update_session(self, therapist_user_id: str, program_id: int, session_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
        self._verify_program_access(therapist_user_id, program_id)
        updates = {"updated_at": self._now_iso()}
        for key in ["session_number", "title", "objectives", "interventions", "homework_plan", "scheduled_for", "appointment_id", "session_note_id"]:
            if key in payload:
                updates[key] = payload.get(key)
        if "status" in payload:
            updates["status"] = self._normalize_status(payload.get("status"), ["planned", "completed", "skipped"], "planned")
        try:
            response = (
                self.supabase.table(SESSIONS_TABLE)
                .update(updates)
                .eq("id", session_id)
                .eq("program_id", program_id)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise TreatmentProgramNotFoundError("Treatment session plan not found")
        self._invalidate_program_cache(program_id)
        return self._serialize_session(response.data[0])

    def delete_session(self, therapist_user_id: str, program_id: int, session_id: int) -> bool:
        self._verify_program_access(therapist_user_id, program_id)
        try:
            self.supabase.table(SESSIONS_TABLE).delete().eq("id", session_id).eq("program_id", program_id).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        self._invalidate_program_cache(program_id)
        return True

    def publish_program(self, therapist_user_id: str, program_id: int) -> Dict[str, Any]:
        program = self._verify_program_access(therapist_user_id, program_id)
        updates = {
            "status": "published",
            "published_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        try:
            response = (
                self.supabase.table(PROGRAMS_TABLE)
                .update(updates)
                .eq("id", program_id)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise TreatmentProgramNotFoundError("Treatment program not found")
        updated_program = response.data[0]
        goals = self._list_goals(program_id)
        sessions = self._list_sessions(program_id)
        self._sync_medical_profile_summary(
            str(updated_program.get("therapist_id") or ""),
            str(updated_program.get("client_id") or ""),
            updated_program,
            goals,
            sessions,
        )
        self._invalidate_program_cache(program_id)
        return self._build_payload(updated_program, goals, sessions)

    def archive_program(self, therapist_user_id: str, program_id: int) -> bool:
        self._verify_program_access(therapist_user_id, program_id)
        try:
            self.supabase.table(PROGRAMS_TABLE).update(
                {
                    "status": "archived",
                    "archived_at": self._now_iso(),
                    "updated_at": self._now_iso(),
                }
            ).eq("id", program_id).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        self._invalidate_program_cache(program_id)
        return True

    def get_client_current_program(self, client_id: str) -> Dict[str, Any]:
        pairing = self.therapist_service.get_client_therapist(client_id)
        if not pairing:
            return self._build_payload(None, [], [], cache_expires_at=None)
        therapist_id = str(pairing.get("therapist_id") or "")
        if not therapist_id:
            return self._build_payload(None, [], [], cache_expires_at=None)
        program_row = self._get_published_program_row(therapist_id, client_id)
        if not program_row:
            return self._build_payload(None, [], [], cache_expires_at=None)

        self._prune_cache()
        cache_key = self._client_cache_key(program_row)
        cached = self._client_read_cache.get(cache_key)
        if cached and cached.expires_at > self._now():
            return cached.payload

        goals = self._list_goals(int(program_row["id"]))
        sessions = self._list_sessions(int(program_row["id"]))
        expires_at = self._now() + timedelta(minutes=CACHE_TTL_MINUTES)
        payload = self._build_payload(
            program_row,
            goals,
            sessions,
            cache_expires_at=expires_at.isoformat(),
        )
        self._client_read_cache[cache_key] = CachedProjection(payload=payload, expires_at=expires_at)
        return payload


_treatment_program_service: Optional[TreatmentProgramService] = None


def get_treatment_program_service() -> TreatmentProgramService:
    global _treatment_program_service
    if _treatment_program_service is None:
        _treatment_program_service = TreatmentProgramService()
    return _treatment_program_service

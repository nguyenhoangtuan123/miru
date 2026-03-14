from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

from assessment_service import AssessmentService
from journal_db import JournalManager
from services import groq_client
from therapist_service import get_therapist_service
from therapist_verification_service import get_therapist_verification_service

load_dotenv()

SharingAccessLevel = Literal["none", "ai_report", "direct"]

PREFERENCES_TABLE = "therapist_sharing_preferences"
REPORT_CACHE_TTL_MINUTES = 15
ACCESS_FIELDS = {
    "ai_chat": "ai_chat_access",
    "web_activity": "web_activity_access",
    "assessment_results": "assessment_access",
    "ai_insights": "insights_access",
}


class TherapistSharingSchemaError(RuntimeError):
    pass


class TherapistSharingAccessError(PermissionError):
    pass


class TherapistSharingValidationError(ValueError):
    pass


@dataclass
class CachedReport:
    payload: Dict[str, Any]
    expires_at: datetime


class TherapistSharingService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.therapist_service = get_therapist_service()
        self.verification_service = get_therapist_verification_service()
        self.assessment_service = AssessmentService()
        self.journal_manager = JournalManager()
        self._report_cache: Dict[str, CachedReport] = {}

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _now_iso(self) -> str:
        return self._now().isoformat()

    def _raise_schema_error(self, exc: Exception) -> None:
        lowered = str(exc).lower()
        if "therapist_sharing_preferences" in lowered or "could not find the table" in lowered:
            raise TherapistSharingSchemaError(
                "Therapist sharing schema is unavailable. Please run migration 023_add_therapist_sharing_preferences.sql."
            ) from exc
        raise exc

    def _normalize_access_level(self, value: Any) -> SharingAccessLevel:
        normalized = str(value or "none").strip().lower()
        if normalized not in {"none", "ai_report", "direct"}:
            raise TherapistSharingValidationError("Invalid access level")
        return normalized  # type: ignore[return-value]

    def _resolve_therapist_id(self, therapist_identifier: str) -> str:
        therapist_id = self.therapist_service._resolve_therapist_id(therapist_identifier)
        if not therapist_id:
            raise TherapistSharingAccessError("Therapist profile is unavailable")
        return therapist_id

    def _require_verified_therapist(self, user_id: str) -> str:
        if not self.verification_service.can_access_portal(user_id):
            raise TherapistSharingAccessError("Therapist verification approval required")
        return self._resolve_therapist_id(user_id)

    def _ensure_active_relationship(self, therapist_id: str, client_id: str) -> None:
        if not self.therapist_service.has_active_relationship(therapist_id, client_id):
            raise TherapistSharingAccessError("No active therapist-client relationship")

    def _default_preference_row(self, client_id: str, therapist_id: str) -> Dict[str, Any]:
        return {
            "client_id": client_id,
            "therapist_id": therapist_id,
            "ai_chat_access": "none",
            "web_activity_access": "none",
            "assessment_access": "none",
            "insights_access": "none",
            "created_at": None,
            "updated_at": None,
        }

    def _serialize_preference_row(
        self,
        row: Dict[str, Any],
        therapist: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        therapist_name = therapist.get("name") if isinstance(therapist, dict) else None
        therapist_email = therapist.get("email") if isinstance(therapist, dict) else None
        return {
            "client_id": str(row.get("client_id") or ""),
            "therapist_id": str(row.get("therapist_id") or ""),
            "therapist_name": therapist_name,
            "therapist_email": therapist_email,
            "ai_chat_access": self._normalize_access_level(row.get("ai_chat_access")),
            "web_activity_access": self._normalize_access_level(row.get("web_activity_access")),
            "assessment_access": self._normalize_access_level(row.get("assessment_access")),
            "insights_access": self._normalize_access_level(row.get("insights_access")),
            "updated_at": row.get("updated_at"),
        }

    def _fetch_therapists_map(self, therapist_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        unique_ids = sorted({therapist_id for therapist_id in therapist_ids if therapist_id})
        if not unique_ids:
            return {}
        try:
            response = (
                self.supabase.table("therapists")
                .select("id, name, email, user_id")
                .in_("id", unique_ids)
                .execute()
            )
        except Exception:
            return {}
        return {
            str(row.get("id")): row
            for row in (response.data or [])
            if isinstance(row, dict) and row.get("id") is not None
        }

    def _fetch_user_map(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        unique_ids = sorted({user_id for user_id in user_ids if user_id})
        if not unique_ids:
            return {}
        try:
            response = self.supabase.table("users").select("id, name, email").in_("id", unique_ids).execute()
        except Exception:
            return {}
        return {
            str(row.get("id")): row
            for row in (response.data or [])
            if isinstance(row, dict) and row.get("id") is not None
        }

    def _fetch_active_therapist_rows(self, client_id: str) -> List[Dict[str, Any]]:
        query_variants = [
            ("therapist_id, paired_at, updated_at", True),
            ("therapist_id, paired_at", True),
            ("therapist_id", False),
        ]
        response = None
        for select_clause, ordered in query_variants:
            try:
                query = (
                    self.supabase.table("therapist_clients")
                    .select(select_clause)
                    .eq("client_id", client_id)
                    .eq("status", "active")
                )
                if ordered:
                    query = query.order("paired_at", desc=False)
                response = query.execute()
                break
            except Exception:
                continue
        if response is None:
            return []
        rows = [row for row in (response.data or []) if isinstance(row, dict) and row.get("therapist_id")]
        therapist_ids = [str(row.get("therapist_id")) for row in rows]
        therapists_map = self._fetch_therapists_map(therapist_ids)
        return [{**row, "therapist": therapists_map.get(str(row.get("therapist_id")))} for row in rows]

    def _get_preference_row(self, client_id: str, therapist_id: str) -> Dict[str, Any]:
        try:
            response = (
                self.supabase.table(PREFERENCES_TABLE)
                .select("*")
                .eq("client_id", client_id)
                .eq("therapist_id", therapist_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return self._default_preference_row(client_id, therapist_id)
        if response.data:
            return response.data[0]
        return self._default_preference_row(client_id, therapist_id)

    def _log_consent_change(
        self,
        client_id: str,
        therapist_id: str,
        consent_type: str,
        access_level: SharingAccessLevel,
    ) -> None:
        try:
            self.supabase.table("privacy_consent_log").insert(
                {
                    "user_id": client_id,
                    "therapist_id": therapist_id,
                    "consent_type": consent_type,
                    "consent_given": access_level != "none",
                    "consent_date": self._now_iso(),
                }
            ).execute()
        except Exception:
            return

    def _log_data_access(
        self,
        client_id: str,
        therapist_id: str,
        resource_type: str,
        action: str,
        source_mode: str,
    ) -> None:
        try:
            self.supabase.table("data_access_audit").insert(
                {
                    "client_id": client_id,
                    "accessor_id": therapist_id,
                    "accessor_type": "therapist",
                    "action": f"{action}:{source_mode}",
                    "resource_type": resource_type,
                    "accessed_at": self._now_iso(),
                }
            ).execute()
        except Exception:
            return

    def _prune_report_cache(self) -> None:
        now = self._now()
        expired = [key for key, item in self._report_cache.items() if item.expires_at <= now]
        for key in expired:
            self._report_cache.pop(key, None)

    def _cache_key(
        self,
        client_id: str,
        therapist_id: str,
        group: str,
        access_level: SharingAccessLevel,
        fingerprint: str,
    ) -> str:
        return "::".join([client_id, therapist_id, group, access_level, fingerprint])

    def _fingerprint(self, payload: Any) -> str:
        serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def _format_relative_report(
        self,
        items: List[Dict[str, Any]],
        label: str,
        max_items: int = 3,
    ) -> List[str]:
        highlights: List[str] = []
        for item in items[:max_items]:
            primary = None
            for key in ("title", "summary_text", "prompt", "severity", "status", "appointment_date", "note"):
                value = item.get(key)
                if isinstance(value, str) and value.strip():
                    primary = value.strip()
                    break
            if not primary:
                continue
            timestamp = item.get("created_at") or item.get("completed_at") or item.get("appointment_date")
            if isinstance(timestamp, str) and timestamp.strip():
                highlights.append(f"{label}: {primary} ({timestamp})")
            else:
                highlights.append(f"{label}: {primary}")
        return highlights

    def _generate_ai_report(self, group: str, data: Dict[str, Any]) -> Dict[str, Any]:
        summary = {
            "ai_chat": "Tóm tắt xu hướng chính trong các cuộc trò chuyện với AI, không trích nguyên văn hội thoại.",
            "web_activity": "Tóm tắt các hoạt động trên web của thân chủ, nhấn mạnh mô hình hành vi và tiến độ.",
            "assessment_results": "Tóm tắt các kết quả thang đo đã hoàn thành và mức độ sàng lọc chính.",
            "ai_insights": "Tóm tắt các insight AI mức cao, không lộ dữ liệu thô.",
        }.get(group, "Tóm tắt dữ liệu đã được chia sẻ.")

        highlights: List[str] = []
        if group == "ai_chat":
            highlights.extend(self._format_relative_report(data.get("sessions", []), "Phiên"))
        elif group == "web_activity":
            highlights.extend(self._format_relative_report(data.get("journal_entries", []), "Nhật ký"))
            highlights.extend(self._format_relative_report(data.get("goals", []), "Mục tiêu"))
            highlights.extend(self._format_relative_report(data.get("appointments", []), "Lịch hẹn"))
        elif group == "assessment_results":
            highlights.extend(self._format_relative_report(data.get("results", []), "Kết quả"))
        elif group == "ai_insights":
            highlights.extend(self._format_relative_report(data.get("insights", []), "Insight"))

        prompt = (
            "Bạn đang hỗ trợ therapist. Hãy viết báo cáo tiếng Việt ngắn gọn, tổng quát, không trích nguyên văn, "
            "không suy diễn chẩn đoán, chỉ nêu xu hướng chính và điểm cần lưu ý.\n"
            f"Nhóm dữ liệu: {group}\n"
            f"Dữ liệu rút gọn: {json.dumps(data, ensure_ascii=False)[:8000]}"
        )

        if groq_client:
            try:
                completion = groq_client.chat.completions.create(
                    model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
                    temperature=0.2,
                    max_tokens=280,
                    messages=[
                        {
                            "role": "system",
                            "content": "Viết báo cáo trị liệu ngắn gọn, an toàn, tránh lộ dữ liệu thô và tránh chẩn đoán chắc chắn.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                )
                content = completion.choices[0].message.content if completion.choices else None
                if isinstance(content, str) and content.strip():
                    summary = content.strip()
            except Exception:
                pass

        generated_at = self._now()
        expires_at = generated_at + timedelta(minutes=REPORT_CACHE_TTL_MINUTES)
        return {
            "source_mode": "ai_report",
            "summary": summary,
            "highlights": highlights,
            "generated_at": generated_at.isoformat(),
            "cache_expires_at": expires_at.isoformat(),
        }

    def _serialize_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "id": str(row.get("id") or ""),
                "role": row.get("role"),
                "content": row.get("content"),
                "created_at": row.get("created_at"),
            }
            for row in messages
        ]

    def _fetch_chat_data(self, client_id: str) -> Dict[str, Any]:
        sessions_response = (
            self.supabase.table("session_summaries")
            .select("id, title, summary_text, created_at, updated_at")
            .eq("user_id", client_id)
            .order("created_at", desc=True)
            .limit(8)
            .execute()
        )
        sessions = [row for row in (sessions_response.data or []) if isinstance(row, dict)]
        session_ids = [row.get("id") for row in sessions if row.get("id") is not None]
        messages: List[Dict[str, Any]] = []
        if session_ids:
            try:
                messages_response = (
                    self.supabase.table("chat_messages")
                    .select("id, session_id, role, content, created_at")
                    .in_("session_id", session_ids)
                    .order("created_at", desc=False)
                    .limit(120)
                    .execute()
                )
                messages = [row for row in (messages_response.data or []) if isinstance(row, dict)]
            except Exception:
                messages = []
        return {
            "sessions": [
                {
                    "id": str(row.get("id") or ""),
                    "title": row.get("title") or "Phiên trò chuyện",
                    "summary_text": row.get("summary_text"),
                    "created_at": row.get("created_at"),
                    "updated_at": row.get("updated_at"),
                }
                for row in sessions
            ],
            "messages": self._serialize_messages(messages),
        }

    def _fetch_web_activity_data(self, client_id: str, therapist_id: str) -> Dict[str, Any]:
        try:
            journal_entries = self.journal_manager.get_entries(client_id, limit=8, offset=0)
        except Exception:
            journal_entries = []

        try:
            goals_response = (
                self.supabase.table("goals")
                .select("id, title, description, completed, created_at, completed_at, due_date")
                .eq("user_id", client_id)
                .order("created_at", desc=True)
                .limit(8)
                .execute()
            )
            goals = goals_response.data or []
        except Exception:
            goals = []

        try:
            checkins_response = (
                self.supabase.table("moment_checkins")
                .select("*")
                .eq("user_id", client_id)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            checkins = checkins_response.data or []
        except Exception:
            checkins = []

        try:
            appointments = self.therapist_service.get_appointments(therapist_id, client_id=client_id, status=None)
        except Exception:
            appointments = []

        try:
            assignments = self.therapist_service.get_client_assignments(client_id)
        except Exception:
            assignments = []

        try:
            pairing_variants = [
                ("id, status, paired_at, updated_at, notes", True),
                ("id, status, paired_at, notes", True),
                ("id, status, notes", False),
                ("id, status", False),
            ]
            pairing_response = None
            for select_clause, ordered in pairing_variants:
                try:
                    query = (
                        self.supabase.table("therapist_clients")
                        .select(select_clause)
                        .eq("client_id", client_id)
                        .eq("therapist_id", therapist_id)
                    )
                    if ordered:
                        query = query.order("paired_at", desc=False)
                    pairing_response = query.execute()
                    break
                except Exception:
                    continue
            pairing_milestones = pairing_response.data if pairing_response and pairing_response.data else []
        except Exception:
            pairing_milestones = []

        return {
            "journal_entries": journal_entries,
            "goals": goals,
            "moment_checkins": checkins,
            "appointments": appointments,
            "assignment_progress": assignments,
            "pairing_milestones": pairing_milestones,
        }

    def _fetch_assessment_data(self, therapist_user_id: str, client_id: str) -> Dict[str, Any]:
        assignments = self.assessment_service.list_therapist_client_assignments(therapist_user_id, client_id)
        completed_results = []
        for assignment in assignments:
            result = assignment.get("result")
            if not isinstance(result, dict):
                continue
            completed_results.append(
                {
                    "assignment_id": assignment.get("id"),
                    "template_name": assignment.get("template_name"),
                    "template_short_code": assignment.get("template_short_code"),
                    "status": assignment.get("status"),
                    "completed_at": assignment.get("completed_at") or result.get("completed_at"),
                    "severity": result.get("severity"),
                    "interpretation": result.get("interpretation"),
                    "total_score": result.get("total_score"),
                    "subscale_scores": result.get("subscale_scores") or {},
                }
            )
        return {"results": completed_results}

    def _fetch_insights_data(self, client_id: str) -> Dict[str, Any]:
        try:
            response = (
                self.supabase.table("analyzed_sessions")
                .select("id, session_id, ai_title, ai_summary, dominant_emotion, emotion_score, analyzed_at")
                .eq("user_id", client_id)
                .order("analyzed_at", desc=True)
                .limit(10)
                .execute()
            )
            insights = [row for row in (response.data or []) if isinstance(row, dict)]
        except Exception:
            insights = []
        return {"insights": insights}

    def list_preferences_for_client(self, client_id: str) -> Dict[str, Any]:
        active_rows = self._fetch_active_therapist_rows(client_id)
        preferences = []
        for row in active_rows:
            therapist_id = str(row.get("therapist_id") or "")
            therapist = row.get("therapist") if isinstance(row.get("therapist"), dict) else None
            preference_row = self._get_preference_row(client_id, therapist_id)
            preferences.append(self._serialize_preference_row(preference_row, therapist))
        return {"preferences": preferences}

    def update_preference_for_client(
        self,
        client_id: str,
        therapist_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        self._ensure_active_relationship(therapist_id, client_id)
        current = self._get_preference_row(client_id, therapist_id)
        next_row = {
            "client_id": client_id,
            "therapist_id": therapist_id,
            "ai_chat_access": self._normalize_access_level(payload.get("ai_chat_access", current.get("ai_chat_access"))),
            "web_activity_access": self._normalize_access_level(payload.get("web_activity_access", current.get("web_activity_access"))),
            "assessment_access": self._normalize_access_level(payload.get("assessment_access", current.get("assessment_access"))),
            "insights_access": self._normalize_access_level(payload.get("insights_access", current.get("insights_access"))),
            "updated_at": self._now_iso(),
        }
        if not current.get("created_at"):
            next_row["created_at"] = self._now_iso()

        try:
            response = (
                self.supabase.table(PREFERENCES_TABLE)
                .upsert(next_row, on_conflict="client_id,therapist_id")
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise

        for consent_key, db_field in ACCESS_FIELDS.items():
            old_level = self._normalize_access_level(current.get(db_field))
            new_level = self._normalize_access_level(next_row.get(db_field))
            if old_level != new_level:
                self._log_consent_change(client_id, therapist_id, f"therapist_{consent_key}_access", new_level)

        therapist = self._fetch_therapists_map([therapist_id]).get(therapist_id)
        saved = response.data[0] if response.data else next_row
        return {"preference": self._serialize_preference_row(saved, therapist)}

    def _get_access_level_for_group(self, client_id: str, therapist_id: str, group: str) -> SharingAccessLevel:
        if group not in ACCESS_FIELDS:
            raise TherapistSharingValidationError("Unknown shared data group")
        preference = self._get_preference_row(client_id, therapist_id)
        return self._normalize_access_level(preference.get(ACCESS_FIELDS[group]))

    def get_context_overview(self, therapist_user_id: str, client_id: str) -> Dict[str, Any]:
        therapist_id = self._require_verified_therapist(therapist_user_id)
        self._ensure_active_relationship(therapist_id, client_id)
        preference = self._serialize_preference_row(self._get_preference_row(client_id, therapist_id))
        user_map = self._fetch_user_map([client_id])
        client_user = user_map.get(client_id, {})
        return {
            "client_id": client_id,
            "client_name": client_user.get("name"),
            "therapist_id": therapist_id,
            "consent": preference,
            "groups": [
                {"key": "ai_chat", "label": "Chat với AI", "access_level": preference["ai_chat_access"]},
                {"key": "web_activity", "label": "Hoạt động trên web", "access_level": preference["web_activity_access"]},
                {"key": "assessment_results", "label": "Kết quả thang đo", "access_level": preference["assessment_access"]},
                {"key": "ai_insights", "label": "AI insights", "access_level": preference["insights_access"]},
            ],
        }

    def _group_payload(
        self,
        group: str,
        client_id: str,
        therapist_id: str,
        therapist_user_id: str,
    ) -> Dict[str, Any]:
        if group == "ai_chat":
            return self._fetch_chat_data(client_id)
        if group == "web_activity":
            return self._fetch_web_activity_data(client_id, therapist_id)
        if group == "assessment_results":
            return self._fetch_assessment_data(therapist_user_id, client_id)
        if group == "ai_insights":
            return self._fetch_insights_data(client_id)
        raise TherapistSharingValidationError("Unknown shared data group")

    def get_group_context(self, therapist_user_id: str, client_id: str, group: str) -> Dict[str, Any]:
        therapist_id = self._require_verified_therapist(therapist_user_id)
        self._ensure_active_relationship(therapist_id, client_id)
        access_level = self._get_access_level_for_group(client_id, therapist_id, group)

        if access_level == "none":
            raise TherapistSharingAccessError("Client has not shared this data group")

        payload = self._group_payload(group, client_id, therapist_id, therapist_user_id)
        fingerprint = self._fingerprint(payload)

        if access_level == "direct":
            self._log_data_access(client_id, therapist_id, group, "view", "raw")
            return {
                "client_id": client_id,
                "therapist_id": therapist_id,
                "group": group,
                "access_level": access_level,
                "source_mode": "raw",
                "generated_at": self._now_iso(),
                "cache_expires_at": None,
                "audit_logged": True,
                "data": payload,
            }

        self._prune_report_cache()
        cache_key = self._cache_key(client_id, therapist_id, group, access_level, fingerprint)
        cached = self._report_cache.get(cache_key)
        if cached and cached.expires_at > self._now():
            self._log_data_access(client_id, therapist_id, group, "view", "ai_report")
            return {
                "client_id": client_id,
                "therapist_id": therapist_id,
                "group": group,
                "access_level": access_level,
                "audit_logged": True,
                "data": cached.payload,
            }

        report = self._generate_ai_report(group, payload)
        expires_at = datetime.fromisoformat(report["cache_expires_at"].replace("Z", "+00:00"))
        self._report_cache[cache_key] = CachedReport(payload=report, expires_at=expires_at)
        self._log_data_access(client_id, therapist_id, group, "view", "ai_report")
        return {
            "client_id": client_id,
            "therapist_id": therapist_id,
            "group": group,
            "access_level": access_level,
            "audit_logged": True,
            "data": report,
        }


_therapist_sharing_service: Optional[TherapistSharingService] = None


def get_therapist_sharing_service() -> TherapistSharingService:
    global _therapist_sharing_service
    if _therapist_sharing_service is None:
        _therapist_sharing_service = TherapistSharingService()
    return _therapist_sharing_service

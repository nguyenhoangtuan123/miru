from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from assessment_service import ASSESSMENT_SOURCE_SELF, get_assessment_service
from database import DatabaseManager
from intake_service import get_intake_service
from memory_service import get_memory_service
from routers.insights import _load_mood_checkins
from services import journal_manager
from therapist_service import get_therapist_service
from trajectory_rules import (
    TRAJECTORY_VERSION,
    describe_change,
    derive_trajectory_snapshot,
)

EVENTS_TABLE = "user_behavior_events"
SNAPSHOTS_TABLE = "user_trajectory_snapshots"
FEEDBACK_TABLE = "trajectory_feedback"

ALLOWED_EVENT_TYPES = {
    "home_opened",
    "trajectory_card_opened",
    "trajectory_feedback_submitted",
    "self_test_started",
    "self_test_completed",
    "proactive_opened",
    "therapist_directory_opened",
    "contact_request_submitted",
    "assignment_completed",
}

MODEL_AFFECTING_EVENT_TYPES = {
    "trajectory_feedback_submitted",
    "self_test_completed",
    "proactive_opened",
    "therapist_directory_opened",
    "contact_request_submitted",
    "assignment_completed",
}


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def _max_dt(values: List[Any]) -> Optional[datetime]:
    parsed = [item for item in (_parse_dt(value) for value in values) if item is not None]
    return max(parsed) if parsed else None


class TrajectorySchemaError(RuntimeError):
    pass


class TrajectoryValidationError(ValueError):
    pass


class TrajectoryService:
    def __init__(self):
        self.db = DatabaseManager()
        self.supabase = self.db.supabase
        self.assessment_service = get_assessment_service()
        self.intake_service = get_intake_service()
        self.therapist_service = get_therapist_service()
        self._schema_checked = False

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @classmethod
    def _now_iso(cls) -> str:
        return cls._now().isoformat()

    def _raise_schema_error(self, exc: Exception) -> None:
        lowered = str(exc).lower()
        if any(
            token in lowered
            for token in [
                "user_behavior_events",
                "user_trajectory_snapshots",
                "trajectory_feedback",
                "could not find the table",
                "schema cache",
            ]
        ):
            raise TrajectorySchemaError(
                "Trajectory schema is unavailable. Please run migration 027_add_trajectory_system.sql."
            ) from exc
        raise exc

    def _ensure_schema(self) -> None:
        if self._schema_checked:
            return
        try:
            self.supabase.table(EVENTS_TABLE).select("id").limit(1).execute()
            self.supabase.table(SNAPSHOTS_TABLE).select("id").limit(1).execute()
            self.supabase.table(FEEDBACK_TABLE).select("id").limit(1).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
        self._schema_checked = True

    def _fetch_rows(
        self,
        table: str,
        column: str,
        value: Any,
        *,
        order_column: Optional[str] = None,
        desc: bool = True,
        limit: Optional[int] = None,
        extra_eq: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        try:
            query = self.supabase.table(table).select("*").eq(column, value)
            if extra_eq:
                for key, extra_value in extra_eq.items():
                    query = query.eq(key, extra_value)
            if order_column:
                query = query.order(order_column, desc=desc)
            if limit is not None:
                query = query.limit(limit)
            response = query.execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            return []
        return [row for row in (response.data or []) if isinstance(row, dict)]

    def _insert_row(self, table: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = self.supabase.table(table).insert(payload).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        return response.data[0] if response.data else payload

    def _latest_self_assessment(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            assignments = self.assessment_service.list_my_assignments(user_id)
        except Exception:
            return None

        self_assessments = [
            assignment
            for assignment in assignments
            if assignment.get("source") == ASSESSMENT_SOURCE_SELF
            and assignment.get("status") == "completed"
            and isinstance(assignment.get("result"), dict)
        ]
        if not self_assessments:
            return None
        self_assessments.sort(
            key=lambda assignment: (
                assignment.get("completed_at") or "",
                assignment.get("assigned_at") or "",
            ),
            reverse=True,
        )
        return self_assessments[0]

    def _latest_journals(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        try:
            return journal_manager.get_entries(user_id, limit, 0) or []
        except Exception:
            return []

    def _latest_moods(self, user_id: str, limit: int = 7) -> List[Dict[str, Any]]:
        try:
            return _load_mood_checkins(self.db, user_id, days=30, limit=limit)
        except Exception:
            return []

    def _latest_assignments(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        try:
            assignments = self.therapist_service.get_client_assignments(user_id)
        except Exception:
            return []
        return assignments[:limit]

    def _latest_analyzed_sessions(self, user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("analyzed_sessions")
                .select("*")
                .eq("user_id", user_id)
                .order("analyzed_at", desc=True)
                .limit(limit)
                .execute()
            )
        except Exception:
            return []
        return [row for row in (response.data or []) if isinstance(row, dict)]

    def _latest_long_term_memories(self, user_id: str, limit: int = 5) -> List[str]:
        try:
            memories = get_memory_service().get_all_memories(user_id).get("results", [])
        except Exception:
            return []

        results: List[str] = []
        for item in memories:
            if len(results) >= limit:
                break
            if not isinstance(item, dict):
                continue
            text = item.get("memory") or item.get("text") or item.get("content")
            if isinstance(text, str) and text.strip():
                results.append(text.strip())
        return results

    def _latest_snapshot_row(self, user_id: str) -> Optional[Dict[str, Any]]:
        rows = self._fetch_rows(SNAPSHOTS_TABLE, "user_id", user_id, order_column="created_at", desc=True, limit=1)
        return rows[0] if rows else None

    def _previous_snapshot_row(self, user_id: str, latest_snapshot_id: Optional[int]) -> Optional[Dict[str, Any]]:
        rows = self._fetch_rows(SNAPSHOTS_TABLE, "user_id", user_id, order_column="created_at", desc=True, limit=5)
        for row in rows:
            if latest_snapshot_id is None or row.get("id") != latest_snapshot_id:
                return row
        return None

    def _recent_snapshots(self, user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        return self._fetch_rows(SNAPSHOTS_TABLE, "user_id", user_id, order_column="created_at", desc=True, limit=limit)

    def _latest_feedback_row(self, user_id: str) -> Optional[Dict[str, Any]]:
        rows = self._fetch_rows(FEEDBACK_TABLE, "user_id", user_id, order_column="created_at", desc=True, limit=1)
        return rows[0] if rows else None

    def _recent_events(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        return self._fetch_rows(EVENTS_TABLE, "user_id", user_id, order_column="occurred_at", desc=True, limit=limit)

    def _latest_contact_request(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("therapist_contact_requests")
                .select("*")
                .eq("client_id", user_id)
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
        except Exception:
            return None
        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        return rows[0] if rows else None

    def _latest_pairing(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.therapist_service.get_client_therapist(user_id)
        except Exception:
            return None

    def _source_updated_at(self, context: Dict[str, Any]) -> Optional[datetime]:
        intake = context.get("intake") or {}
        latest_self_assessment = context.get("latest_self_assessment") or {}
        moods = context.get("moods") or []
        journals = context.get("journals") or []
        pairing = context.get("pairing") or {}
        analyzed_sessions = context.get("analyzed_sessions") or []
        assignments = context.get("assignments") or []
        contact_request = context.get("contact_request") or {}
        recent_events = context.get("recent_events") or []

        values: List[Any] = [
            intake.get("updated_at"),
            intake.get("completed_at"),
            latest_self_assessment.get("completed_at"),
            ((latest_self_assessment.get("result") or {}) if isinstance(latest_self_assessment, dict) else {}).get("completed_at"),
            pairing.get("paired_at") if isinstance(pairing, dict) else None,
            contact_request.get("updated_at") if isinstance(contact_request, dict) else None,
        ]

        if moods:
            values.append(moods[0].get("created_at"))
        if journals:
            values.append(journals[0].get("created_at"))
        if analyzed_sessions:
            values.append(analyzed_sessions[0].get("analyzed_at"))
        if assignments:
            values.append(assignments[0].get("last_progress_at") or assignments[0].get("completed_at") or assignments[0].get("updated_at"))
        model_events = [
            event
            for event in recent_events
            if str(event.get("event_type") or "").strip() in MODEL_AFFECTING_EVENT_TYPES
        ]
        if model_events:
            values.append(model_events[0].get("occurred_at"))

        return _max_dt(values)

    def _build_context(self, user_id: str) -> Dict[str, Any]:
        intake = self.intake_service.get_profile(user_id)
        latest_self_assessment = self._latest_self_assessment(user_id)
        journals = self._latest_journals(user_id)
        moods = self._latest_moods(user_id)
        assignments = self._latest_assignments(user_id)
        pairing = self._latest_pairing(user_id)
        contact_request = self._latest_contact_request(user_id)
        recent_events = self._recent_events(user_id, limit=24)
        analyzed_sessions = self._latest_analyzed_sessions(user_id)
        long_term_memories = self._latest_long_term_memories(user_id)

        return {
            "intake": intake,
            "latest_self_assessment": latest_self_assessment,
            "journals": journals,
            "moods": moods,
            "assignments": assignments,
            "pairing": pairing,
            "has_therapist": bool(pairing and pairing.get("therapist_id")),
            "contact_request": contact_request,
            "has_contact_request": bool(contact_request and contact_request.get("id")),
            "recent_events": recent_events,
            "analyzed_sessions": analyzed_sessions,
            "long_term_memories": long_term_memories,
            "previous_snapshots": self._recent_snapshots(user_id, limit=4),
            "recent_feedback": self._latest_feedback_row(user_id),
        }

    def _serialize_snapshot_summary(self, user_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
        latest_snapshot_id = row.get("id") if isinstance(row.get("id"), int) else None
        previous = self._previous_snapshot_row(user_id, latest_snapshot_id)
        latest_feedback = self._latest_feedback_row(user_id)
        feedback_pending = False
        if latest_feedback and row.get("created_at"):
            feedback_pending = (_parse_dt(latest_feedback.get("created_at")) or self._now()) > (
                _parse_dt(row.get("created_at")) or self._now()
            )

        signals = row.get("signals") if isinstance(row.get("signals"), dict) else {}
        previous_signals = previous.get("signals") if isinstance(previous, dict) and isinstance(previous.get("signals"), dict) else {}
        current_payload = {
            "chapter_title": row.get("chapter_title"),
            "signals": signals,
        }
        previous_payload = {
            "chapter_title": previous.get("chapter_title") if isinstance(previous, dict) else None,
            "signals": previous_signals,
        } if previous else None

        return {
            "snapshot_id": row.get("id"),
            "trajectory_state": row.get("trajectory_state") or row.get("chapter_title") or "Lắng nghe mình rõ hơn",
            "chapter_title": row.get("chapter_title") or "Lắng nghe mình rõ hơn",
            "reflection_text": row.get("reflection_text") or "",
            "suggested_next_step": row.get("suggested_next_step") or "",
            "trend_summary": row.get("trend_summary") or "",
            "updated_at": row.get("created_at"),
            "has_intake_profile": bool((self.intake_service.get_profile(user_id) or {}).get("completed_at")),
            "has_completed_self_test": bool(self._latest_self_assessment(user_id)),
            "previous_chapter_title": previous.get("chapter_title") if isinstance(previous, dict) else None,
            "what_changed": describe_change(current_payload, previous_payload),
            "feedback_pending": feedback_pending,
            "input_summary": row.get("input_summary") or "",
            "signals": signals,
            "version": row.get("version") or TRAJECTORY_VERSION,
        }

    def _should_dedupe_event(self, user_id: str, event_type: str, dedupe_seconds: int) -> bool:
        if dedupe_seconds <= 0:
            return False
        rows = self._fetch_rows(
            EVENTS_TABLE,
            "user_id",
            user_id,
            order_column="occurred_at",
            desc=True,
            limit=5,
            extra_eq={"event_type": event_type},
        )
        if not rows:
            return False
        latest = _parse_dt(rows[0].get("occurred_at") or rows[0].get("created_at"))
        if not latest:
            return False
        return latest >= self._now() - timedelta(seconds=dedupe_seconds)

    def log_event(
        self,
        user_id: str,
        event_type: str,
        payload: Optional[Dict[str, Any]] = None,
        *,
        dedupe_seconds: int = 300,
    ) -> Optional[Dict[str, Any]]:
        self._ensure_schema()

        normalized_event_type = str(event_type or "").strip()
        if normalized_event_type not in ALLOWED_EVENT_TYPES:
            raise TrajectoryValidationError("Invalid trajectory event type")
        if self._should_dedupe_event(user_id, normalized_event_type, dedupe_seconds):
            return None

        row = self._insert_row(
            EVENTS_TABLE,
            {
                "user_id": user_id,
                "event_type": normalized_event_type,
                "payload": payload if isinstance(payload, dict) else {},
                "occurred_at": self._now_iso(),
                "created_at": self._now_iso(),
            },
        )
        return row

    def submit_feedback(self, user_id: str, feedback_type: str, note: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_schema()
        normalized_type = str(feedback_type or "").strip().lower()
        if not normalized_type:
            raise TrajectoryValidationError("Feedback type is required")

        latest_snapshot = self._latest_snapshot_row(user_id)
        row = self._insert_row(
            FEEDBACK_TABLE,
            {
                "user_id": user_id,
                "snapshot_id": latest_snapshot.get("id") if isinstance(latest_snapshot, dict) else None,
                "feedback_type": normalized_type[:50],
                "note": (str(note or "").strip() or None),
                "created_at": self._now_iso(),
            },
        )
        try:
            self.log_event(
                user_id,
                "trajectory_feedback_submitted",
                {"feedback_type": normalized_type},
                dedupe_seconds=0,
            )
        except Exception:
            pass
        return {"feedback": row}

    def recompute_snapshot(self, user_id: str, trigger: str = "manual") -> Dict[str, Any]:
        self._ensure_schema()
        context = self._build_context(user_id)
        derived = derive_trajectory_snapshot(context)
        row = self._insert_row(
            SNAPSHOTS_TABLE,
            {
                "user_id": user_id,
                "trajectory_state": derived["trajectory_state"],
                "chapter_title": derived["chapter_title"],
                "reflection_text": derived["reflection_text"],
                "suggested_next_step": derived["suggested_next_step"],
                "trend_summary": derived["trend_summary"],
                "input_summary": derived["input_summary"],
                "signals": derived["signals"],
                "version": derived["version"],
                "created_at": self._now_iso(),
            },
        )
        return row

    def _snapshot_is_stale(self, user_id: str, snapshot: Optional[Dict[str, Any]]) -> bool:
        if not snapshot:
            return True

        context = self._build_context(user_id)
        latest_source_dt = self._source_updated_at(context)
        snapshot_dt = _parse_dt(snapshot.get("created_at"))
        if latest_source_dt and (not snapshot_dt or latest_source_dt > snapshot_dt):
            return True

        latest_feedback = self._latest_feedback_row(user_id)
        if latest_feedback and snapshot_dt:
            feedback_dt = _parse_dt(latest_feedback.get("created_at"))
            if feedback_dt and feedback_dt > snapshot_dt:
                return True
        return False

    def get_summary(self, user_id: str, *, record_view: bool = False) -> Dict[str, Any]:
        self._ensure_schema()
        snapshot = self._latest_snapshot_row(user_id)
        if self._snapshot_is_stale(user_id, snapshot):
            snapshot = self.recompute_snapshot(user_id)

        if not snapshot:
            raise TrajectoryValidationError("Unable to build trajectory summary")

        summary = self._serialize_snapshot_summary(user_id, snapshot)
        if record_view:
            try:
                self.log_event(user_id, "home_opened", {"surface": "home"})
                self.log_event(user_id, "trajectory_card_opened", {"surface": "home"})
            except Exception:
                pass
        return summary

    def build_chat_context(self, user_id: str) -> str:
        summary = self.get_summary(user_id, record_view=False)
        intake = self.intake_service.get_profile(user_id)
        latest_self_assessment = self._latest_self_assessment(user_id)
        latest_result = (latest_self_assessment or {}).get("result") or {}

        lines: List[str] = ["## QUỸ ĐẠO TÂM LÝ GẦN ĐÂY"]
        if intake.get("primary_reason") or intake.get("desired_help_focus"):
            lines.append(f"- Baseline intake: {summary.get('input_summary') or 'Người dùng đã có baseline ban đầu.'}")
        if latest_self_assessment:
            severity = latest_result.get("severity") or "đã có self-test"
            total_score = latest_result.get("total_score")
            if total_score is not None:
                lines.append(f"- Self-test gần nhất: {severity} (điểm {total_score}).")
            else:
                lines.append(f"- Self-test gần nhất: {severity}.")
        lines.append(f"- Chương hiện tại: {summary.get('chapter_title')}.")
        if summary.get("what_changed"):
            lines.append(f"- Điều đã đổi từ lần trước: {summary.get('what_changed')}")
        if summary.get("trend_summary"):
            lines.append(f"- Miru đang quan sát: {summary.get('trend_summary')}")
        lines.append(
            "- Dùng phần này như ngữ cảnh hỗ trợ để hiểu nhịp sống gần đây của người dùng, không dùng như chẩn đoán."
        )
        return "\n".join(lines)

    def get_clinician_summary(self, client_id: str, therapist_id: str) -> Dict[str, Any]:
        preferences = self.therapist_service._sharing_preferences(therapist_id, client_id)
        insights_access = str(preferences.get("insights_access") or "none")
        if insights_access not in {"ai_report", "direct"}:
            return {
                "visible": False,
                "access_level": insights_access,
                "trajectory_state": None,
                "trend_summary": None,
                "suggested_next_step": None,
                "what_changed": None,
                "updated_at": None,
            }

        summary = self.get_summary(client_id, record_view=False)
        return {
            "visible": True,
            "access_level": insights_access,
            "trajectory_state": summary.get("trajectory_state"),
            "chapter_title": summary.get("chapter_title"),
            "reflection_text": summary.get("reflection_text"),
            "trend_summary": summary.get("trend_summary"),
            "suggested_next_step": summary.get("suggested_next_step"),
            "what_changed": summary.get("what_changed"),
            "updated_at": summary.get("updated_at"),
        }

    def recompute_due_snapshots(self, limit: int = 25) -> int:
        self._ensure_schema()

        recent_users: List[str] = []
        seen: set[str] = set()

        try:
            response = (
                self.supabase.table(EVENTS_TABLE)
                .select("user_id, occurred_at")
                .order("occurred_at", desc=True)
                .limit(limit * 8)
                .execute()
            )
        except Exception:
            response = None

        for row in (response.data or []) if response else []:
            user_id = str(row.get("user_id") or "").strip()
            if user_id and user_id not in seen:
                seen.add(user_id)
                recent_users.append(user_id)
            if len(recent_users) >= limit:
                break

        recomputed = 0
        for user_id in recent_users:
            snapshot = self._latest_snapshot_row(user_id)
            if self._snapshot_is_stale(user_id, snapshot):
                try:
                    self.recompute_snapshot(user_id, trigger="manual")
                    recomputed += 1
                except Exception:
                    continue
        return recomputed


_trajectory_service: Optional[TrajectoryService] = None


def get_trajectory_service() -> TrajectoryService:
    global _trajectory_service
    if _trajectory_service is None:
        _trajectory_service = TrajectoryService()
    return _trajectory_service

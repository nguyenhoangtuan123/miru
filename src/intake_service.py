from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from database import DatabaseManager
from memory_service import get_memory_service

INTAKE_TABLE = "user_intake_profiles"

DEFAULT_INTAKE_PROFILE = {
    "primary_reason": None,
    "overwhelm_level": None,
    "support_style": None,
    "desired_help_focus": None,
    "wants_therapist_connection": False,
    "memory_note": None,
    "completed_at": None,
    "created_at": None,
    "updated_at": None,
}

ALLOWED_PRIMARY_REASONS = {
    "stress",
    "anxiety",
    "sadness",
    "loneliness",
    "burnout",
    "relationship",
    "self_understanding",
    "other",
}
ALLOWED_OVERWHELM_LEVELS = {"low", "medium", "high"}
ALLOWED_SUPPORT_STYLES = {"keep_inside", "mixed", "reach_out"}
ALLOWED_HELP_FOCUS = {
    "calm_down",
    "understand_patterns",
    "build_routine",
    "express_feelings",
    "connect_therapist",
    "gentle_checkins",
}


class IntakeSchemaError(RuntimeError):
    pass


class IntakeValidationError(ValueError):
    pass


class IntakeService:
    def __init__(self):
        self.db = DatabaseManager()
        self.supabase = self.db.supabase

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _normalize_choice(value: Any, allowed: set[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        if not normalized:
            return None
        if normalized not in allowed:
            raise IntakeValidationError("Invalid intake option")
        return normalized

    @staticmethod
    def _normalize_note(value: Any) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized[:1000] if normalized else None

    def _raise_schema_error(self, exc: Exception) -> None:
        lowered = str(exc).lower()
        if "user_intake_profiles" in lowered or "schema cache" in lowered or "could not find the table" in lowered:
            raise IntakeSchemaError(
                "Intake schema is unavailable. Please run migration 026_add_self_assessment_and_intake.sql."
            ) from exc
        raise exc

    def _serialize_row(self, user_id: str, row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        source = row or {}
        return {
            "user_id": user_id,
            "primary_reason": source.get("primary_reason"),
            "overwhelm_level": source.get("overwhelm_level"),
            "support_style": source.get("support_style"),
            "desired_help_focus": source.get("desired_help_focus"),
            "wants_therapist_connection": bool(source.get("wants_therapist_connection", False)),
            "memory_note": source.get("memory_note"),
            "completed_at": source.get("completed_at"),
            "created_at": source.get("created_at"),
            "updated_at": source.get("updated_at"),
        }

    def get_profile(self, user_id: str) -> Dict[str, Any]:
        try:
            response = (
                self.supabase.table(INTAKE_TABLE)
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            try:
                self._raise_schema_error(exc)
            except IntakeSchemaError:
                return {"user_id": user_id, **DEFAULT_INTAKE_PROFILE}
            raise
        row = response.data[0] if response.data else None
        return self._serialize_row(user_id, row)

    def _push_to_memory(self, user_id: str, profile: Dict[str, Any]) -> None:
        memory_service = get_memory_service()
        if not memory_service:
            return

        primary_reason_labels = {
            "stress": "áp lực và căng thẳng",
            "anxiety": "lo âu",
            "sadness": "buồn và hụt năng lượng",
            "loneliness": "cô đơn",
            "burnout": "kiệt sức",
            "relationship": "khó khăn trong mối quan hệ",
            "self_understanding": "muốn hiểu mình hơn",
            "other": "một lý do riêng khó gọi tên",
        }
        support_style_labels = {
            "keep_inside": "thường giữ mọi thứ một mình",
            "mixed": "lúc giữ một mình, lúc tìm hỗ trợ",
            "reach_out": "có xu hướng tìm hỗ trợ khi khó khăn",
        }
        overwhelm_labels = {
            "low": "mức quá tải gần đây khá thấp",
            "medium": "mức quá tải gần đây ở mức vừa",
            "high": "mức quá tải gần đây khá cao",
        }
        help_focus_labels = {
            "calm_down": "muốn bình tĩnh lại và ổn định cảm xúc",
            "understand_patterns": "muốn hiểu các mẫu lặp cảm xúc của mình",
            "build_routine": "muốn xây lại nhịp sinh hoạt và thói quen",
            "express_feelings": "muốn nói ra cảm xúc dễ hơn",
            "connect_therapist": "muốn được hỗ trợ kết nối therapist",
            "gentle_checkins": "muốn được đồng hành bằng những nhắc nhở nhẹ nhàng",
        }

        lines = ["Miru đã ghi nhận baseline ban đầu của người dùng:"]
        if profile.get("primary_reason"):
            lines.append(
                f"- Lý do chính hiện tại: {primary_reason_labels.get(str(profile['primary_reason']), profile['primary_reason'])}."
            )
        if profile.get("overwhelm_level"):
            lines.append(
                f"- {overwhelm_labels.get(str(profile['overwhelm_level']), str(profile['overwhelm_level']))}."
            )
        if profile.get("support_style"):
            lines.append(
                f"- Khi khó khăn, người dùng {support_style_labels.get(str(profile['support_style']), str(profile['support_style']))}."
            )
        if profile.get("desired_help_focus"):
            lines.append(
                f"- Điều người dùng muốn Miru giúp nhất: {help_focus_labels.get(str(profile['desired_help_focus']), str(profile['desired_help_focus']))}."
            )
        if profile.get("wants_therapist_connection"):
            lines.append("- Người dùng có mong muốn kết nối therapist nếu phù hợp.")
        if profile.get("memory_note"):
            lines.append(f"- Điều Miru nên nhớ: {profile['memory_note']}")

        note = "\n".join(lines)
        memory_service.add_conversation(
            user_id,
            note,
            "Miru đã lưu lại baseline này như một tín hiệu dài hạn để hiểu người dùng theo thời gian.",
            metadata={"type": "intake_profile"},
        )

    def upsert_profile(self, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        next_row = {
            "user_id": user_id,
            "primary_reason": self._normalize_choice(payload.get("primary_reason"), ALLOWED_PRIMARY_REASONS),
            "overwhelm_level": self._normalize_choice(payload.get("overwhelm_level"), ALLOWED_OVERWHELM_LEVELS),
            "support_style": self._normalize_choice(payload.get("support_style"), ALLOWED_SUPPORT_STYLES),
            "desired_help_focus": self._normalize_choice(payload.get("desired_help_focus"), ALLOWED_HELP_FOCUS),
            "wants_therapist_connection": bool(payload.get("wants_therapist_connection", False)),
            "memory_note": self._normalize_note(payload.get("memory_note")),
            "completed_at": self._now(),
            "updated_at": self._now(),
        }

        current = self.get_profile(user_id)
        if not current.get("created_at"):
            next_row["created_at"] = self._now()

        try:
            response = (
                self.supabase.table(INTAKE_TABLE)
                .upsert(next_row, on_conflict="user_id")
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise

        saved = response.data[0] if response.data else next_row
        serialized = self._serialize_row(user_id, saved)
        try:
            self._push_to_memory(user_id, serialized)
        except Exception:
            pass
        try:
            from trajectory_service import get_trajectory_service

            get_trajectory_service().recompute_snapshot(user_id, trigger="manual")
        except Exception:
            pass
        return serialized


_intake_service: Optional[IntakeService] = None


def get_intake_service() -> IntakeService:
    global _intake_service
    if _intake_service is None:
        _intake_service = IntakeService()
    return _intake_service

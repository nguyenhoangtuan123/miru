import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ai_service import get_ai_service
from database import DatabaseManager
from memory_service import PROJECT_ROOT, get_memory_service
from push_service import get_push_service
from services import chat_manager

logger = logging.getLogger(__name__)

INACTIVITY_HOURS = int(os.getenv("PROACTIVE_PUSH_INACTIVITY_HOURS", "12"))
POLL_MINUTES = int(os.getenv("PROACTIVE_PUSH_POLL_MINUTES", "60"))
STATE_FILE = Path(PROJECT_ROOT) / "proactive_push_state.json"


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


class ProactivePushScheduler:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def is_enabled(self) -> bool:
        return os.getenv("ENABLE_PROACTIVE_PUSH", "true").lower() != "false"

    async def start(self):
        if self._task or not self.is_enabled():
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="miru-proactive-push")
        logger.info("Proactive push scheduler started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self):
        while self._running:
            try:
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Proactive push cycle failed: %s", exc)
            await asyncio.sleep(max(POLL_MINUTES, 1) * 60)

    async def run_once(self):
        push_service = get_push_service()
        if not push_service.is_enabled():
            return

        try:
            from trajectory_service import get_trajectory_service

            get_trajectory_service().recompute_due_snapshots(limit=10)
        except Exception:
            pass

        for user_id in push_service.get_subscribed_user_ids():
            try:
                await self._process_user(user_id)
            except Exception as exc:
                logger.warning("Failed proactive push for %s: %s", user_id, exc)

    def _db(self) -> DatabaseManager:
        return DatabaseManager()

    def _get_last_chat_activity(self, user_id: str) -> tuple[Optional[datetime], Optional[str]]:
        try:
            response = (
                self._db()
                .supabase.table("chat_messages")
                .select("created_at, session_id")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            row = (response.data or [None])[0]
            if not row:
                return None, None
            return _parse_dt(row.get("created_at")), str(row.get("session_id")) if row.get("session_id") is not None else None
        except Exception:
            return None, None

    def _get_last_therapist_chat_activity(self, user_id: str) -> Optional[datetime]:
        try:
            response = (
                self._db()
                .supabase.table("therapist_client_messages")
                .select("created_at")
                .eq("client_id", user_id)
                .eq("sender_type", "client")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            row = (response.data or [None])[0]
            return _parse_dt(row.get("created_at")) if row else None
        except Exception:
            return None

    def _pick_last_activity(self, user_id: str) -> tuple[Optional[datetime], Optional[str]]:
        chat_dt, session_id = self._get_last_chat_activity(user_id)
        therapist_dt = self._get_last_therapist_chat_activity(user_id)
        if therapist_dt and (not chat_dt or therapist_dt > chat_dt):
            return therapist_dt, session_id
        return chat_dt, session_id

    def _get_short_term_memory(self, session_id: Optional[str]) -> str:
        if not session_id:
            return ""
        try:
            facts = get_memory_service().get_session_facts(session_id)
            return facts[:1600]
        except Exception:
            return ""

    def _get_long_term_memory(self, user_id: str) -> List[str]:
        try:
            memories = get_memory_service().get_all_memories(user_id).get("results", [])
        except Exception:
            return []

        snippets: List[str] = []
        for item in memories[:8]:
            if not isinstance(item, dict):
                continue
            text = item.get("memory") or item.get("text") or item.get("content")
            if isinstance(text, str) and text.strip():
                snippets.append(text.strip())
        return snippets

    def _load_state(self) -> Dict[str, Dict[str, str]]:
        if not STATE_FILE.exists():
            return {}
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save_state(self, state: Dict[str, Dict[str, str]]):
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    def _already_sent_for_activity(self, user_id: str, activity_marker: str) -> bool:
        state = self._load_state()
        record = state.get(user_id) or {}
        return record.get("activity_marker") == activity_marker

    def _mark_sent(self, user_id: str, activity_marker: str, message: str):
        state = self._load_state()
        state[user_id] = {
            "activity_marker": activity_marker,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "message": message,
        }
        self._save_state(state)

    async def _build_proactive_message(
        self,
        user_id: str,
        last_activity: datetime,
        short_term_memory: str,
        long_term_memories: List[str],
        trajectory_summary: Optional[Dict[str, Any]] = None,
    ) -> str:
        ai_service = get_ai_service()
        inactivity_hours = max(int((datetime.now(timezone.utc) - last_activity).total_seconds() // 3600), INACTIVITY_HOURS)
        long_term_context = "\n".join(f"- {memory}" for memory in long_term_memories[:6]) or "- Chua co memory dai han ro rang."
        short_term_context = short_term_memory or "Chua co facts ngan han gan day."
        trajectory_context = "Chua co ban tom tat quy dao gan day."
        tone_hint = "giu giong am ap, tu nhien va goi mo nhe."
        if isinstance(trajectory_summary, dict) and trajectory_summary:
            chapter_title = str(trajectory_summary.get("chapter_title") or trajectory_summary.get("trajectory_state") or "").strip()
            trend_summary = str(trajectory_summary.get("trend_summary") or "").strip()
            what_changed = str(trajectory_summary.get("what_changed") or "").strip()
            parts = []
            if chapter_title:
                parts.append(f"- Chuong hien tai: {chapter_title}")
            if trend_summary:
                parts.append(f"- Miru dang thay: {trend_summary}")
            if what_changed:
                parts.append(f"- Dieu da doi: {what_changed}")
            trajectory_context = "\n".join(parts) if parts else trajectory_context

            state_label = (chapter_title or "").lower()
            if "quá tải" in state_label or "qua tai" in state_label:
                tone_hint = "giu nhip rat nhe, it cau hoi, uu tien on dinh va khong tao ap luc."
            elif "mở lời" in state_label or "mo loi" in state_label:
                tone_hint = "khuyen khich chia se them mot chut neu user muon, nhung van giu nhip nhe."
            elif "ổn định" in state_label or "on dinh" in state_label:
                tone_hint = "cuong co tien bo gan day, nhac user ve nhung dieu dang on hon."

        prompt = f"""
Ban la Miru, dang gui mot push notification chu dong cho user sau {inactivity_hours} gio khong nhan tin.

Yeu cau:
- Viet 1-2 cau, am ap, tu nhien, nhu nguoi dong hanh nhan tin truoc.
- Co tham chieu nhe den boi canh ca nhan neu hop ly.
- Khong chan doan, khong gay ap luc, khong dai dong.
- Neu user tung met moi, hay nhac rat nhe rang.
- {tone_hint}

Short-term memory gan day:
{short_term_context}

Long-term memory lien quan:
{long_term_context}

Tom tat quy dao gan day:
{trajectory_context}

Chi tra ve noi dung thong diep.
"""
        response = await ai_service.generate_response(prompt)
        message = (response or "").strip()
        if not message:
            return "Miru dang nghi den ban. Neu hom nay ban muon tam su, minh van o day."
        return message[:220]

    async def _process_user(self, user_id: str):
        last_activity, session_id = self._pick_last_activity(user_id)
        if not last_activity:
            return

        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)

        inactivity = datetime.now(timezone.utc) - last_activity
        if inactivity < timedelta(hours=INACTIVITY_HOURS):
            return

        activity_marker = f"12h::{last_activity.isoformat()}"
        if self._already_sent_for_activity(user_id, activity_marker):
            return

        short_term_memory = self._get_short_term_memory(session_id)
        long_term_memories = self._get_long_term_memory(user_id)
        trajectory_summary = None
        try:
            from trajectory_service import get_trajectory_service

            trajectory_summary = get_trajectory_service().get_summary(user_id, record_view=False)
        except Exception:
            trajectory_summary = None
        message = await self._build_proactive_message(
            user_id,
            last_activity,
            short_term_memory,
            long_term_memories,
            trajectory_summary,
        )

        target_session_id = session_id
        try:
            proactive_sync = chat_manager.ensure_proactive_message(
                user_id,
                message,
                source="push_scheduler",
                create_if_missing=True,
            )
            if proactive_sync.get("success") and proactive_sync.get("session_id") is not None:
                target_session_id = str(proactive_sync.get("session_id"))
        except Exception as sync_error:
            logger.warning("Failed to sync proactive message to chat for %s: %s", user_id, sync_error)

        result = get_push_service().send_push_to_user(
            user_id=user_id,
            title="Miru nho ban",
            body=message,
            url="/chat",
            tag="proactive-12h",
            extra={
                "kind": "proactive_checkin",
                "last_activity": last_activity.isoformat(),
                "session_id": target_session_id,
            },
        )
        if result.get("success"):
            self._mark_sent(user_id, activity_marker, message)


proactive_push_scheduler = ProactivePushScheduler()

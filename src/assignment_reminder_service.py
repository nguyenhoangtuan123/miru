import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from memory_service import PROJECT_ROOT
from push_service import get_push_service
from therapist_service import get_therapist_service
from utils import LOCAL_TZ

logger = logging.getLogger(__name__)

POLL_MINUTES = int(os.getenv("ASSIGNMENT_REMINDER_POLL_MINUTES", "30"))
LOOKAHEAD_HOURS = int(os.getenv("ASSIGNMENT_REMINDER_LOOKAHEAD_HOURS", "24"))
STATE_FILE = Path(PROJECT_ROOT) / "assignment_reminder_state.json"


class AssignmentReminderScheduler:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        if self._task:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="miru-assignment-reminders")
        logger.info("Assignment reminder scheduler started")

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
                logger.warning("Assignment reminder cycle failed: %s", exc)
            await asyncio.sleep(max(POLL_MINUTES, 1) * 60)

    def _load_state(self) -> Dict[str, Dict[str, str]]:
        if not STATE_FILE.exists():
            return {}
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save_state(self, state: Dict[str, Dict[str, str]]):
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    def _was_sent(self, marker: str) -> bool:
        state = self._load_state()
        return marker in state

    def _mark_sent(self, marker: str, assignment_id: int, client_id: str):
        state = self._load_state()
        state[marker] = {
            "assignment_id": str(assignment_id),
            "client_id": client_id,
            "sent_at": datetime.now(LOCAL_TZ).isoformat(),
        }
        self._save_state(state)

    async def run_once(self):
        push_service = get_push_service()
        if not push_service.is_enabled():
            return

        service = get_therapist_service()
        for assignment in service.get_assignments_due_for_reminder(lookahead_hours=LOOKAHEAD_HOURS):
            assignment_id = assignment.get("id")
            client_id = assignment.get("client_id")
            if not isinstance(assignment_id, int) or not isinstance(client_id, str) or not client_id:
                continue

            due_date = str(assignment.get("due_date") or "")
            marker = f"{assignment_id}::{due_date}::{assignment.get('status')}"
            if self._was_sent(marker):
                continue

            title = "Bài tập sắp đến hạn"
            assignment_title = str(assignment.get("title") or "Bài tập")
            body = f"'{assignment_title}' sắp đến hạn. Bạn mở Miru để cập nhật tiến độ nhé."
            result = push_service.send_push_to_user(
                user_id=client_id,
                title=title,
                body=body[:180],
                url="/therapy",
                tag="assignment-near-due",
                extra={
                    "kind": "assignment_near_due",
                    "assignment_id": assignment_id,
                    "due_date": due_date,
                },
            )
            if result.get("success"):
                service.mark_assignment_near_due_reminded(assignment_id)
                self._mark_sent(marker, assignment_id, client_id)


assignment_reminder_scheduler = AssignmentReminderScheduler()

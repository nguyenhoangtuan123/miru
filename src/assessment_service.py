from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

from assessment_definitions import (
    ASSESSMENT_DEFINITIONS,
    question_rows,
    score_assessment,
    template_catalog,
)
from therapist_service import get_therapist_service
from therapist_verification_service import get_therapist_verification_service

load_dotenv()

TEMPLATES_TABLE = "assessment_templates"
QUESTIONS_TABLE = "assessment_questions"
ASSIGNMENTS_TABLE = "assessment_assignments"
ANSWERS_TABLE = "assessment_answers"
RESULTS_TABLE = "assessment_results"


class AssessmentSchemaError(RuntimeError):
    pass


class AssessmentAccessError(PermissionError):
    pass


class AssessmentNotFoundError(LookupError):
    pass


class AssessmentValidationError(ValueError):
    pass


class AssessmentService:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        self.supabase: Client = create_client(url, key)
        self.therapist_service = get_therapist_service()
        self.verification_service = get_therapist_verification_service()
        self._seed_checked = False

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _raise_schema_error(self, exc: Exception) -> None:
        lowered = str(exc).lower()
        if "assessment_" in lowered or "schema cache" in lowered or "could not find the table" in lowered:
            raise AssessmentSchemaError(
                "Assessment schema is unavailable. Please run migration 022_add_assessments.sql."
            ) from exc
        raise exc

    def _ensure_schema_and_seeded(self) -> None:
        if self._seed_checked:
            return
        try:
            self.supabase.table(TEMPLATES_TABLE).select("id").limit(1).execute()
            self.supabase.table(QUESTIONS_TABLE).select("id").limit(1).execute()
            self.supabase.table(ASSIGNMENTS_TABLE).select("id").limit(1).execute()
            self.supabase.table(ANSWERS_TABLE).select("id").limit(1).execute()
            self.supabase.table(RESULTS_TABLE).select("id").limit(1).execute()
        except Exception as exc:
            self._raise_schema_error(exc)

        try:
            existing_templates = self.supabase.table(TEMPLATES_TABLE).select("id").execute()
            existing_template_ids = {
                str(row.get("id"))
                for row in (existing_templates.data or [])
                if isinstance(row, dict) and row.get("id") is not None
            }
            missing_templates = [
                template
                for template in template_catalog()
                if template["id"] not in existing_template_ids
            ]
            if missing_templates:
                self.supabase.table(TEMPLATES_TABLE).insert(missing_templates).execute()

            for template in template_catalog():
                try:
                    response = (
                        self.supabase.table(QUESTIONS_TABLE)
                        .select("id")
                        .eq("template_id", template["id"])
                        .execute()
                    )
                    existing_count = len(response.data or [])
                except Exception as exc:
                    self._raise_schema_error(exc)
                    existing_count = 0

                if existing_count == 0:
                    rows = [
                        {
                            "template_id": template["id"],
                            "order_index": question["order_index"],
                            "key": question["key"],
                            "prompt": question["prompt"],
                            "choices": question["choices"],
                            "subscale": question.get("subscale"),
                        }
                        for question in question_rows(template["id"])
                    ]
                    self.supabase.table(QUESTIONS_TABLE).insert(rows).execute()
        except Exception as exc:
            self._raise_schema_error(exc)

        self._seed_checked = True

    def _current_therapist(self, user_id: str, email: str = "", name: str = "") -> Dict[str, Any]:
        self._ensure_schema_and_seeded()
        if not self.verification_service.can_access_portal(user_id):
            raise AssessmentAccessError("Therapist verification approval required")
        therapist = self.therapist_service.ensure_therapist_profile(
            user_id,
            email=email,
            name=name or "Therapist",
        )
        if not therapist or not isinstance(therapist.get("id"), str):
            raise AssessmentAccessError("Therapist profile is unavailable")
        return therapist

    def _ensure_relationship(self, therapist_id: str, client_id: str) -> None:
        if not self.therapist_service.has_active_relationship(therapist_id, client_id):
            raise AssessmentAccessError("No active therapist-client relationship")

    def _fetch_templates_map(self, template_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        unique_ids = sorted({template_id for template_id in template_ids if template_id})
        if not unique_ids:
            return {}
        try:
            response = self.supabase.table(TEMPLATES_TABLE).select("*").in_("id", unique_ids).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            return {}
        return {
            str(row.get("id")): row
            for row in (response.data or [])
            if isinstance(row, dict) and row.get("id") is not None
        }

    def _fetch_users_map(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
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

    def _fetch_therapists_map(self, therapist_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        unique_ids = sorted({therapist_id for therapist_id in therapist_ids if therapist_id})
        if not unique_ids:
            return {}
        try:
            response = self.supabase.table("therapists").select("id, user_id, name, email").in_("id", unique_ids).execute()
        except Exception:
            return {}
        return {
            str(row.get("id")): row
            for row in (response.data or [])
            if isinstance(row, dict) and row.get("id") is not None
        }

    def _fetch_results_map(self, assignment_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        unique_ids = sorted({assignment_id for assignment_id in assignment_ids if assignment_id})
        if not unique_ids:
            return {}
        try:
            response = self.supabase.table(RESULTS_TABLE).select("*").in_("assignment_id", unique_ids).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            return {}
        return {
            str(row.get("assignment_id")): row
            for row in (response.data or [])
            if isinstance(row, dict) and row.get("assignment_id") is not None
        }

    def _fetch_questions(self, template_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(QUESTIONS_TABLE)
                .select("*")
                .eq("template_id", template_id)
                .order("order_index")
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return []
        return [row for row in (response.data or []) if isinstance(row, dict)]

    def _fetch_answers(self, assignment_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table(ANSWERS_TABLE)
                .select("*")
                .eq("assignment_id", assignment_id)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return []
        return [row for row in (response.data or []) if isinstance(row, dict)]

    def _serialize_result(self, row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        return {
            "id": str(row.get("id") or ""),
            "total_score": row.get("total_score"),
            "severity": row.get("severity"),
            "interpretation": row.get("interpretation"),
            "subscale_scores": row.get("subscale_scores") if isinstance(row.get("subscale_scores"), dict) else {},
            "completed_at": row.get("completed_at"),
        }

    def _serialize_assignment_summary(
        self,
        row: Dict[str, Any],
        template: Optional[Dict[str, Any]],
        result: Optional[Dict[str, Any]],
        therapist: Optional[Dict[str, Any]] = None,
        client_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "id": str(row.get("id") or ""),
            "template_id": str(row.get("template_id") or ""),
            "template_name": template.get("name") if isinstance(template, dict) else None,
            "template_short_code": template.get("short_code") if isinstance(template, dict) else None,
            "status": row.get("status") or "assigned",
            "due_date": row.get("due_date"),
            "assigned_at": row.get("assigned_at"),
            "completed_at": row.get("completed_at"),
            "therapist_note": row.get("therapist_note"),
            "client_id": str(row.get("client_id") or ""),
            "client_name": (
                client_user.get("name")
                if isinstance(client_user, dict) and client_user.get("name")
                else str(row.get("client_id") or "")
            ),
            "therapist_id": str(row.get("therapist_id") or ""),
            "therapist_name": (
                therapist.get("name")
                if isinstance(therapist, dict) and therapist.get("name")
                else therapist.get("email")
                if isinstance(therapist, dict)
                else None
            ),
            "result": self._serialize_result(result),
        }

    def list_templates(self) -> List[Dict[str, Any]]:
        self._ensure_schema_and_seeded()
        try:
            response = self.supabase.table(TEMPLATES_TABLE).select("*").order("name").execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            return []
        return [
            {
                "id": str(row.get("id") or ""),
                "short_code": row.get("short_code"),
                "name": row.get("name"),
                "description": row.get("description"),
                "instructions": row.get("instructions"),
                "question_count": row.get("question_count"),
                "scoring_mode": row.get("scoring_mode"),
            }
            for row in (response.data or [])
            if isinstance(row, dict)
        ]

    def create_assignment(
        self,
        therapist_user_id: str,
        payload: Dict[str, Any],
        email: str = "",
        name: str = "",
    ) -> Dict[str, Any]:
        therapist = self._current_therapist(therapist_user_id, email=email, name=name)
        therapist_id = str(therapist.get("id"))
        client_id = str(payload.get("client_id") or "").strip()
        template_id = str(payload.get("template_id") or "").strip().lower()
        therapist_note = payload.get("therapist_note")
        due_date = payload.get("due_date")

        if not client_id:
            raise AssessmentValidationError("Client ID is required")
        if template_id not in ASSESSMENT_DEFINITIONS:
            raise AssessmentValidationError("Unsupported assessment template")
        self._ensure_relationship(therapist_id, client_id)

        assignment_payload = {
            "template_id": template_id,
            "therapist_id": therapist_id,
            "client_id": client_id,
            "status": "assigned",
            "therapist_note": therapist_note,
            "due_date": due_date,
            "assigned_at": self._now(),
            "created_at": self._now(),
            "updated_at": self._now(),
        }
        try:
            response = self.supabase.table(ASSIGNMENTS_TABLE).insert(assignment_payload).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise AssessmentValidationError("Failed to create assessment assignment")

        row = response.data[0]
        template = self._fetch_templates_map([template_id]).get(template_id)
        client_user = self._fetch_users_map([client_id]).get(client_id)
        return self._serialize_assignment_summary(row, template, None, therapist=therapist, client_user=client_user)

    def list_therapist_client_assignments(
        self,
        therapist_user_id: str,
        client_id: str,
        email: str = "",
        name: str = "",
    ) -> List[Dict[str, Any]]:
        therapist = self._current_therapist(therapist_user_id, email=email, name=name)
        therapist_id = str(therapist.get("id"))
        self._ensure_relationship(therapist_id, client_id)
        try:
            response = (
                self.supabase.table(ASSIGNMENTS_TABLE)
                .select("*")
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .order("assigned_at", desc=True)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return []

        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        templates = self._fetch_templates_map([str(row.get("template_id") or "") for row in rows])
        results = self._fetch_results_map([str(row.get("id") or "") for row in rows])
        client_user = self._fetch_users_map([client_id]).get(client_id)
        return [
            self._serialize_assignment_summary(
                row,
                templates.get(str(row.get("template_id") or "")),
                results.get(str(row.get("id") or "")),
                therapist=therapist,
                client_user=client_user,
            )
            for row in rows
        ]

    def _assignment_for_therapist(
        self,
        therapist_id: str,
        client_id: str,
        assignment_id: str,
    ) -> Dict[str, Any]:
        self._ensure_relationship(therapist_id, client_id)
        try:
            response = (
                self.supabase.table(ASSIGNMENTS_TABLE)
                .select("*")
                .eq("id", assignment_id)
                .eq("therapist_id", therapist_id)
                .eq("client_id", client_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise AssessmentNotFoundError("Assessment assignment not found")
        return response.data[0]

    def _assignment_for_client(self, client_id: str, assignment_id: str) -> Dict[str, Any]:
        try:
            response = (
                self.supabase.table(ASSIGNMENTS_TABLE)
                .select("*")
                .eq("id", assignment_id)
                .eq("client_id", client_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            raise
        if not response.data:
            raise AssessmentNotFoundError("Assessment assignment not found")
        return response.data[0]

    def _serialize_assignment_detail(
        self,
        row: Dict[str, Any],
        template: Optional[Dict[str, Any]],
        questions: List[Dict[str, Any]],
        answers: List[Dict[str, Any]],
        result: Optional[Dict[str, Any]],
        therapist: Optional[Dict[str, Any]] = None,
        client_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        answers_by_question_id = {
            str(answer.get("question_id")): answer
            for answer in answers
            if isinstance(answer, dict) and answer.get("question_id") is not None
        }
        serialized_questions = []
        serialized_answers = []
        for question in questions:
            question_id = str(question.get("id") or "")
            answer = answers_by_question_id.get(question_id)
            serialized_question = {
                "id": question_id,
                "order_index": question.get("order_index"),
                "key": question.get("key"),
                "prompt": question.get("prompt"),
                "choices": question.get("choices") if isinstance(question.get("choices"), list) else [],
                "subscale": question.get("subscale"),
            }
            serialized_questions.append(serialized_question)
            if answer:
                choice_label = None
                for choice in serialized_question["choices"]:
                    if isinstance(choice, dict) and choice.get("value") == answer.get("answer_value"):
                        choice_label = choice.get("label")
                        break
                serialized_answers.append(
                    {
                        "question_id": question_id,
                        "question_key": question.get("key"),
                        "answer_value": answer.get("answer_value"),
                        "choice_label": choice_label,
                    }
                )

        return {
            **self._serialize_assignment_summary(row, template, result, therapist=therapist, client_user=client_user),
            "template": {
                "id": template.get("id") if isinstance(template, dict) else row.get("template_id"),
                "short_code": template.get("short_code") if isinstance(template, dict) else None,
                "name": template.get("name") if isinstance(template, dict) else None,
                "description": template.get("description") if isinstance(template, dict) else None,
                "instructions": template.get("instructions") if isinstance(template, dict) else None,
                "question_count": template.get("question_count") if isinstance(template, dict) else len(serialized_questions),
                "scoring_mode": template.get("scoring_mode") if isinstance(template, dict) else None,
            },
            "questions": serialized_questions,
            "answers": serialized_answers,
        }

    def get_therapist_assignment_detail(
        self,
        therapist_user_id: str,
        client_id: str,
        assignment_id: str,
        email: str = "",
        name: str = "",
    ) -> Dict[str, Any]:
        therapist = self._current_therapist(therapist_user_id, email=email, name=name)
        therapist_id = str(therapist.get("id"))
        row = self._assignment_for_therapist(therapist_id, client_id, assignment_id)
        template = self._fetch_templates_map([str(row.get("template_id") or "")]).get(str(row.get("template_id") or ""))
        questions = self._fetch_questions(str(row.get("template_id") or ""))
        answers = self._fetch_answers(str(row.get("id") or ""))
        result = self._fetch_results_map([str(row.get("id") or "")]).get(str(row.get("id") or ""))
        client_user = self._fetch_users_map([client_id]).get(client_id)
        return self._serialize_assignment_detail(row, template, questions, answers, result, therapist=therapist, client_user=client_user)

    def list_my_assignments(self, client_id: str) -> List[Dict[str, Any]]:
        self._ensure_schema_and_seeded()
        try:
            response = (
                self.supabase.table(ASSIGNMENTS_TABLE)
                .select("*")
                .eq("client_id", client_id)
                .order("assigned_at", desc=True)
                .execute()
            )
        except Exception as exc:
            self._raise_schema_error(exc)
            return []

        rows = [row for row in (response.data or []) if isinstance(row, dict)]
        templates = self._fetch_templates_map([str(row.get("template_id") or "") for row in rows])
        results = self._fetch_results_map([str(row.get("id") or "") for row in rows])
        therapists = self._fetch_therapists_map([str(row.get("therapist_id") or "") for row in rows])
        client_user = self._fetch_users_map([client_id]).get(client_id)
        return [
            self._serialize_assignment_summary(
                row,
                templates.get(str(row.get("template_id") or "")),
                results.get(str(row.get("id") or "")),
                therapist=therapists.get(str(row.get("therapist_id") or "")),
                client_user=client_user,
            )
            for row in rows
            if row.get("status") != "cancelled"
        ]

    def get_my_assignment_detail(self, client_id: str, assignment_id: str) -> Dict[str, Any]:
        self._ensure_schema_and_seeded()
        row = self._assignment_for_client(client_id, assignment_id)
        template = self._fetch_templates_map([str(row.get("template_id") or "")]).get(str(row.get("template_id") or ""))
        questions = self._fetch_questions(str(row.get("template_id") or ""))
        answers = self._fetch_answers(str(row.get("id") or ""))
        result = self._fetch_results_map([str(row.get("id") or "")]).get(str(row.get("id") or ""))
        therapist = self._fetch_therapists_map([str(row.get("therapist_id") or "")]).get(str(row.get("therapist_id") or ""))
        client_user = self._fetch_users_map([client_id]).get(client_id)
        return self._serialize_assignment_detail(row, template, questions, answers, result, therapist=therapist, client_user=client_user)

    def submit_assignment(
        self,
        client_id: str,
        assignment_id: str,
        answers_payload: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        self._ensure_schema_and_seeded()
        row = self._assignment_for_client(client_id, assignment_id)
        if row.get("status") == "completed":
            raise AssessmentValidationError("Assessment has already been submitted")
        if row.get("status") == "cancelled":
            raise AssessmentValidationError("Assessment has been cancelled")

        questions = self._fetch_questions(str(row.get("template_id") or ""))
        if not questions:
            raise AssessmentValidationError("Assessment questions are unavailable")

        answers_by_question_id: Dict[str, int] = {}
        for answer in answers_payload:
            question_id = str(answer.get("question_id") or "").strip()
            answer_value = answer.get("answer_value")
            if not question_id:
                continue
            if not isinstance(answer_value, int) or answer_value < 0 or answer_value > 3:
                raise AssessmentValidationError("Each answer must be a number between 0 and 3")
            answers_by_question_id[question_id] = answer_value

        expected_ids = [str(question.get("id") or "") for question in questions]
        if sorted(expected_ids) != sorted(answers_by_question_id.keys()):
            raise AssessmentValidationError("Please answer every question before submitting")

        answers_by_key = {
            str(question.get("key") or ""): answers_by_question_id[str(question.get("id") or "")]
            for question in questions
        }
        scoring = score_assessment(str(row.get("template_id") or ""), answers_by_key)
        completed_at = self._now()

        answer_rows = [
            {
                "assignment_id": assignment_id,
                "question_id": str(question.get("id") or ""),
                "answer_value": answers_by_question_id[str(question.get("id") or "")],
                "created_at": completed_at,
                "updated_at": completed_at,
            }
            for question in questions
        ]
        snapshot = [
            {
                "question_id": str(question.get("id") or ""),
                "question_key": question.get("key"),
                "prompt": question.get("prompt"),
                "answer_value": answers_by_question_id[str(question.get("id") or "")],
            }
            for question in questions
        ]

        try:
            self.supabase.table(ANSWERS_TABLE).delete().eq("assignment_id", assignment_id).execute()
            self.supabase.table(ANSWERS_TABLE).insert(answer_rows).execute()
            self.supabase.table(RESULTS_TABLE).delete().eq("assignment_id", assignment_id).execute()
            self.supabase.table(RESULTS_TABLE).insert(
                {
                    "assignment_id": assignment_id,
                    "template_id": row.get("template_id"),
                    "therapist_id": row.get("therapist_id"),
                    "client_id": row.get("client_id"),
                    "total_score": scoring["total_score"],
                    "severity": scoring["severity"],
                    "interpretation": scoring["interpretation"],
                    "subscale_scores": scoring["subscale_scores"],
                    "answer_snapshot": snapshot,
                    "completed_at": completed_at,
                    "created_at": completed_at,
                    "updated_at": completed_at,
                }
            ).execute()
            self.supabase.table(ASSIGNMENTS_TABLE).update(
                {
                    "status": "completed",
                    "completed_at": completed_at,
                    "updated_at": completed_at,
                }
            ).eq("id", assignment_id).execute()
        except Exception as exc:
            self._raise_schema_error(exc)
            raise

        return self.get_my_assignment_detail(client_id, assignment_id)


_assessment_service: Optional[AssessmentService] = None


def get_assessment_service() -> AssessmentService:
    global _assessment_service
    if _assessment_service is None:
        _assessment_service = AssessmentService()
    return _assessment_service

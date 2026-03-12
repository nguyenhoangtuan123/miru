import json
import logging
import os
from typing import Any, Dict, List, Optional

from database import DatabaseManager

logger = logging.getLogger(__name__)

try:
    from pywebpush import WebPushException, webpush

    WEB_PUSH_AVAILABLE = True
except ImportError:
    WEB_PUSH_AVAILABLE = False
    WebPushException = Exception  # type: ignore[assignment]
    webpush = None  # type: ignore[assignment]


class PushNotificationService:
    def __init__(self):
        self.vapid_public_key = os.getenv("VAPID_PUBLIC_KEY", "").strip()
        self.vapid_private_key = os.getenv("VAPID_PRIVATE_KEY", "").strip()
        self.vapid_subject = os.getenv("VAPID_CLAIMS_SUBJECT", "mailto:notifications@miru.app").strip()

    def is_enabled(self) -> bool:
        return bool(
            WEB_PUSH_AVAILABLE
            and self.vapid_public_key
            and self.vapid_private_key
            and self.vapid_subject
        )

    def get_public_config(self) -> Dict[str, Any]:
        return {
            "enabled": self.is_enabled(),
            "public_key": self.vapid_public_key if self.is_enabled() else None,
        }

    def _db(self) -> DatabaseManager:
        return DatabaseManager()

    def save_subscription(self, user_id: str, subscription: Dict[str, Any]) -> bool:
        endpoint = str(subscription.get("endpoint") or "").strip()
        keys = subscription.get("keys") or {}
        p256dh = str(keys.get("p256dh") or "").strip()
        auth = str(keys.get("auth") or "").strip()

        if not endpoint or not p256dh or not auth:
            return False

        db = self._db()
        db.get_or_create_user(user_id)
        payload = {
            "user_id": user_id,
            "endpoint": endpoint,
            "p256dh": p256dh,
            "auth": auth,
        }

        try:
            db.supabase.table("push_subscriptions").upsert(payload, on_conflict="endpoint").execute()
            return True
        except Exception as exc:
            logger.warning("Failed to save push subscription for %s: %s", user_id, exc)
            return False

    def remove_subscription(self, user_id: str, endpoint: str) -> bool:
        try:
            self._db().supabase.table("push_subscriptions").delete().eq("user_id", user_id).eq("endpoint", endpoint).execute()
            return True
        except Exception as exc:
            logger.warning("Failed to delete push subscription for %s: %s", user_id, exc)
            return False

    def get_subscriptions(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self._db()
                .supabase.table("push_subscriptions")
                .select("endpoint, p256dh, auth")
                .eq("user_id", user_id)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            logger.warning("Failed to load push subscriptions for %s: %s", user_id, exc)
            return []

    def get_subscribed_user_ids(self) -> List[str]:
        try:
            response = self._db().supabase.table("push_subscriptions").select("user_id").execute()
        except Exception as exc:
            logger.warning("Failed to load subscribed users: %s", exc)
            return []

        user_ids: List[str] = []
        for row in response.data or []:
            user_id = row.get("user_id")
            if isinstance(user_id, str) and user_id not in user_ids:
                user_ids.append(user_id)
        return user_ids

    def _delete_invalid_endpoint(self, endpoint: str):
        try:
            self._db().supabase.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
        except Exception as exc:
            logger.warning("Failed to clean invalid push endpoint %s: %s", endpoint, exc)

    def send_push_to_user(
        self,
        user_id: str,
        title: str,
        body: str,
        url: str = "/",
        tag: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not self.is_enabled():
            return {"success": False, "error": "Web Push is not configured"}

        subscriptions = self.get_subscriptions(user_id)
        if not subscriptions:
            return {"success": False, "error": "No push subscriptions for user"}

        payload = json.dumps(
            {
                "title": title,
                "body": body,
                "tag": tag,
                "url": url,
                "data": extra or {},
            }
        )

        delivered = 0
        failures: List[str] = []

        for row in subscriptions:
            subscription_info = {
                "endpoint": row.get("endpoint"),
                "keys": {
                    "p256dh": row.get("p256dh"),
                    "auth": row.get("auth"),
                },
            }

            try:
                webpush(  # type: ignore[misc]
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=self.vapid_private_key,
                    vapid_claims={"sub": self.vapid_subject},
                )
                delivered += 1
            except WebPushException as exc:  # type: ignore[misc]
                failures.append(str(exc))
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code in {404, 410}:
                    self._delete_invalid_endpoint(str(row.get("endpoint") or ""))
            except Exception as exc:
                failures.append(str(exc))

        return {
            "success": delivered > 0,
            "delivered": delivered,
            "failures": failures,
        }


_push_service: Optional[PushNotificationService] = None


def get_push_service() -> PushNotificationService:
    global _push_service
    if _push_service is None:
        _push_service = PushNotificationService()
    return _push_service

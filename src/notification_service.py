# file: notification_service.py
"""
Notification Service for Miru
Handles email notifications via Resend for crisis alerts and digests
"""

import os
import asyncio
from typing import Optional, Dict, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Try to import resend, gracefully handle if not installed
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logger.warning("Resend not installed. Email notifications disabled. Run: pip install resend")


class NotificationService:
    """
    Centralized notification service for Miru
    Supports: Email (Resend), In-app notifications
    """
    
    def __init__(self):
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("NOTIFICATION_FROM_EMAIL", "Miru <notifications@miru.app>")
        self.app_url = os.getenv("APP_URL", "http://localhost:8000")
        
        if RESEND_AVAILABLE and self.resend_api_key:
            resend.api_key = self.resend_api_key
            self.email_enabled = True
            logger.info("Email notifications enabled via Resend")
        else:
            self.email_enabled = False
            if not self.resend_api_key:
                logger.warning("RESEND_API_KEY not set. Email notifications disabled.")
    
    # === CRISIS ALERTS ===
    
    def send_crisis_alert(
        self,
        therapist_email: str,
        therapist_name: str,
        client_name: str,
        client_id: str,
        crisis_level: str,
        message_snippet: str,
        crisis_id: int
    ) -> bool:
        """
        Send immediate email alert to therapist about client crisis
        
        Args:
            therapist_email: Email of the therapist
            therapist_name: Name of therapist for personalization
            client_name: Name of the client in crisis
            client_id: UUID of client for dashboard link
            crisis_level: 'low', 'medium', 'high'
            message_snippet: Brief excerpt of concerning message
            crisis_id: ID of crisis event for tracking
            
        Returns:
            bool: True if sent successfully
        """
        if not self.email_enabled:
            logger.info(f"[MOCK EMAIL] Crisis alert for {therapist_email}: {client_name} - {crisis_level}")
            return True
        
        subject = self._get_crisis_subject(crisis_level, client_name)
        html_content = self._render_crisis_email(
            therapist_name=therapist_name,
            client_name=client_name,
            client_id=client_id,
            crisis_level=crisis_level,
            message_snippet=message_snippet,
            crisis_id=crisis_id
        )
        
        return self._send_email(
            to=therapist_email,
            subject=subject,
            html=html_content,
            tags=["crisis-alert", f"level-{crisis_level}"]
        )
    
    def _get_crisis_subject(self, level: str, client_name: str) -> str:
        """Generate appropriate subject line based on crisis level"""
        if level == "high":
            return f"[KHAN CAP] Canh bao khung hoang - {client_name}"
        elif level == "medium":
            return f"[CANH BAO] Than chu can chu y - {client_name}"
        else:
            return f"[THONG BAO] Tinh trang than chu - {client_name}"
    
    def _render_crisis_email(
        self,
        therapist_name: str,
        client_name: str,
        client_id: str,
        crisis_level: str,
        message_snippet: str,
        crisis_id: int
    ) -> str:
        """Render HTML email template for crisis alert"""
        
        level_color = {
            "high": "#dc2626",
            "medium": "#f59e0b", 
            "low": "#3b82f6"
        }.get(crisis_level, "#6b7280")
        
        level_text = {
            "high": "CAO - Can hanh dong ngay",
            "medium": "TRUNG BINH - Can theo doi",
            "low": "THAP - Luu y"
        }.get(crisis_level, "KHONG XAC DINH")
        
        dashboard_url = f"{self.app_url}/therapist/client-detail.html?id={client_id}"
        acknowledge_url = f"{self.app_url}/therapist/dashboard.html"
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #7f0df2 0%, #5b21b6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Miru - Canh bao Khung hoang</h1>
    </div>
    
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        
        <p style="font-size: 16px;">Xin chao <strong>{therapist_name}</strong>,</p>
        
        <div style="background: {level_color}15; border-left: 4px solid {level_color}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: {level_color};">
                Muc do: {level_text}
            </p>
            <p style="margin: 0; font-size: 18px; font-weight: 600;">
                Than chu: {client_name}
            </p>
        </div>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 500;">Noi dung dang lo ngai:</p>
            <p style="margin: 0; font-style: italic; color: #374151;">
                "{message_snippet[:200]}{'...' if len(message_snippet) > 200 else ''}"
            </p>
        </div>
        
        <div style="margin: 24px 0;">
            <a href="{dashboard_url}" style="display: inline-block; background: #7f0df2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 12px;">
                Xem ho so than chu
            </a>
            <a href="{acknowledge_url}" style="display: inline-block; background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Mo Dashboard
            </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <p style="font-size: 14px; color: #6b7280; margin: 0;">
            Day la thong bao tu dong tu he thong Miru. Vui long dang nhap de xac nhan da xem va thuc hien hanh dong phu hop.
        </p>
        
    </div>
    
    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Miru - Dong hanh cung suc khoe tam than</p>
        <p style="margin: 4px 0 0 0;">Crisis ID: #{crisis_id}</p>
    </div>
    
</body>
</html>
"""
    
    # === DAILY/WEEKLY DIGEST ===
    
    def send_digest(
        self,
        therapist_email: str,
        therapist_name: str,
        digest_type: str,  # 'daily' or 'weekly'
        stats: Dict,
        highlights: List[Dict]
    ) -> bool:
        """
        Send daily or weekly digest summary to therapist
        
        Args:
            therapist_email: Email of therapist
            therapist_name: Name for personalization
            digest_type: 'daily' or 'weekly'
            stats: Dict with keys like 'new_clients', 'appointments_today', 'pending_assignments', etc.
            highlights: List of notable events/items to highlight
            
        Returns:
            bool: True if sent successfully
        """
        if not self.email_enabled:
            logger.info(f"[MOCK EMAIL] {digest_type} digest for {therapist_email}")
            return True
        
        period = "hom nay" if digest_type == "daily" else "tuan nay"
        subject = f"[Miru] Tong hop {period} - {datetime.now().strftime('%d/%m/%Y')}"
        
        html_content = self._render_digest_email(
            therapist_name=therapist_name,
            digest_type=digest_type,
            stats=stats,
            highlights=highlights
        )
        
        return self._send_email(
            to=therapist_email,
            subject=subject,
            html=html_content,
            tags=[f"{digest_type}-digest"]
        )
    
    def _render_digest_email(
        self,
        therapist_name: str,
        digest_type: str,
        stats: Dict,
        highlights: List[Dict]
    ) -> str:
        """Render HTML email for digest"""
        
        period_text = "Hom nay" if digest_type == "daily" else "Tuan nay"
        
        # Build stats section
        stats_html = ""
        stat_items = [
            ("Cuoc hen", stats.get("appointments", 0), "#7f0df2"),
            ("Than chu moi", stats.get("new_clients", 0), "#10b981"),
            ("Bai tap cho", stats.get("pending_assignments", 0), "#f59e0b"),
            ("Canh bao", stats.get("crisis_alerts", 0), "#dc2626"),
        ]
        
        for label, value, color in stat_items:
            stats_html += f"""
            <div style="text-align: center; padding: 16px;">
                <div style="font-size: 32px; font-weight: 700; color: {color};">{value}</div>
                <div style="font-size: 14px; color: #6b7280;">{label}</div>
            </div>
            """
        
        # Build highlights section
        highlights_html = ""
        if highlights:
            for item in highlights[:5]:
                highlights_html += f"""
                <div style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
                    <span style="font-weight: 500;">{item.get('title', '')}</span>
                    <span style="color: #6b7280; font-size: 14px;"> - {item.get('description', '')}</span>
                </div>
                """
        else:
            highlights_html = '<p style="color: #6b7280; text-align: center; padding: 16px;">Khong co su kien noi bat</p>'
        
        dashboard_url = f"{self.app_url}/therapist/dashboard.html"
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #7f0df2 0%, #5b21b6 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Miru - Tong hop {period_text.lower()}</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">{datetime.now().strftime('%d/%m/%Y')}</p>
    </div>
    
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        
        <p style="font-size: 16px;">Xin chao <strong>{therapist_name}</strong>,</p>
        <p>Day la tong hop hoat dong cua ban {period_text.lower()}:</p>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f9fafb; border-radius: 12px; margin: 20px 0;">
            {stats_html}
        </div>
        
        <h3 style="margin: 24px 0 12px 0; font-size: 16px;">Diem noi bat</h3>
        <div style="background: #f9fafb; border-radius: 8px; overflow: hidden;">
            {highlights_html}
        </div>
        
        <div style="margin: 24px 0; text-align: center;">
            <a href="{dashboard_url}" style="display: inline-block; background: #7f0df2; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Mo Dashboard
            </a>
        </div>
        
    </div>
    
    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">Miru - Dong hanh cung suc khoe tam than</p>
    </div>
    
</body>
</html>
"""
    
    # === CORE EMAIL SENDING ===
    
    def _send_email(
        self,
        to: str,
        subject: str,
        html: str,
        tags: List[str] = None
    ) -> bool:
        """
        Core email sending via Resend
        
        Args:
            to: Recipient email
            subject: Email subject
            html: HTML content
            tags: Optional tags for tracking
            
        Returns:
            bool: True if sent successfully
        """
        if not self.email_enabled:
            return False
        
        try:
            params = {
                "from": self.from_email,
                "to": [to],
                "subject": subject,
                "html": html
            }
            if tags:
                params["tags"] = [{"name": tag, "value": "true"} for tag in tags]
            
            response = resend.Emails.send(params)
            logger.info(f"Email sent successfully to {to}: {response.get('id', 'unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {str(e)}")
            return False
    
    # === IN-APP NOTIFICATIONS (future) ===
    
    def create_in_app_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        data: Dict = None
    ) -> Dict:
        """
        Create in-app notification (stored in database)
        Future: Can be extended for push notifications
        
        Returns:
            Dict with notification details
        """
        # TODO: Implement database storage for in-app notifications
        # For now, just log
        logger.info(f"[IN-APP] {user_id}: {notification_type} - {title}")
        return {
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "data": data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False
        }


# Singleton instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get or create the notification service singleton"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service

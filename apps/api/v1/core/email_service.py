"""SMTP email delivery for digests and transactional mail."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from v1.core.config import settings

logger = logging.getLogger(__name__)


def is_email_configured() -> bool:
    return bool(
        settings.email_enabled
        and settings.smtp_host
        and settings.smtp_from_email
    )


def send_email(*, to_email: str, subject: str, body_text: str, body_html: str | None = None) -> None:
    if not is_email_configured():
        raise RuntimeError("Email is not configured on the server")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)

    logger.info("Email sent to %s — %s", to_email, subject)


def build_digest_email(*, member_name: str, items: list[dict]) -> tuple[str, str, str]:
    subject = f"OSAJA'20 Welfare — your weekly digest"
    lines = [f"Hello {member_name},", "", "Here's your activity summary:", ""]
    for item in items:
        lines.append(f"• [{item['type']}] {item['title']}")
        lines.append(f"  {item['message'][:200]}")
        lines.append("")

    lines.extend(["—", "OSAJA'20 Welfare Platform"])
    body_text = "\n".join(lines)

    html_items = "".join(
        f"<li><strong>{item['title']}</strong><br/><span style='color:#475569'>{item['message'][:200]}</span></li>"
        for item in items
    )
    body_html = f"""
    <html><body style="font-family:system-ui,sans-serif;color:#0a2d6e">
      <p>Hello {member_name},</p>
      <p>Here's your activity summary:</p>
      <ul>{html_items}</ul>
      <p style="color:#64748b;font-size:12px">OSAJA'20 Welfare Platform</p>
    </body></html>
  """
    return subject, body_text, body_html

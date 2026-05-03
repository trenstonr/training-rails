import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import make_msgid

from fastapi import HTTPException


@dataclass
class SMSResult:
    message_id: str
    status: str
    to: str


def send_sms(body: str, to: str | None = None) -> SMSResult:
    recipient = to or os.getenv("SMS_GATEWAY_TO")
    if not recipient:
        raise HTTPException(
            status_code=400,
            detail="Set SMS_GATEWAY_TO to the operator carrier gateway email address",
        )

    message = build_gateway_message(body, recipient)
    send_gateway_email(message)

    return SMSResult(
        message_id=message["Message-ID"] or "",
        status="sent_to_gateway",
        to=recipient,
    )


def build_gateway_message(body: str, recipient: str) -> EmailMessage:
    sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USERNAME")
    if not sender:
        raise HTTPException(
            status_code=500,
            detail="Missing SMTP_FROM or SMTP_USERNAME",
        )

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Message-ID"] = make_msgid()
    message["Subject"] = os.getenv("SMS_GATEWAY_SUBJECT", "URGENT RAIL ALERT")
    message.set_content(body)
    return message


def send_gateway_email(message: EmailMessage) -> None:
    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    if not host or not username or not password:
        raise HTTPException(
            status_code=500,
            detail="Missing SMTP_HOST, SMTP_USERNAME, or SMTP_PASSWORD",
        )

    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"SMS gateway email failed: {exc}",
        ) from exc

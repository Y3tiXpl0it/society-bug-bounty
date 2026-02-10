# backend/app/src/notifications/email.py
from pathlib import Path
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from app.core.config import settings

# Define the base directory for templates
# Assuming backend/app/templates/email
TEMPLATE_FOLDER = Path(__file__).resolve().parent.parent.parent / "templates" / "email"

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
    TEMPLATE_FOLDER=TEMPLATE_FOLDER
)

async def send_email(email_to: str, subject: str, template_name: str, template_body: dict):
    """
    Sends an email using FastMail with a Jinja2 template.
    """
    message = MessageSchema(
        subject=subject,
        recipients=[email_to],
        template_body=template_body,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message, template_name=template_name)

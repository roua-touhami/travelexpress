import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import Application, Message

import cloudinary
import cloudinary.uploader
from app.config import settings

cloudinary.config(
    cloud_name = settings.CLOUDINARY_CLOUD_NAME,
    api_key    = settings.CLOUDINARY_API_KEY,
    api_secret = settings.CLOUDINARY_API_SECRET,
)

logger = logging.getLogger(__name__)

UPLOAD_DIR = settings.UPLOAD_DIR
MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content:   Optional[str] = None
    image_url: Optional[str] = None


class MessageResponse(BaseModel):
    id:             int
    content:        Optional[str]
    image_url:      Optional[str]
    created_at:     datetime
    application_id: int
    sender_id:      int
    sender_name:    str
    is_read:        bool
    model_config = {"from_attributes": True}


class ChatSummary(BaseModel):
    application_id:  int
    other_user_id:   int
    other_user_name: str
    product_name:    str
    departure_city:  str
    arrival_city:    str
    last_message:    Optional[str]
    last_message_at: datetime
    unread_count:    int


# ─── Helpers ──────────────────────────────────────────────────────────────────

def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_chat_participants(app: Application):
    return app.post.user_id, app.applicant_id


def _assert_participant(app: Application, user_id: int):
    traveler_id, applicant_id = _get_chat_participants(app)
    if user_id not in (traveler_id, applicant_id):
        raise HTTPException(status_code=403, detail="Not allowed")


# ─── Business logic ───────────────────────────────────────────────────────────

def get_messages(db: Session, token: str, app_id: int) -> list[MessageResponse]:
    user = get_current_user(db, token)
    app  = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "accepted":
        raise HTTPException(status_code=403, detail="Chat only available for accepted applications")
    _assert_participant(app, user.id)

    messages = (
        db.query(Message)
        .filter(Message.application_id == app_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return [
        MessageResponse(
            id             = m.id,
            content        = m.content,
            image_url      = m.image_url,
            created_at     = m.created_at,
            application_id = m.application_id,
            sender_id      = m.sender_id,
            sender_name    = m.sender.full_name,
            is_read        = m.is_read,
        )
        for m in messages
    ]


def send_message(db: Session, token: str, app_id: int, data: MessageCreate) -> MessageResponse:
    user = get_current_user(db, token)
    app  = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "accepted":
        raise HTTPException(status_code=403, detail="Chat only available for accepted applications")
    _assert_participant(app, user.id)

    if not data.content and not data.image_url:
        raise HTTPException(status_code=400, detail="Message must have content or image")

    msg = Message(
        content        = data.content,
        image_url      = data.image_url,
        created_at     = now_utc(),
        application_id = app_id,
        sender_id      = user.id,
        is_read        = False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    logger.info(f"Message sent by user {user.id} in chat {app_id}")
    return MessageResponse(
        id             = msg.id,
        content        = msg.content,
        image_url      = msg.image_url,
        created_at     = msg.created_at,
        application_id = msg.application_id,
        sender_id      = msg.sender_id,
        sender_name    = msg.sender.full_name,
        is_read        = msg.is_read,
    )


def mark_as_read(db: Session, token: str, app_id: int) -> dict:
    """Mark all messages NOT sent by current user as read."""
    user = get_current_user(db, token)
    app  = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _assert_participant(app, user.id)

    updated = (
        db.query(Message)
        .filter(
            Message.application_id == app_id,
            Message.sender_id != user.id,
            Message.is_read == False,
        )
        .all()
    )

    for msg in updated:
        msg.is_read = True

    db.commit()
    logger.info(f"Marked {len(updated)} messages as read for user {user.id} in chat {app_id}")
    return {"marked": len(updated)}


def get_my_chats(db: Session, token: str) -> list[ChatSummary]:
    """Return all accepted chats for the current user with unread count."""
    user = get_current_user(db, token)

    # ── FIXED: was missing comma → SyntaxWarning + broken query ──────────────
    apps = (
        db.query(Application)
        .filter(
            Application.status == "accepted",
            (Application.post.has(user_id=user.id)) |
            (Application.applicant_id == user.id),
        )
        .all()
    )

    result = []
    for app in apps:
        traveler_id  = app.post.user_id
        applicant_id = app.applicant_id

        if user.id not in (traveler_id, applicant_id):
            continue

        other_id   = applicant_id if user.id == traveler_id else traveler_id
        other_user = app.applicant if user.id == traveler_id else app.post.user

        messages = sorted(app.messages, key=lambda m: m.created_at)

        if not messages:
            last_msg    = None
            last_msg_at = app.post.created_at
        else:
            last        = messages[-1]
            last_msg    = last.content or "📷 Image"
            last_msg_at = last.created_at

        unread_count = sum(
            1 for m in messages
            if m.sender_id != user.id and not m.is_read
        )

        result.append(ChatSummary(
            application_id  = app.id,
            other_user_id   = other_id,
            other_user_name = other_user.full_name,
            product_name    = app.product_name,
            departure_city  = app.post.departure_city,
            arrival_city    = app.post.arrival_city,
            last_message    = last_msg,
            last_message_at = last_msg_at,
            unread_count    = unread_count,
        ))

    result.sort(key=lambda c: c.last_message_at, reverse=True)
    return result


async def upload_image(db: Session, token: str, app_id: int, file: UploadFile) -> dict:
    user = get_current_user(db, token)
    app  = db.query(Application).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _assert_participant(app, user.id)

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large (max {settings.MAX_UPLOAD_SIZE_MB}MB)")

    # Upload vers Cloudinary
    result = cloudinary.uploader.upload(
        contents,
        folder="travelexpress",
        resource_type="image"
    )

    logger.info(f"Image uploaded by user {user.id} in chat {app_id}")
    return {"image_url": result["secure_url"]}
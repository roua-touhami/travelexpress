import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import Application

logger = logging.getLogger(__name__)


# ─── Schema ───────────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id:               int
    type:             str        # "new_request" | "request_accepted" | "request_rejected"
    is_read:          bool
    created_at:       datetime
    application_id:   int
    product_name:     str
    product_category: str
    product_url:      Optional[str]
    product_desc:     str
    status:           str
    response_message: Optional[str]
    applicant_id:     int
    applicant_name:   str
    post_id:          int
    departure_city:   str
    arrival_city:     str
    departure_date:   str
    arrival_date:     str

    model_config = {"from_attributes": True}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build(app: Application, notif_type: str, is_read: bool) -> NotificationResponse:
    return NotificationResponse(
        id               = app.id,
        type             = notif_type,
        is_read          = is_read,
        created_at       = app.created_at,
        application_id   = app.id,
        product_name     = app.product_name,
        product_category = app.product_category,
        product_url      = app.product_url,
        product_desc     = app.product_desc,
        status           = app.status,
        response_message = app.response_message,
        applicant_id     = app.applicant_id,
        applicant_name   = app.applicant.full_name,
        post_id          = app.post_id,
        departure_city   = app.post.departure_city,
        arrival_city     = app.post.arrival_city,
        departure_date   = str(app.post.departure_date),
        arrival_date     = str(app.post.arrival_date),
    )


# ─── Business logic ───────────────────────────────────────────────────────────

def get_notifications(db: Session, token: str) -> list[NotificationResponse]:
    user = get_current_user(db, token)
    result: list[NotificationResponse] = []

    # 1. Requests received on the user's posts (traveler view)
    post_ids = [p.id for p in user.posts]
    if post_ids:
        received = (
            db.query(Application)
            .filter(Application.post_id.in_(post_ids))
            .order_by(Application.created_at.desc())
            .all()
        )
        for app in received:
            # Unread = still pending (traveler hasn't responded yet)
            is_read = app.status != "pending"
            result.append(_build(app, "new_request", is_read))

    # 2. The user's own applications that have been responded to (applicant view)
    my_apps = (
        db.query(Application)
        .filter(
            Application.applicant_id == user.id,
            Application.status.in_(["accepted", "rejected"]),
        )
        .order_by(Application.created_at.desc())
        .all()
    )
    for app in my_apps:
        notif_type = "request_accepted" if app.status == "accepted" else "request_rejected"
        # is_read = True once the applicant has opened the notification panel
        result.append(_build(app, notif_type, app.notif_read_by_applicant))

    result.sort(key=lambda n: n.created_at, reverse=True)
    logger.info(f"Fetched {len(result)} notifications for user {user.id}")

    # Mark all applicant notifications as read now that the user fetched them
    if my_apps:
        for app in my_apps:
            if not app.notif_read_by_applicant:
                app.notif_read_by_applicant = True
        db.commit()

    return result


def get_notification_count(db: Session, token: str) -> dict:
    user = get_current_user(db, token)

    # 1. Pending requests on the user's own posts (traveler view)
    post_ids = [p.id for p in user.posts]
    pending = 0
    if post_ids:
        pending = (
            db.query(Application)
            .filter(
                Application.post_id.in_(post_ids),
                Application.status == "pending",
            )
            .count()
        )

    # 2. Responses not yet seen by the applicant
    my_updates = (
        db.query(Application)
        .filter(
            Application.applicant_id == user.id,
            Application.status.in_(["accepted", "rejected"]),
            Application.notif_read_by_applicant == False,  # ← only unread
        )
        .count()
    )

    return {"count": pending + my_updates}
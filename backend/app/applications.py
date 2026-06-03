import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import Application, Post

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {"Electronics", "Clothes", "Cosmetics", "Other"}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class ApplicationCreate(BaseModel):
    product_name:     str
    product_url:      Optional[str] = None
    product_category: str
    product_desc:     str


class ApplicationResponse(BaseModel):
    id:               int
    product_name:     str
    product_url:      Optional[str]
    product_category: str
    product_desc:     str
    status:           str
    response_message: Optional[str]
    created_at:       datetime
    post_id:          int
    applicant_id:     int
    applicant_name:   str
    model_config = {"from_attributes": True}


class RespondApplication(BaseModel):
    status:           str   # "accepted" | "rejected"
    response_message: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def app_to_response(app: Application) -> ApplicationResponse:
    return ApplicationResponse(
        id               = app.id,
        product_name     = app.product_name,
        product_url      = app.product_url,
        product_category = app.product_category,
        product_desc     = app.product_desc,
        status           = app.status,
        response_message = app.response_message,
        created_at       = app.created_at,
        post_id          = app.post_id,
        applicant_id     = app.applicant_id,
        applicant_name   = app.applicant.full_name,
    )


# ─── Business logic ───────────────────────────────────────────────────────────

def apply_to_post(
    db: Session, token: str, post_id: int, data: ApplicationCreate
) -> ApplicationResponse:
    user = get_current_user(db, token)

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot apply to your own post")
    if data.product_category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Valid: {', '.join(VALID_CATEGORIES)}"
        )

    # Prevent duplicate pending applications
    existing = db.query(Application).filter(
        Application.post_id == post_id,
        Application.applicant_id == user.id,
        Application.status == "pending",
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending application for this post"
        )

    application = Application(
        product_name            = data.product_name,
        product_url             = data.product_url,
        product_category        = data.product_category,
        product_desc            = data.product_desc,
        status                  = "pending",
        response_message        = None,
        created_at              = now_utc(),
        post_id                 = post_id,
        applicant_id            = user.id,
        notif_read_by_applicant = False,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    logger.info(f"Application created by user {user.id} for post {post_id}")
    return app_to_response(application)


def get_post_applications(
    db: Session, token: str, post_id: int
) -> list[ApplicationResponse]:
    """Le créateur du post voit toutes les demandes."""
    user = get_current_user(db, token)
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    apps = (
        db.query(Application)
        .filter(Application.post_id == post_id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [app_to_response(a) for a in apps]


def get_my_applications(db: Session, token: str) -> list[ApplicationResponse]:
    """L'applicant voit ses propres demandes."""
    user = get_current_user(db, token)
    apps = (
        db.query(Application)
        .filter(Application.applicant_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [app_to_response(a) for a in apps]


def get_pending_applications_count(db: Session, token: str) -> int:
    """Nombre de demandes en attente pour tous les posts du créateur."""
    user = get_current_user(db, token)
    post_ids = [p.id for p in user.posts]
    if not post_ids:
        return 0
    return (
        db.query(Application)
        .filter(
            Application.post_id.in_(post_ids),
            Application.status == "pending",
        )
        .count()
    )


def respond_to_application(
    db: Session, token: str, app_id: int, data: RespondApplication
) -> ApplicationResponse:
    user = get_current_user(db, token)

    if data.status not in ("accepted", "rejected"):
        raise HTTPException(
            status_code=400, detail="Status must be 'accepted' or 'rejected'"
        )

    application = db.query(Application).filter(Application.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if application.status != "pending":
        raise HTTPException(
            status_code=400, detail="This application has already been responded to"
        )

    application.status                  = data.status
    application.response_message        = data.response_message
    # ── Reset so the applicant sees the badge again ────────────────────────
    application.notif_read_by_applicant = False

    db.commit()
    db.refresh(application)
    logger.info(f"Application {app_id} {data.status} by user {user.id}")
    return app_to_response(application)
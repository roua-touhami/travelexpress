import logging
import os
from datetime import date
from typing import Optional

from fastapi import FastAPI, Depends, Request, Header, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, RefreshRequest,
    UpdateProfileRequest, VerifyRegistrationRequest,
    register, login, forgot_password, reset_password,
    refresh_access_token, logout, update_profile, get_profile,
    verify_registration,
)
from app.posts import (
    PostCreate, PostUpdate, PostResponse, PublicUserResponse,
    create_post, get_my_posts, get_all_posts,
    delete_post, update_post, get_user_profile,
)
from app.applications import (
    ApplicationCreate, ApplicationResponse, RespondApplication,
    apply_to_post, get_post_applications, get_my_applications,
    respond_to_application, get_pending_applications_count,
)
from app.chat import (
    MessageCreate, MessageResponse, ChatSummary,
    get_messages, send_message, mark_as_read,
    get_my_chats, upload_image,
)
from app.notifications import (
    NotificationResponse,
    get_notifications,
    get_notification_count,
)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# ─── DB init ──────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ─── App + rate limiter ───────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="TravelExpress API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS — origins read from .env ────────────────────────────────────────────
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# ─── Static uploads ───────────────────────────────────────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ─── Helper ───────────────────────────────────────────────────────────────────
def extract_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    return authorization.split(" ")[1]


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/auth/register", status_code=202)
@limiter.limit("5/minute")
async def register_route(
    request: Request, data: RegisterRequest, db: Session = Depends(get_db)
):
    return await register(db, data)


@app.post("/auth/verify-registration", response_model=UserResponse, status_code=201)
@limiter.limit("10/minute")
def verify_registration_route(
    request: Request, data: VerifyRegistrationRequest, db: Session = Depends(get_db)
):
    return verify_registration(db, data)


@app.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login_route(
    request: Request, data: LoginRequest, db: Session = Depends(get_db)
):
    return login(db, data)


@app.post("/auth/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
def refresh_route(
    request: Request, data: RefreshRequest, db: Session = Depends(get_db)
):
    return refresh_access_token(db, data)


@app.post("/auth/logout")
@limiter.limit("10/minute")
def logout_route(
    request: Request, data: RefreshRequest, db: Session = Depends(get_db)
):
    return logout(db, data)


@app.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password_route(
    request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)
):
    return await forgot_password(db, data)


@app.post("/auth/reset-password")
@limiter.limit("5/minute")
def reset_password_route(
    request: Request, data: ResetPasswordRequest, db: Session = Depends(get_db)
):
    return reset_password(db, data)


@app.get("/auth/me", response_model=UserResponse)
@limiter.limit("30/minute")
def get_profile_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_profile(db, extract_token(authorization))


@app.put("/auth/me", response_model=UserResponse)
@limiter.limit("10/minute")
def update_profile_route(
    request: Request,
    data: UpdateProfileRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return update_profile(db, extract_token(authorization), data)


# ─── Posts ────────────────────────────────────────────────────────────────────
@app.post("/posts", response_model=PostResponse, status_code=201)
@limiter.limit("10/minute")
def create_post_route(
    request: Request,
    data: PostCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return create_post(db, extract_token(authorization), data)


@app.get("/posts", response_model=list[PostResponse])
@limiter.limit("30/minute")
def get_all_posts_route(
    request: Request,
    departure_city: Optional[str] = None,
    arrival_city:   Optional[str] = None,
    departure_date: Optional[date] = None,
    arrival_date:   Optional[date] = None,
    db: Session = Depends(get_db),
):
    return get_all_posts(db, departure_city, arrival_city, departure_date, arrival_date)


@app.get("/posts/me", response_model=list[PostResponse])
@limiter.limit("30/minute")
def get_my_posts_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_my_posts(db, extract_token(authorization))


@app.put("/posts/{post_id}", response_model=PostResponse)
@limiter.limit("10/minute")
def update_post_route(
    request: Request,
    post_id: int,
    data: PostUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return update_post(db, extract_token(authorization), post_id, data)


@app.delete("/posts/{post_id}")
@limiter.limit("10/minute")
def delete_post_route(
    request: Request,
    post_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return delete_post(db, extract_token(authorization), post_id)


@app.get("/users/{user_id}", response_model=PublicUserResponse)
@limiter.limit("30/minute")
def get_user_profile_route(
    request: Request, user_id: int, db: Session = Depends(get_db)
):
    return get_user_profile(db, user_id)


# ─── Applications ─────────────────────────────────────────────────────────────
@app.post("/posts/{post_id}/apply", response_model=ApplicationResponse, status_code=201)
@limiter.limit("10/minute")
def apply_route(
    request: Request,
    post_id: int,
    data: ApplicationCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return apply_to_post(db, extract_token(authorization), post_id, data)


@app.get("/posts/{post_id}/applications", response_model=list[ApplicationResponse])
@limiter.limit("30/minute")
def get_applications_route(
    request: Request,
    post_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_post_applications(db, extract_token(authorization), post_id)


@app.get("/applications/me", response_model=list[ApplicationResponse])
@limiter.limit("30/minute")
def get_my_applications_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_my_applications(db, extract_token(authorization))


@app.get("/applications/pending-count")
@limiter.limit("30/minute")
def pending_count_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return {"count": get_pending_applications_count(db, extract_token(authorization))}


@app.put("/applications/{app_id}/respond", response_model=ApplicationResponse)
@limiter.limit("10/minute")
def respond_route(
    request: Request,
    app_id: int,
    data: RespondApplication,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return respond_to_application(db, extract_token(authorization), app_id, data)


# ─── Notifications ────────────────────────────────────────────────────────────
@app.get("/notifications", response_model=list[NotificationResponse])
@limiter.limit("30/minute")
def get_notifications_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_notifications(db, extract_token(authorization))


@app.get("/notifications/count")
@limiter.limit("30/minute")
def get_notification_count_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_notification_count(db, extract_token(authorization))


# ─── Chat ─────────────────────────────────────────────────────────────────────
@app.get("/chat/{app_id}/messages", response_model=list[MessageResponse])
@limiter.limit("60/minute")
def get_messages_route(
    request: Request,
    app_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_messages(db, extract_token(authorization), app_id)


@app.post("/chat/{app_id}/messages", response_model=MessageResponse, status_code=201)
@limiter.limit("30/minute")
def send_message_route(
    request: Request,
    app_id: int,
    data: MessageCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return send_message(db, extract_token(authorization), app_id, data)


@app.post("/chat/{app_id}/read")
@limiter.limit("60/minute")
def mark_as_read_route(
    request: Request,
    app_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return mark_as_read(db, extract_token(authorization), app_id)


@app.get("/chats", response_model=list[ChatSummary])
@limiter.limit("30/minute")
def get_my_chats_route(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return get_my_chats(db, extract_token(authorization))


@app.post("/chat/{app_id}/upload")
@limiter.limit("10/minute")
async def upload_image_route(
    request: Request,
    app_id: int,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    return await upload_image(db, extract_token(authorization), app_id, file)


# ─── Debug (désactiver en production) ─────────────────────────────────────────
@app.get("/debug/tables")
def debug_tables():
    from sqlalchemy import inspect
    inspector = inspect(engine)
    return {"tables": inspector.get_table_names()}
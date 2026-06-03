import hashlib
import logging
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.database import User, RefreshToken, PendingRegistration

logger = logging.getLogger(__name__)

# --- Mail config ---
mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

# --- Schemas ---
class RegisterRequest(BaseModel):
    email:     EmailStr
    full_name: str
    password:  str

class VerifyRegistrationRequest(BaseModel):
    email: EmailStr
    code:  str          # 6-digit code entered by user

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id:        int
    email:     str
    full_name: str
    model_config = {"from_attributes": True}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email:     Optional[EmailStr] = None
    password:  Optional[str] = None

# --- Utilitaires ---
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def hash_password(plain: str) -> str:
    return pwd.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd.verify(plain, hashed)

def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain an uppercase letter")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain a digit")

def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": now_utc() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(db: Session, user_id: int) -> str:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.expires_at < now_utc()
    ).delete()

    token = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    refresh_token = RefreshToken(
        token_hash = token_hash,
        user_id    = user_id,
        expires_at = now_utc() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        created_at = now_utc()
    )
    db.add(refresh_token)
    db.commit()
    return token

def verify_refresh_token(db: Session, token: str) -> User:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()

    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if db_token.expires_at < now_utc():
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired, please login again")

    return db_token.user

def get_current_user(db: Session, token: str) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# --- Logique métier ---

async def register(db: Session, data: RegisterRequest):
    """
    Step 1 — validate data, check duplicates, send 6-digit verification code.
    Does NOT create the user yet.
    """
    validate_password(data.password)

    # Check if email already used by a confirmed user
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    # Generate 6-digit code
    code       = f"{random.randint(0, 999999):06d}"
    code_hash  = hashlib.sha256(code.encode()).hexdigest()
    expires_at = now_utc() + timedelta(minutes=15)

    # Upsert pending registration (replace if same email retries)
    pending = db.query(PendingRegistration).filter(
        PendingRegistration.email == data.email
    ).first()

    if pending:
        pending.full_name     = data.full_name
        pending.password_hash = hash_password(data.password)
        pending.code_hash     = code_hash
        pending.expires_at    = expires_at
        pending.created_at    = now_utc()
    else:
        pending = PendingRegistration(
            email         = data.email,
            full_name     = data.full_name,
            password_hash = hash_password(data.password),
            code_hash     = code_hash,
            expires_at    = expires_at,
            created_at    = now_utc(),
        )
        db.add(pending)

    db.commit()

    # Send verification email
    message = MessageSchema(
        subject="TravelExpress — Verify your email",
        recipients=[data.email],
        body=f"""
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:auto;padding:32px;background:#f0f4f8;border-radius:12px;">
          <h2 style="color:#1a56db;margin-bottom:8px;">✈ TravelExpress</h2>
          <h3 style="color:#111;margin-bottom:16px;">Verify your email address</h3>
          <p style="color:#374151;">Hello <strong>{data.full_name}</strong>,</p>
          <p style="color:#374151;">Use the code below to complete your registration. It expires in <strong>15 minutes</strong>.</p>
          <div style="text-align:center;margin:28px 0;">
            <span style="
              display:inline-block;
              font-size:36px;
              font-weight:700;
              letter-spacing:10px;
              color:#1a56db;
              background:#fff;
              padding:16px 32px;
              border-radius:12px;
              border:2px solid #bfdbfe;
            ">{code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;">If you did not request this, please ignore this email.</p>
        </div>
        """,
        subtype="html"
    )

    fm = FastMail(mail_config)
    await fm.send_message(message)
    logger.info(f"Verification code sent to {data.email}")

    return {"message": "Verification code sent to your email. Please check your inbox."}


def verify_registration(db: Session, data: VerifyRegistrationRequest) -> User:
    """
    Step 2 — verify the code and create the user account.
    """
    # Clean up expired entries first
    db.query(PendingRegistration).filter(
        PendingRegistration.expires_at < now_utc()
    ).delete()
    db.commit()

    pending = db.query(PendingRegistration).filter(
        PendingRegistration.email == data.email
    ).first()

    if not pending:
        raise HTTPException(
            status_code=400,
            detail="No pending registration found for this email. Please register again."
        )

    code_hash = hashlib.sha256(data.code.encode()).hexdigest()
    if pending.code_hash != code_hash:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # Create the actual user
    user = User(
        email         = pending.email,
        full_name     = pending.full_name,
        password_hash = pending.password_hash,
    )
    db.add(user)

    # Remove the pending entry
    db.delete(pending)
    db.commit()
    db.refresh(user)

    logger.info(f"User verified and created: {user.email}")
    return user


def login(db: Session, data: LoginRequest) -> dict:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token  = create_access_token(user.id)
    refresh_token = create_refresh_token(db, user.id)

    logger.info(f"User logged in: {user.email}")
    return {
        "access_token":  access_token,
        "refresh_token": refresh_token
    }

def refresh_access_token(db: Session, data: RefreshRequest) -> dict:
    user = verify_refresh_token(db, data.refresh_token)
    access_token = create_access_token(user.id)
    logger.info(f"Access token refreshed for user: {user.email}")
    return {"access_token": access_token, "refresh_token": data.refresh_token}

def logout(db: Session, data: RefreshRequest):
    token_hash = hashlib.sha256(data.refresh_token.encode()).hexdigest()
    db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).delete()
    db.commit()
    logger.info("User logged out")
    return {"message": "Logged out successfully"}

async def forgot_password(db: Session, data: ForgotPasswordRequest):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        return {"message": "If this email exists, a reset link has been sent"}

    token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(token.encode()).hexdigest()
    user.reset_token = hashed_token
    user.reset_token_expiry = now_utc() + timedelta(hours=1)
    db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    message = MessageSchema(
        subject="TravelExpress — Reset your password",
        recipients=[user.email],
        body=f"""
        <h2>Password Reset</h2>
        <p>Hello {user.full_name},</p>
        <p>Click the link below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="{reset_link}" style="
            display:inline-block;
            padding:12px 24px;
            background:#1a56db;
            color:#fff;
            border-radius:8px;
            text-decoration:none;
            font-weight:600;
        ">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
        """,
        subtype="html"
    )

    fm = FastMail(mail_config)
    await fm.send_message(message)
    logger.info(f"Password reset email sent to {user.email}")

    return {"message": "If this email exists, a reset link has been sent"}

def reset_password(db: Session, data: ResetPasswordRequest):
    validate_password(data.new_password)
    hashed_token = hashlib.sha256(data.token.encode()).hexdigest()
    user = db.query(User).filter(User.reset_token == hashed_token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.reset_token_expiry < now_utc():
        raise HTTPException(status_code=400, detail="Token has expired")

    user.password_hash      = hash_password(data.new_password)
    user.reset_token        = None
    user.reset_token_expiry = None
    db.commit()
    logger.info(f"Password reset successful for user {user.id}")

    return {"message": "Password reset successfully"}

def get_profile(db: Session, token: str) -> User:
    return get_current_user(db, token)

def update_profile(db: Session, token: str, data: UpdateProfileRequest) -> User:
    user = get_current_user(db, token)

    if data.email and data.email != user.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = data.email

    if data.full_name:
        user.full_name = data.full_name

    if data.password:
        validate_password(data.password)
        user.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(user)
    logger.info(f"Profile updated for user {user.id}")
    return user
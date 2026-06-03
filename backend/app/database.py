from sqlalchemy import (
    create_engine, Column, Integer, String,
    Boolean, DateTime, ForeignKey, Date, Text
)
from sqlalchemy.orm import sessionmaker, DeclarativeBase, relationship
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id                 = Column(Integer, primary_key=True, index=True)
    email              = Column(String, unique=True, index=True)
    full_name          = Column(String)
    password_hash      = Column(String)
    is_active          = Column(Boolean, default=True)
    reset_token        = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    posts          = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    applications   = relationship(
        "Application", back_populates="applicant",
        foreign_keys="Application.applicant_id", cascade="all, delete-orphan"
    )
    sent_messages  = relationship(
        "Message", back_populates="sender",
        foreign_keys="Message.sender_id", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, unique=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")


class Post(Base):
    __tablename__ = "posts"

    id             = Column(Integer, primary_key=True, index=True)
    departure_city = Column(String, nullable=False)
    arrival_city   = Column(String, nullable=False)
    departure_date = Column(Date, nullable=False)
    arrival_date   = Column(Date, nullable=False)
    created_at     = Column(DateTime, nullable=False)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)

    user         = relationship("User", back_populates="posts")
    applications = relationship("Application", back_populates="post", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"

    id               = Column(Integer, primary_key=True, index=True)
    product_name     = Column(String, nullable=False)
    product_url      = Column(String, nullable=True)
    product_category = Column(String, nullable=False)
    product_desc     = Column(Text, nullable=False)
    status           = Column(String, default="pending")
    response_message = Column(Text, nullable=True)
    created_at       = Column(DateTime, nullable=False)

    # ── Notification read-tracking ──────────────────────────────────────────
    # True once the applicant has seen the accepted/rejected response
    notif_read_by_applicant = Column(Boolean, default=False, nullable=False)

    post_id      = Column(Integer, ForeignKey("posts.id"), nullable=False)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    post      = relationship("Post", back_populates="applications")
    applicant = relationship(
        "User", back_populates="applications", foreign_keys=[applicant_id]
    )
    messages  = relationship("Message", back_populates="application", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id             = Column(Integer, primary_key=True, index=True)
    content        = Column(Text, nullable=True)
    image_url      = Column(String, nullable=True)
    created_at     = Column(DateTime, nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    sender_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_read        = Column(Boolean, default=False, nullable=False)

    application = relationship("Application", back_populates="messages")
    sender      = relationship(
        "User", back_populates="sent_messages", foreign_keys=[sender_id]
    )


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    full_name     = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    code_hash     = Column(String, nullable=False)
    expires_at    = Column(DateTime, nullable=False)
    created_at    = Column(DateTime, nullable=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
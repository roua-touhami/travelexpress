import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth import get_current_user
from app.database import Post, User

logger = logging.getLogger(__name__)

# --- Schemas ---
class PostCreate(BaseModel):
    departure_city: str
    arrival_city:   str
    departure_date: date
    arrival_date:   date

class PostUpdate(BaseModel):
    departure_city: Optional[str] = None
    arrival_city:   Optional[str] = None
    departure_date: Optional[date] = None
    arrival_date:   Optional[date] = None

class PostResponse(BaseModel):
    id:             int
    departure_city: str
    arrival_city:   str
    departure_date: date
    arrival_date:   date
    created_at:     datetime
    user_id:        int
    user_full_name: str
    model_config = {"from_attributes": True}

class PublicUserResponse(BaseModel):
    id:        int
    full_name: str
    email:     str
    posts:     list[PostResponse]
    model_config = {"from_attributes": True}

# --- Utilitaire ---
def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def post_to_response(post: Post) -> PostResponse:
    return PostResponse(
        id             = post.id,
        departure_city = post.departure_city,
        arrival_city   = post.arrival_city,
        departure_date = post.departure_date,
        arrival_date   = post.arrival_date,
        created_at     = post.created_at,
        user_id        = post.user_id,
        user_full_name = post.user.full_name,
    )

# --- Logique métier ---
def create_post(db: Session, token: str, data: PostCreate) -> PostResponse:
    user = get_current_user(db, token)
    if data.arrival_date < data.departure_date:
        raise HTTPException(status_code=400, detail="Arrival date must be after departure date")
    post = Post(
        departure_city = data.departure_city,
        arrival_city   = data.arrival_city,
        departure_date = data.departure_date,
        arrival_date   = data.arrival_date,
        created_at     = now_utc(),
        user_id        = user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    logger.info(f"Post created by user {user.id}")
    return post_to_response(post)

def update_post(db: Session, token: str, post_id: int, data: PostUpdate) -> PostResponse:
    user = get_current_user(db, token)
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this post")

    if data.departure_city: post.departure_city = data.departure_city
    if data.arrival_city:   post.arrival_city   = data.arrival_city
    if data.departure_date: post.departure_date = data.departure_date
    if data.arrival_date:   post.arrival_date   = data.arrival_date

    # Vérifier les dates après modification
    if post.arrival_date < post.departure_date:
        raise HTTPException(status_code=400, detail="Arrival date must be after departure date")

    db.commit()
    db.refresh(post)
    logger.info(f"Post {post_id} updated by user {user.id}")
    return post_to_response(post)

def get_my_posts(db: Session, token: str) -> list[PostResponse]:
    user = get_current_user(db, token)
    posts = db.query(Post).filter(Post.user_id == user.id).order_by(Post.created_at.desc()).all()
    return [post_to_response(p) for p in posts]

def get_all_posts(
    db: Session,
    departure_city: Optional[str] = None,
    arrival_city:   Optional[str] = None,
    departure_date: Optional[date] = None,
    arrival_date:   Optional[date] = None,
) -> list[PostResponse]:
    query = db.query(Post)

    if departure_city:
        query = query.filter(Post.departure_city.ilike(f"%{departure_city}%"))
    if arrival_city:
        query = query.filter(Post.arrival_city.ilike(f"%{arrival_city}%"))
    if departure_date:
        query = query.filter(Post.departure_date >= departure_date)
    if arrival_date:
        query = query.filter(Post.arrival_date <= arrival_date)

    posts = query.order_by(Post.created_at.desc()).all()
    return [post_to_response(p) for p in posts]

def delete_post(db: Session, token: str, post_id: int):
    user = get_current_user(db, token)
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this post")

    db.delete(post)
    db.commit()
    logger.info(f"Post {post_id} deleted by user {user.id}")
    return {"message": "Post deleted successfully"}

def get_user_profile(db: Session, user_id: int) -> PublicUserResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    posts = db.query(Post).filter(Post.user_id == user_id).order_by(Post.created_at.desc()).all()
    return PublicUserResponse(
        id        = user.id,
        full_name = user.full_name,
        email     = user.email,
        posts     = [post_to_response(p) for p in posts],
    )
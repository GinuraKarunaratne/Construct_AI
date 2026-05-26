"""
Auth service — register, login, refresh, logout.
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.core import security as _sec
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterRequest, LoginRequest, UserOut, TokenResponse


def _make_token_response(db: Session, user: User) -> TokenResponse:
    access  = _sec.create_access_token(user.id)
    raw_refresh, token_hash = _sec.create_refresh_token()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=_sec.refresh_token_expiry(),
    )
    db.add(rt)
    db.commit()

    from app.core.config import settings
    return TokenResponse(
        access_token=access,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user),
    )


def register_user(db: Session, req: RegisterRequest) -> TokenResponse:
    existing = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _make_token_response(db, user)


def login_user(db: Session, req: LoginRequest) -> TokenResponse:
    user = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    return _make_token_response(db, user)


def refresh_access_token(db: Session, raw_refresh: str) -> TokenResponse:
    token_hash = _sec.hash_refresh_token(raw_refresh)
    rt = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if (
        rt is None
        or rt.revoked
        or rt.expires_at.replace(tzinfo=timezone.utc) < now
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired. Please log in again.",
        )

    # Rotate: revoke old, issue new
    rt.revoked = True
    db.commit()

    user = db.get(User, rt.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return _make_token_response(db, user)


def logout_user(db: Session, user_id: int) -> None:
    """Revoke all active refresh tokens for this user."""
    tokens = db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,  # noqa: E712
        )
    ).scalars().all()
    for t in tokens:
        t.revoked = True
    db.commit()


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

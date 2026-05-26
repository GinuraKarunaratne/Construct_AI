from fastapi import APIRouter

from app.core.deps import DbSession, CurrentUserId
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, TokenResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(req: RegisterRequest, db: DbSession):
    return auth_service.register_user(db, req)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: DbSession):
    return auth_service.login_user(db, req)


@router.post("/refresh", response_model=TokenResponse)
def refresh(req: RefreshRequest, db: DbSession):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    return auth_service.refresh_access_token(db, req.refresh_token)


@router.post("/logout", status_code=204)
def logout(db: DbSession, user_id: CurrentUserId):
    """Revoke all refresh tokens for the current user."""
    auth_service.logout_user(db, user_id)


@router.get("/me", response_model=UserOut)
def me(db: DbSession, user_id: CurrentUserId):
    user = auth_service.get_user_by_id(db, user_id)
    return UserOut.model_validate(user)

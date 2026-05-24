from fastapi import APIRouter

from app.core.deps import DbSession, CurrentUserId
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(req: RegisterRequest, db: DbSession):
    return auth_service.register_user(db, req)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: DbSession):
    return auth_service.login_user(db, req)


@router.get("/me", response_model=UserOut)
def me(db: DbSession, user_id: CurrentUserId):
    user = auth_service.get_user_by_id(db, user_id)
    return UserOut.model_validate(user)

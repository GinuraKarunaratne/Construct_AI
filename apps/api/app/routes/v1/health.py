from fastapi import APIRouter
from sqlalchemy import text

from app.core.deps import DbSession

router = APIRouter()


@router.get("/health")
def health_check(db: DbSession):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unreachable"

    return {
        "status": "ok",
        "version": "1.0.0",
        "database": db_status,
        "service": "constructai-api",
    }

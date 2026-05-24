from fastapi import APIRouter

from app.routes.v1 import health, auth, projects, tasks, materials, labour, payroll, costs, alerts

router = APIRouter()
router.include_router(health.router,    tags=["health"])
router.include_router(auth.router)
router.include_router(projects.router)
router.include_router(tasks.router)
router.include_router(materials.router)
router.include_router(labour.router)
router.include_router(payroll.router)
router.include_router(costs.router)
router.include_router(alerts.router)

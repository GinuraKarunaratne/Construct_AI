from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.deps import DbSession, CurrentUserId
from app.models.material import MaterialItem, MaterialTransaction
from app.schemas.material import MaterialCreate, MaterialUpdate, MaterialStockOut, TransactionCreate, TransactionOut
from app.services.material_service import get_stock, check_low_stock, get_material_with_stock

router = APIRouter(tags=["materials"])


@router.get("/projects/{project_id}/materials", response_model=list[MaterialStockOut])
def list_materials(project_id: int, db: DbSession, user_id: CurrentUserId):
    items = db.execute(select(MaterialItem).where(MaterialItem.project_id == project_id)).scalars().all()
    return [get_material_with_stock(db, item) for item in items]


@router.post("/projects/{project_id}/materials", response_model=MaterialStockOut, status_code=201)
def create_material(project_id: int, req: MaterialCreate, db: DbSession, user_id: CurrentUserId):
    item = MaterialItem(project_id=project_id, **req.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return get_material_with_stock(db, item)


@router.patch("/materials/{material_id}", response_model=MaterialStockOut)
def update_material(material_id: int, req: MaterialUpdate, db: DbSession, user_id: CurrentUserId):
    item = db.get(MaterialItem, material_id)
    if not item:
        raise HTTPException(404, "Material not found")
    for f, v in req.model_dump(exclude_none=True).items():
        setattr(item, f, v)
    db.commit()
    db.refresh(item)
    return get_material_with_stock(db, item)


@router.get("/materials/{material_id}/stock")
def get_material_stock(material_id: int, db: DbSession, user_id: CurrentUserId):
    item = db.get(MaterialItem, material_id)
    if not item:
        raise HTTPException(404, "Material not found")
    return get_material_with_stock(db, item)


@router.post("/materials/{material_id}/transactions", response_model=TransactionOut, status_code=201)
def add_transaction(material_id: int, req: TransactionCreate, db: DbSession, user_id: CurrentUserId):
    item = db.get(MaterialItem, material_id)
    if not item:
        raise HTTPException(404, "Material not found")

    tx = MaterialTransaction(
        project_id=item.project_id,
        material_item_id=material_id,
        created_by=user_id,
        **req.model_dump(),
    )
    db.add(tx)
    db.flush()

    new_stock = get_stock(db, material_id)

    # Block negative stock (unless adjustment)
    if new_stock < 0 and req.transaction_type != "adjustment":
        db.rollback()
        raise HTTPException(400, f"Insufficient stock. Current: {new_stock + req.quantity:.2f}")

    check_low_stock(db, item, new_stock)
    db.commit()
    db.refresh(tx)
    return TransactionOut.model_validate(tx)


@router.get("/projects/{project_id}/materials/low-stock", response_model=list[MaterialStockOut])
def low_stock_list(project_id: int, db: DbSession, user_id: CurrentUserId):
    items = db.execute(select(MaterialItem).where(MaterialItem.project_id == project_id)).scalars().all()
    return [get_material_with_stock(db, i) for i in items if get_stock(db, i.id) <= float(i.reorder_level)]


@router.get("/projects/{project_id}/materials/transactions", response_model=list[TransactionOut])
def list_transactions(project_id: int, db: DbSession, user_id: CurrentUserId):
    txs = db.execute(
        select(MaterialTransaction).where(MaterialTransaction.project_id == project_id)
        .order_by(MaterialTransaction.transaction_date.desc())
    ).scalars().all()
    return [TransactionOut.model_validate(t) for t in txs]

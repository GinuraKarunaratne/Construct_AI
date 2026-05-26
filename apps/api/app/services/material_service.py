from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.material import MaterialItem, MaterialTransaction
from app.models.alert import Alert


def get_stock(db: Session, material_item_id: int) -> float:
    """Calculates current stock from all transactions.

    IN types  (increase stock): delivery, return, adjustment, in
    OUT types (decrease stock): issue, wastage, out
    """
    rows = db.execute(
        select(
            MaterialTransaction.transaction_type,
            func.coalesce(func.sum(MaterialTransaction.quantity), 0).label("total"),
        )
        .where(MaterialTransaction.material_item_id == material_item_id)
        .group_by(MaterialTransaction.transaction_type)
    ).all()

    _IN_TYPES  = frozenset(("delivery", "return", "adjustment", "in"))
    _OUT_TYPES = frozenset(("issue", "wastage", "out"))

    stock = 0.0
    for row in rows:
        if row.transaction_type in _IN_TYPES:
            stock += float(row.total)
        elif row.transaction_type in _OUT_TYPES:
            stock -= float(row.total)
    return stock


def check_low_stock(db: Session, item: MaterialItem, current_stock: float) -> bool:
    """Returns True if stock is at or below reorder level. Creates alert if so."""
    is_low = current_stock <= float(item.reorder_level)
    if is_low:
        # Avoid duplicate alerts — only create if no unread alert exists for this item
        existing = db.execute(
            select(Alert).where(
                Alert.project_id == item.project_id,
                Alert.alert_type == "low_stock",
                Alert.related_entity_id == item.id,
                Alert.is_read == False,  # noqa: E712
            )
        ).scalar_one_or_none()
        if not existing:
            db.add(Alert(
                project_id=item.project_id,
                alert_type="low_stock",
                severity="critical",
                title=f"Low stock: {item.name}",
                message=(
                    f"{item.name} stock is {current_stock:.1f} {item.unit}, "
                    f"below reorder level of {item.reorder_level:.1f} {item.unit}. "
                    "Please arrange replenishment."
                ),
                related_entity_type="material_item",
                related_entity_id=item.id,
            ))
    return is_low


def get_material_with_stock(db: Session, item: MaterialItem) -> dict:
    stock = get_stock(db, item.id)
    return {
        "id": item.id,
        "project_id": item.project_id,
        "name": item.name,
        "category": item.category,
        "unit": item.unit,
        "estimated_quantity": float(item.estimated_quantity),
        "reorder_level": float(item.reorder_level),
        "unit_cost_estimate": float(item.unit_cost_estimate),
        "current_stock": stock,
        "is_low_stock": stock <= float(item.reorder_level),
    }

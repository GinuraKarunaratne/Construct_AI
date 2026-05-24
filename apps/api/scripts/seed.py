"""
Seed script — creates demo data for academic presentation.

Demo Project: Two-Storey House Construction, Colombo, Sri Lanka
Budget: LKR 12,000,000 | Duration: 120 days

Run:
  cd apps/api
  .venv/Scripts/python scripts/seed.py     (Windows)
  .venv/bin/python scripts/seed.py          (Linux/Mac)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta, time
import app.db.registry  # registers all models  # noqa: F401
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.core.security import hash_password
from app.models.user import Company, User
from app.models.project import Project
from app.models.task import Task, TaskDependency
from app.models.material import MaterialItem, MaterialTransaction
from app.models.labour import Worker, Attendance, PayrollRun, PayrollLine
from app.models.cost import BudgetItem, Expense, CostPrediction
from app.models.alert import Alert

Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("Creating demo data...")

# ── Company & Users ───────────────────────────────────────────────────────────
company = Company(name="Silva Constructions (Pvt) Ltd")
db.add(company)
db.flush()

pm = User(company_id=company.id, name="Ruwan Perera", email="pm@constructai.lk",
          password_hash=hash_password("demo1234"), role="project_manager")
supervisor = User(company_id=company.id, name="Nimal Silva", email="supervisor@constructai.lk",
                  password_hash=hash_password("demo1234"), role="site_supervisor")
finance = User(company_id=company.id, name="Dilani Fernando", email="finance@constructai.lk",
               password_hash=hash_password("demo1234"), role="finance_officer")
db.add_all([pm, supervisor, finance])
db.flush()

# ── Project ───────────────────────────────────────────────────────────────────
start = date(2026, 1, 15)
project = Project(
    company_id=company.id,
    name="Two-Storey House Construction",
    description="Residential two-storey house, Colombo 7",
    location_name="Colombo 7, Western Province, Sri Lanka",
    latitude=6.9147,
    longitude=79.8635,
    planned_start_date=start,
    planned_end_date=start + timedelta(days=120),
    actual_start_date=start,
    total_budget=12_000_000,
    status="active",
    created_by=pm.id,
)
db.add(project)
db.flush()

# ── Budget Items ──────────────────────────────────────────────────────────────
budget_items = [
    ("Material",      "Cement, sand, metal, bricks, steel", 5_500_000),
    ("Labour",        "Daily wage workers and skilled trades", 3_000_000),
    ("Equipment",     "Concrete mixer, scaffolding, tools",  800_000),
    ("Subcontractor", "Electrical and plumbing work",        900_000),
    ("Transport",     "Material transport and deliveries",   400_000),
    ("Contingency",   "5% risk buffer",                     600_000),
    ("Other",         "Permits, misc site costs",           800_000),
]
for cat, desc, amt in budget_items:
    db.add(BudgetItem(project_id=project.id, category=cat, description=desc, estimated_amount=amt))

# ── Tasks ─────────────────────────────────────────────────────────────────────
task_data = [
    # (name, start_offset, duration, status, progress, weather_sensitive, priority)
    ("Site Clearing & Setting Out",     0,  5, "completed", 100, False, "high"),
    ("Excavation & Earth Work",         5, 10, "completed", 100, False, "high"),
    ("Foundation (Footings)",          15, 14, "completed", 100, False, "critical"),
    ("Ground Beams & Ground Slab",     29, 10, "completed", 100, False, "critical"),
    ("Columns — Ground Floor",         39, 12, "completed", 100, False, "high"),
    ("Brickwork — Ground Floor",       51, 14, "delayed",    30, False, "high"),
    ("Roof Slab (First Floor)",        65, 12, "not_started", 0, True,  "critical"),
    ("Columns — First Floor",          77, 10, "not_started", 0, False, "high"),
    ("Brickwork — First Floor",        87, 12, "not_started", 0, False, "medium"),
    ("Roof Structure & Roofing",       99, 14, "not_started", 0, True,  "critical"),
    ("Electrical Rough-In",            65, 20, "not_started", 0, False, "medium"),
    ("Plumbing Rough-In",              65, 20, "not_started", 0, False, "medium"),
    ("Internal Plastering",           113,  14, "not_started", 0, False, "medium"),
    ("External Plastering",           113,  10, "not_started", 0, True,  "medium"),
    ("Floor Tiling",                  120,  10, "not_started", 0, False, "low"),
    ("Painting — Internal",           127,  10, "not_started", 0, False, "low"),
    ("Painting — External",           130,   7, "not_started", 0, True,  "low"),
    ("Doors, Windows & Fixtures",     120,  14, "not_started", 0, False, "medium"),
    ("Electrical Final Fix",          134,   7, "not_started", 0, False, "medium"),
    ("Plumbing Final Fix",            134,   7, "not_started", 0, False, "medium"),
]

tasks = []
for name, offset, dur, status, prog, weather, priority in task_data:
    t_start = start + timedelta(days=offset)
    task = Task(
        project_id=project.id,
        name=name,
        planned_start_date=t_start,
        planned_end_date=t_start + timedelta(days=dur),
        duration_days=dur,
        status=status,
        progress_percentage=prog,
        is_weather_sensitive=weather,
        priority=priority,
        actual_start_date=t_start if status in ("completed", "in_progress", "delayed") else None,
        actual_end_date=(t_start + timedelta(days=dur)) if status == "completed" else None,
    )
    db.add(task)
    tasks.append(task)

db.flush()

# Task dependencies (FS = Finish-to-Start)
dep_pairs = [
    (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 9),
    (5, 10), (5, 11), (9, 12), (9, 13), (12, 14), (13, 16), (14, 15),
    (10, 18), (11, 19),
]
for pred_idx, succ_idx in dep_pairs:
    db.add(TaskDependency(
        project_id=project.id,
        predecessor_task_id=tasks[pred_idx].id,
        successor_task_id=tasks[succ_idx].id,
        dependency_type="FS",
    ))

# ── Materials ─────────────────────────────────────────────────────────────────
material_data = [
    # (name, category, unit, estimated_qty, reorder_level, unit_cost)
    ("Cement",     "Binding",    "bag",   1500, 50,   850),
    ("Sand",       "Aggregate",  "cube",   120, 10, 8_500),
    ("Metal",      "Aggregate",  "cube",    80, 8,  9_500),
    ("Bricks",     "Masonry",    "nos", 25_000, 500,   35),
    ("Steel Rods", "Steel",      "kg",   3_500, 100,  180),
    ("Timber",     "Wood",       "ft",   2_000, 100,   75),
    ("PVC Pipes",  "Plumbing",   "length", 200, 20,  650),
    ("Paint",      "Finishing",  "tin",    150, 15, 2_200),
    ("Wire",       "Electrical", "m",      800, 50,   95),
    ("Tiles",      "Finishing",  "sqft", 3_000, 100,  180),
]

today = date.today()
materials = []
for name, cat, unit, est_qty, reorder, unit_cost in material_data:
    item = MaterialItem(
        project_id=project.id,
        name=name,
        category=cat,
        unit=unit,
        estimated_quantity=est_qty,
        reorder_level=reorder,
        unit_cost_estimate=unit_cost,
    )
    db.add(item)
    materials.append(item)

db.flush()

# Material transactions — deliveries and issues
mat_txns = [
    # (material_idx, type, qty, unit_cost, days_ago, supplier, ref)
    (0, "delivery", 600, 850,   60, "Holcim Lanka",     "REF-001"),
    (0, "delivery", 500, 860,   30, "Holcim Lanka",     "REF-002"),
    (0, "issue",    450, None,  55, None,               None),
    (0, "issue",    400, None,  25, None,               None),
    # cement low — triggers alert
    (1, "delivery",  60, 8500,  60, "Gravel Suppliers", "REF-010"),
    (1, "issue",     45, None,  55, None,               None),
    (2, "delivery",  40, 9500,  60, "Metal Suppliers",  "REF-020"),
    (2, "issue",     32, None,  55, None,               None),
    (3, "delivery", 15000, 35,  60, "Brick Suppliers",  "REF-030"),
    (3, "delivery",  8000, 35,  30, "Brick Suppliers",  "REF-031"),
    (3, "issue",   12000, None, 50, None,               None),
    (4, "delivery", 2000, 180,  55, "Steel Lanka",      "REF-040"),
    (4, "issue",    1800, None, 45, None,               None),
]
for mat_idx, txn_type, qty, uc, days_ago, supplier, ref in mat_txns:
    db.add(MaterialTransaction(
        project_id=project.id,
        material_item_id=materials[mat_idx].id,
        transaction_type=txn_type,
        quantity=qty,
        unit_cost=uc,
        supplier_name=supplier,
        reference_no=ref,
        transaction_date=today - timedelta(days=days_ago),
        created_by=pm.id,
    ))

# ── Workers ───────────────────────────────────────────────────────────────────
worker_data = [
    ("Kamal Perera",   "W001", "Mason",       2800, 420, "071-1234567"),
    ("Nimal Silva",    "W002", "Helper",      1800, 270, "071-2345678"),
    ("Suresh Kumar",   "W003", "Carpenter",   2500, 375, "071-3456789"),
    ("Ranjan Dias",    "W004", "Electrician", 3000, 450, "071-4567890"),
    ("Priya Fernando", "W005", "Plumber",     3000, 450, "071-5678901"),
    ("Asanka Wijesinghe", "W006", "Mason",    2800, 420, "071-6789012"),
    ("Lasith Mendis",  "W007", "Helper",      1800, 270, "071-7890123"),
    ("Chamara Senanayake", "W008", "Mason",   2800, 420, "071-8901234"),
]

workers = []
for name, code, skill, daily, ot, phone in worker_data:
    w = Worker(
        project_id=project.id,
        full_name=name,
        worker_code=code,
        skill_type=skill,
        daily_rate=daily,
        overtime_rate=ot,
        phone=phone,
    )
    db.add(w)
    workers.append(w)

db.flush()

# Attendance — last 10 days
attendance_records = []
for day_offset in range(10, 0, -1):
    att_date = today - timedelta(days=day_offset)
    if att_date.weekday() == 6:  # skip Sunday
        continue
    for i, worker in enumerate(workers):
        status = "present" if i not in (1, 4) or day_offset > 3 else "absent"
        ot_hrs = 1.5 if i == 0 and day_offset <= 5 else 0
        att = Attendance(
            project_id=project.id,
            worker_id=worker.id,
            attendance_date=att_date,
            check_in_time=time(7, 30),
            check_out_time=time(16, 30) if status == "present" else None,
            status=status,
            overtime_hours=ot_hrs,
            method="qr",
            marked_by_user_id=supervisor.id,
        )
        db.add(att)

# Payroll run for last month
pay_start = today.replace(day=1) - timedelta(days=30)
pay_end = today.replace(day=1) - timedelta(days=1)
payroll_run = PayrollRun(
    project_id=project.id,
    period_start=pay_start,
    period_end=pay_end,
    status="approved",
    generated_by=finance.id,
    approved_by=pm.id,
)
db.add(payroll_run)
db.flush()

for worker in workers:
    gross = worker.daily_rate * 26 + worker.overtime_rate * (2 if worker.skill_type == "Mason" else 0)
    db.add(PayrollLine(
        payroll_run_id=payroll_run.id,
        worker_id=worker.id,
        days_worked=26,
        overtime_hours=2 if worker.skill_type == "Mason" else 0,
        gross_pay=gross,
        advances=5000 if worker.full_name == "Kamal Perera" else 0,
        deductions=0,
        net_pay=gross - (5000 if worker.full_name == "Kamal Perera" else 0),
    ))

# ── Expenses ──────────────────────────────────────────────────────────────────
expenses = [
    ("Equipment", "Concrete mixer rental — 2 months",     48_000, 55),
    ("Equipment", "Scaffolding hire",                       28_000, 40),
    ("Transport", "Material transport — January",           18_500, 50),
    ("Transport", "Material transport — February",          21_000, 20),
    ("Other",     "Site permits and approvals",             15_000, 60),
    ("Repair",    "Damaged formwork replacement",            8_500, 35),
    ("Other",     "Safety equipment (helmets, boots)",      12_000, 45),
]
for cat, desc, amt, days_ago in expenses:
    db.add(Expense(
        project_id=project.id,
        category=cat,
        description=desc,
        amount=amt,
        expense_date=today - timedelta(days=days_ago),
        created_by=finance.id,
    ))

# ── Alerts ────────────────────────────────────────────────────────────────────
alerts_data = [
    ("low_stock",      "critical", "Low Stock — Cement",
     "Cement stock is below reorder level (≈ 12 bags remaining, threshold 50 bags).", "material_item", materials[0].id),
    ("task_delayed",   "warning",  "Task Delayed — Brickwork (Ground Floor)",
     "Brickwork — Ground Floor is 2 days behind schedule. Dependent tasks have been rescheduled.", "task", tasks[5].id),
    ("budget_overrun", "warning",  "Budget Risk — Predicted overrun",
     "Predicted final cost is LKR 12,580,000 vs budget of LKR 12,000,000 (~4.8% overrun risk).", "project", project.id),
    ("weather_risk",   "info",     "Weather Alert — Roofing task at risk",
     "Rain probability ≥75% forecast for Friday. Roofing task is weather-sensitive — consider rescheduling.", "task", tasks[6].id),
]
for atype, severity, title, message, etype, eid in alerts_data:
    db.add(Alert(
        project_id=project.id,
        alert_type=atype,
        severity=severity,
        title=title,
        message=message,
        related_entity_type=etype,
        related_entity_id=eid,
        is_read=False,
    ))

db.commit()
print("✓ Seed data created successfully.")
print(f"  Login: pm@constructai.lk / demo1234")
print(f"  Login: supervisor@constructai.lk / demo1234")
print(f"  Login: finance@constructai.lk / demo1234")
db.close()

"""
Full CRM population script.
Creates:
  - Manager users (Нурия, Настя, Аня Хаб, Лера, Аня)
  - Contacts for every unique client from deals
  - DealContact links
  - Tasks for every deal based on stage
  - Leads pipeline from newest entries
  - Updates deal owner_id to match manager

Run:
    docker compose exec -T backend python scripts/fill_crm_data.py
"""

import re
import sys
import uuid
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from passlib.context import CryptContext
from sqlalchemy import create_engine, select, text, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.crm_deal import Deal, DealContact
from app.models.crm_contact import Contact
from app.models.crm_lead import Lead
from app.models.crm_pipeline import Pipeline, Stage
from app.models.crm_task import Task

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
db_url = settings.database_url.replace("+asyncpg", "")
engine = create_engine(db_url, pool_pre_ping=True)
SEED_MANAGER_PASSWORD = os.environ.get("CRM_SEED_MANAGER_PASSWORD", "")

if not SEED_MANAGER_PASSWORD:
    raise RuntimeError("CRM_SEED_MANAGER_PASSWORD is required")

# ── Manager definitions ───────────────────────────────────────────────────────

MANAGERS = [
    {
        "full_name": "Нурия Сагитова",
        "email": "nuriya@goodpeople.agency",
        "password": SEED_MANAGER_PASSWORD,
        # All name variants in deals
        "aliases": ["нурия", "нустя"],
    },
    {
        "full_name": "Анастасия Козлова",
        "email": "nastya@goodpeople.agency",
        "password": SEED_MANAGER_PASSWORD,
        "aliases": ["настя", "макс/настя"],
    },
    {
        "full_name": "Анна Хабирова",
        "email": "anya.hab@goodpeople.agency",
        "password": SEED_MANAGER_PASSWORD,
        "aliases": ["аня хаб", "аня хаб", "анна хаб"],
    },
    {
        "full_name": "Валерия Смирнова",
        "email": "lera@goodpeople.agency",
        "password": SEED_MANAGER_PASSWORD,
        "aliases": ["лера"],
    },
    {
        "full_name": "Анна Одинцова",
        "email": "anya@goodpeople.agency",
        "password": SEED_MANAGER_PASSWORD,
        "aliases": ["аня", "аня оди"],
    },
]

# Build alias → email map
ALIAS_TO_EMAIL: dict[str, str] = {}
for m in MANAGERS:
    for a in m["aliases"]:
        ALIAS_TO_EMAIL[a] = m["email"]


def normalize_manager(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().lower()
    # Try exact alias
    if key in ALIAS_TO_EMAIL:
        return ALIAS_TO_EMAIL[key]
    # Try prefix match
    for alias, email in ALIAS_TO_EMAIL.items():
        if key.startswith(alias) or alias.startswith(key):
            return email
    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

EMOJI_RE = re.compile(r"[\u2705\u2714\ufe0f\u203c\ufe0f\u2b50\ufe0f\u26a0\ufe0f\s✔️✅‼️⭐️]+")

def clean_client_name(raw: str | None) -> str | None:
    if not raw:
        return None
    # Remove emojis
    name = EMOJI_RE.sub(" ", raw).strip()
    # Remove trailing descriptors after "ЗАМЕНА", "замена", " - "
    name = re.sub(r"\s+(замена|замену|перевод|проблемы)\s*.*$", "", name, flags=re.IGNORECASE)
    # Remove content in parentheses that is a location (not a name)
    # Keep if it looks like a name (Мария Романовна)
    # "Александра ( Мария Романовна)" → "Александра / Мария Романовна"
    paren = re.search(r"\((.+?)\)", name)
    if paren:
        inner = paren.group(1).strip()
        # If inner looks like a proper name (starts with capital) keep it
        if inner and inner[0].isupper() and len(inner) > 3:
            name = name[:paren.start()].strip() + " / " + inner
        else:
            name = name[:paren.start()].strip()
    return name.strip().strip("/").strip() or None


def make_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    return "+" + digits if len(digits) >= 10 else None


# ── Task templates by stage ───────────────────────────────────────────────────

def task_for_deal(deal: Deal, stage_name: str, owner_id: uuid.UUID | None) -> Task | None:
    cf = deal.custom_fields or {}
    position = cf.get("position") or "персонал"
    location = cf.get("location") or ""
    schedule = cf.get("schedule") or ""
    order_date_str = cf.get("order_date") or ""

    # Try to parse order date for due_at
    due_at = None
    if order_date_str:
        try:
            d = datetime.fromisoformat(order_date_str)
            # Due date = order date + 7 days for active, +3 for urgent
            days = 3 if stage_name == "Срочно" else 7
            due_at = d + timedelta(days=days)
        except Exception:
            pass

    if stage_name == "Новая":
        return Task(
            title=f"Принять в работу: {position}",
            description=f"Новый заказ от клиента.\nПозиция: {position}\nГрафик: {schedule}\nЛокация: {location}",
            status="new",
            priority="normal",
            entity_type="deal",
            entity_id=deal.id,
            assignee_id=owner_id,
            due_at=due_at,
        )
    elif stage_name == "В работе":
        return Task(
            title=f"Подбор кандидата: {position}",
            description=f"Ведётся подбор.\nПозиция: {position}\nГрафик: {schedule}\nЛокация: {location}",
            status="in_progress",
            priority="normal",
            entity_type="deal",
            entity_id=deal.id,
            assignee_id=owner_id,
            due_at=due_at,
        )
    elif stage_name == "Срочно":
        return Task(
            title=f"СРОЧНО: {position}",
            description=f"Срочный заказ! Требуется быстрый подбор.\nПозиция: {position}\nГрафик: {schedule}\nЛокация: {location}",
            status="in_progress",
            priority="high",
            entity_type="deal",
            entity_id=deal.id,
            assignee_id=owner_id,
            due_at=due_at,
        )
    elif stage_name == "Закрыт":
        return Task(
            title=f"Оформить закрытие: {position}",
            description=f"Кандидат найден. Оформить документы и подписать акт.\nПозиция: {position}\nЛокация: {location}",
            status="done",
            priority="normal",
            entity_type="deal",
            entity_id=deal.id,
            assignee_id=owner_id,
            due_at=None,
        )
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    stats = {
        "users_created": 0,
        "deals_assigned": 0,
        "contacts_created": 0,
        "deal_contacts_linked": 0,
        "tasks_created": 0,
        "leads_created": 0,
    }

    with Session(engine) as session:

        # ── 1. Create manager users ──────────────────────────────────────────
        print("\n[1/6] Creating manager users...")
        user_by_email: dict[str, User] = {}

        for m in MANAGERS:
            existing = session.execute(
                select(User).where(User.email == m["email"])
            ).scalar_one_or_none()
            if not existing:
                u = User(
                    email=m["email"],
                    full_name=m["full_name"],
                    hashed_password=pwd_ctx.hash(m["password"]),
                    role="manager",
                    is_active=True,
                )
                session.add(u)
                session.flush()
                user_by_email[m["email"]] = u
                print(f"  + {m['full_name']} ({m['email']})")
                stats["users_created"] += 1
            else:
                user_by_email[m["email"]] = existing
                print(f"  = {m['full_name']} already exists")

        session.commit()

        # ── 2. Load all deals + stages ───────────────────────────────────────
        print("\n[2/6] Loading deals and stages...")
        all_deals = session.execute(select(Deal)).scalars().all()
        all_stages = {s.id: s for s in session.execute(select(Stage)).scalars().all()}
        print(f"  Loaded {len(all_deals)} deals, {len(all_stages)} stages")

        # ── 3. Assign deal owners ────────────────────────────────────────────
        print("\n[3/6] Assigning deal owners...")
        for deal in all_deals:
            cf = deal.custom_fields or {}
            raw_mgr = cf.get("manager_name")
            email = normalize_manager(raw_mgr)
            if email and email in user_by_email:
                new_owner = user_by_email[email].id
                if deal.owner_id != new_owner:
                    deal.owner_id = new_owner
                    stats["deals_assigned"] += 1
        session.commit()
        print(f"  Assigned owner for {stats['deals_assigned']} deals")

        # ── 4. Create contacts from deal clients ─────────────────────────────
        print("\n[4/6] Creating contacts from deal clients...")

        # Load existing contacts to avoid duplicates
        existing_contacts: dict[str, Contact] = {}
        for c in session.execute(select(Contact)).scalars().all():
            existing_contacts[c.name.lower().strip()] = c

        # Load existing deal-contact links
        linked_deal_ids = set(
            row[0] for row in session.execute(
                text("SELECT deal_id FROM crm_deal_contacts")
            ).fetchall()
        )

        contact_cache: dict[str, Contact] = {}   # name_key → Contact

        for deal in all_deals:
            cf = deal.custom_fields or {}
            raw = cf.get("client_raw")
            if not raw:
                continue

            name = clean_client_name(raw)
            if not name or len(name) < 2:
                continue

            name_key = name.lower().strip()

            # Reuse or create contact
            if name_key in contact_cache:
                contact = contact_cache[name_key]
            elif name_key in existing_contacts:
                contact = existing_contacts[name_key]
                contact_cache[name_key] = contact
            else:
                # Determine contact owner = deal owner
                contact = Contact(
                    full_name=name,
                    owner_id=deal.owner_id,
                    notes=f"Локация: {cf.get('location') or '—'}\nПозиция: {cf.get('position') or '—'}",
                    custom_fields={
                        "location": cf.get("location"),
                        "source": "Google Sheets",
                        "position_requested": cf.get("position"),
                    },
                )
                session.add(contact)
                session.flush()
                existing_contacts[name_key] = contact
                contact_cache[name_key] = contact
                stats["contacts_created"] += 1

            # Link contact to deal (if not already linked)
            if deal.id not in linked_deal_ids:
                session.add(DealContact(deal_id=deal.id, contact_id=contact.id))
                linked_deal_ids.add(deal.id)
                stats["deal_contacts_linked"] += 1

        session.commit()
        print(f"  Created {stats['contacts_created']} contacts, linked {stats['deal_contacts_linked']} deals")

        # ── 5. Create tasks for every deal ───────────────────────────────────
        print("\n[5/6] Creating tasks for deals...")

        # Find deals that already have tasks
        deals_with_tasks = set(
            row[0] for row in session.execute(
                text("SELECT entity_id FROM crm_tasks WHERE entity_type='deal' AND entity_id IS NOT NULL")
            ).fetchall()
        )
        print(f"  {len(deals_with_tasks)} deals already have tasks — skipping those")

        stage_name_cache: dict[uuid.UUID, str] = {s.id: s.name for s in all_stages.values()}

        batch = []
        for deal in all_deals:
            if deal.id in deals_with_tasks:
                continue
            stage_name = stage_name_cache.get(deal.stage_id, "Новая") if deal.stage_id else "Новая"
            t = task_for_deal(deal, stage_name, deal.owner_id)
            if t:
                batch.append(t)
                if len(batch) >= 200:
                    session.add_all(batch)
                    session.flush()
                    stats["tasks_created"] += len(batch)
                    batch = []

        if batch:
            session.add_all(batch)
            session.flush()
            stats["tasks_created"] += len(batch)

        session.commit()
        print(f"  Created {stats['tasks_created']} tasks")

        # ── 6. Create leads from newest "В работе" deals (last 60 days) ─────
        print("\n[6/6] Creating leads for recent clients...")

        # Get or create Leads pipeline
        leads_pipeline = session.execute(
            select(Pipeline).where(Pipeline.name == "Клиенты", Pipeline.entity_type == "lead")
        ).scalar_one_or_none()

        if not leads_pipeline:
            leads_pipeline = Pipeline(name="Клиенты", entity_type="lead", is_default=True)
            session.add(leads_pipeline)
            session.flush()

            for order, (name, color, is_won, is_lost) in enumerate([
                ("Новый лид",     "#a0aec0", False, False),
                ("Квалифицирован","#4299e1", False, False),
                ("Переговоры",    "#ed8936", False, False),
                ("Договор",       "#9f7aea", False, False),
                ("Клиент",        "#48bb78", True,  False),
                ("Отказ",         "#fc8181", False, True),
            ]):
                session.add(Stage(
                    pipeline_id=leads_pipeline.id, name=name, sort_order=order,
                    color=color, is_won=is_won, is_lost=is_lost,
                ))
            session.flush()
            print("  Created Leads pipeline")

        lead_stages = {
            s.name: s for s in session.execute(
                select(Stage).where(Stage.pipeline_id == leads_pipeline.id)
            ).scalars().all()
        }

        # Existing leads by title
        existing_leads = set(
            row[0] for row in session.execute(text("SELECT title FROM crm_leads")).fetchall()
        )

        # Build leads from deals created in last 60 days
        # Use order_date from custom_fields
        cutoff = datetime(2026, 1, 1)   # take everything from 2026

        lead_count = 0
        seen_clients: set[str] = set()

        for deal in all_deals:
            cf = deal.custom_fields or {}
            date_str = cf.get("order_date")
            if not date_str:
                continue
            try:
                order_date = datetime.fromisoformat(date_str)
            except Exception:
                continue

            if order_date < cutoff:
                continue

            name = clean_client_name(cf.get("client_raw"))
            if not name or name.lower() in seen_clients:
                continue
            seen_clients.add(name.lower())

            lead_title = f"{name} — {cf.get('position') or 'подбор'}"
            if lead_title in existing_leads:
                continue

            # Stage: "Клиент" if closed, "Переговоры" if active, "Новый лид" for new
            stage_name = cf.get("order_status", "Новая")
            if stage_name == "Закрыт":
                lead_stage_name = "Клиент"
            elif stage_name in ("В работе", "Срочно"):
                lead_stage_name = "Переговоры"
            else:
                lead_stage_name = "Новый лид"

            lead_stage = lead_stages.get(lead_stage_name)

            session.add(Lead(
                title=lead_title,
                source=", ".join(cf.get("source_channels") or []) or "Google Sheets",
                amount=deal.amount,
                pipeline_id=leads_pipeline.id,
                stage_id=lead_stage.id if lead_stage else None,
                owner_id=deal.owner_id,
                notes=f"Позиция: {cf.get('position')}\nГрафик: {cf.get('schedule')}\nЛокация: {cf.get('location')}",
                custom_fields={"deal_id": str(deal.id), "from_sheets": True},
            ))
            existing_leads.add(lead_title)
            lead_count += 1

            if lead_count % 100 == 0:
                session.flush()

        session.commit()
        stats["leads_created"] = lead_count
        print(f"  Created {lead_count} leads")

    engine.dispose()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("CRM FULLY POPULATED")
    print(f"  Manager users created:   {stats['users_created']}")
    print(f"  Deals assigned to mgr:   {stats['deals_assigned']}")
    print(f"  Contacts created:        {stats['contacts_created']}")
    print(f"  Deal-Contact links:      {stats['deal_contacts_linked']}")
    print(f"  Tasks created:           {stats['tasks_created']}")
    print(f"  Leads created:           {stats['leads_created']}")
    print("=" * 60)
    print("\nManager logins:")
    for m in MANAGERS:
        print(f"  {m['email']}  /  {m['password']}")


if __name__ == "__main__":
    main()

"""Initial schema v2.0

Revision ID: 0001
Revises:
Create Date: 2026-04-20
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enum types ────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE user_role AS ENUM ('admin', 'manager');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE application_status AS ENUM (
                'new', 'bot_done', 'interview_scheduled',
                'interviewed', 'matched', 'contract_sent', 'closed'
            );
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE match_status AS ENUM ('sent', 'accepted', 'declined', 'client_approved');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE bot_channel AS ENUM ('telegram', 'whatsapp', 'max', 'email');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE message_direction AS ENUM ('outgoing', 'incoming');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE video_service_type AS ENUM ('tolk', 'yandex', 'most');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE contract_status AS ENUM ('draft', 'sent', 'signed', 'archived');
        EXCEPTION WHEN duplicate_object THEN null; END $$
    """)

    # ── users ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email           VARCHAR(256) UNIQUE NOT NULL,
            full_name       VARCHAR(256) NOT NULL,
            hashed_password VARCHAR(512) NOT NULL,
            role            user_role NOT NULL DEFAULT 'manager',
            is_active       BOOLEAN NOT NULL DEFAULT true,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── contract_templates (before applications to avoid FK issues) ───────
    op.execute("""
        CREATE TABLE IF NOT EXISTS contract_templates (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name         VARCHAR(256) NOT NULL,
            html_content TEXT NOT NULL,
            variables    TEXT,
            created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at   TIMESTAMPTZ DEFAULT NOW(),
            updated_at   TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── contracts (before applications due to FK) ─────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS contracts (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            application_id UUID,
            candidate_id   UUID,
            template_id    UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
            pdf_url        VARCHAR(512),
            status         contract_status NOT NULL DEFAULT 'draft',
            created_at     TIMESTAMPTZ DEFAULT NOW(),
            sent_at        TIMESTAMPTZ
        )
    """)

    # ── applications ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            description        TEXT NOT NULL,
            telegram_username  VARCHAR(128),
            whatsapp_phone     VARCHAR(32),
            max_contact        VARCHAR(128),
            email              VARCHAR(256),
            status             application_status NOT NULL DEFAULT 'new',
            interview_at       TIMESTAMPTZ,
            video_link         VARCHAR(512),
            video_service      video_service_type,
            manager_notes      TEXT,
            search_params      JSON,
            contract_id        UUID REFERENCES contracts(id) ON DELETE SET NULL,
            created_at         TIMESTAMPTZ DEFAULT NOW(),
            updated_at         TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_applications_status ON applications(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_applications_created_at ON applications(created_at)")

    # Add FK from contracts to applications (circular — add after both tables exist)
    op.execute("""
        ALTER TABLE contracts
            ADD CONSTRAINT fk_contracts_application
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
    """)

    # ── candidates ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name        VARCHAR(256) NOT NULL,
            age              INTEGER,
            specialization   VARCHAR(256),
            experience_years INTEGER,
            salary_min       NUMERIC(12,2),
            salary_max       NUMERIC(12,2),
            availability     VARCHAR(256),
            contacts         JSON,
            tags             TEXT[],
            notes            TEXT,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            updated_at       TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidates_specialization ON candidates(specialization)")

    # Add FK from contracts to candidates
    op.execute("""
        ALTER TABLE contracts
            ADD CONSTRAINT fk_contracts_candidate
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
    """)

    # ── matches ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
            candidate_id   UUID NOT NULL REFERENCES candidates(id)   ON DELETE CASCADE,
            status         match_status NOT NULL DEFAULT 'sent',
            sent_at        TIMESTAMPTZ DEFAULT NOW(),
            responded_at   TIMESTAMPTZ
        )
    """)

    # ── bot_messages ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS bot_messages (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
            channel        bot_channel NOT NULL,
            direction      message_direction NOT NULL,
            text           TEXT NOT NULL,
            created_at     TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bot_messages_application_id ON bot_messages(application_id)")

    # ── app_settings (for bot scripts/FAQ) ────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key        VARCHAR(128) PRIMARY KEY,
            value      JSON,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── calendar_slots ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS calendar_slots (
            id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            manager_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            starts_at                TIMESTAMPTZ NOT NULL,
            ends_at                  TIMESTAMPTZ NOT NULL,
            is_available             BOOLEAN NOT NULL DEFAULT true,
            booked_by_application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
            video_service            video_service_type,
            video_link               VARCHAR(512),
            created_at               TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_calendar_slots_manager_id ON calendar_slots(manager_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_calendar_slots_starts_at ON calendar_slots(starts_at)")

    # ── crm_notifications ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS crm_notifications (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title       VARCHAR(512) NOT NULL,
            body        TEXT,
            is_read     BOOLEAN NOT NULL DEFAULT false,
            entity_type VARCHAR(64),
            entity_id   UUID,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_crm_notifications_user_id ON crm_notifications(user_id)")

    # ── crm_audit_log ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS crm_audit_log (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type VARCHAR(64) NOT NULL,
            entity_id   UUID NOT NULL,
            user_id     UUID,
            user_label  VARCHAR(256),
            action      VARCHAR(64) NOT NULL,
            changes     JSON,
            summary     TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_crm_audit_log_entity ON crm_audit_log(entity_type, entity_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS crm_audit_log")
    op.execute("DROP TABLE IF EXISTS crm_notifications")
    op.execute("DROP TABLE IF EXISTS calendar_slots")
    op.execute("DROP TABLE IF EXISTS app_settings")
    op.execute("DROP TABLE IF EXISTS bot_messages")
    op.execute("DROP TABLE IF EXISTS matches")
    op.execute("ALTER TABLE contracts DROP CONSTRAINT IF EXISTS fk_contracts_candidate")
    op.execute("ALTER TABLE contracts DROP CONSTRAINT IF EXISTS fk_contracts_application")
    op.execute("DROP TABLE IF EXISTS applications")
    op.execute("DROP TABLE IF EXISTS contracts")
    op.execute("DROP TABLE IF EXISTS candidates")
    op.execute("DROP TABLE IF EXISTS contract_templates")
    op.execute("DROP TABLE IF EXISTS users")
    op.execute("DROP TYPE IF EXISTS contract_status")
    op.execute("DROP TYPE IF EXISTS video_service_type")
    op.execute("DROP TYPE IF EXISTS message_direction")
    op.execute("DROP TYPE IF EXISTS bot_channel")
    op.execute("DROP TYPE IF EXISTS match_status")
    op.execute("DROP TYPE IF EXISTS application_status")
    op.execute("DROP TYPE IF EXISTS user_role")

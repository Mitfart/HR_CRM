"""Audit log — records every significant change to CRM entities."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "crm_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # What changed
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Who changed
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    user_label: Mapped[str | None] = mapped_column(String(256), nullable=True)  # snapshot of name

    # What action
    action: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )  # created | updated | stage_changed | deleted | bulk_update

    # Snapshot of changes: {field: {old: ..., new: ...}}
    changes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Optional human-readable summary
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RawLegacyRow(Base):
    __tablename__ = "raw_legacy_rows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    spreadsheet_id: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    sheet_name: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    raw_data: Mapped[list[str | None] | None] = mapped_column(JSONB, nullable=True)
    parsed_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    parse_status: Mapped[str] = mapped_column(String(50), nullable=False, default="ok")
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

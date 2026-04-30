import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(256), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer)
    specialization: Mapped[str | None] = mapped_column(String(256))
    experience_years: Mapped[int | None] = mapped_column(Integer)
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    availability: Mapped[str | None] = mapped_column(String(256))

    # JSON: {"telegram": "@username", "whatsapp": "+7...", "email": "..."}
    contacts: Mapped[dict | None] = mapped_column(JSON)

    # Array of skill/category tags
    tags: Mapped[list | None] = mapped_column(ARRAY(String))

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    matches: Mapped[list["Match"]] = relationship(back_populates="candidate")

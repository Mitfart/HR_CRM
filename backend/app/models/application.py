import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Contact channels (at least one required)
    telegram_username: Mapped[str | None] = mapped_column(String(128))
    whatsapp_phone: Mapped[str | None] = mapped_column(String(32))
    max_contact: Mapped[str | None] = mapped_column(String(128))
    email: Mapped[str | None] = mapped_column(String(256))

    # v2.0 statuses: new → bot_done → interview_scheduled → interviewed → matched → contract_sent → closed
    status: Mapped[str] = mapped_column(
        Enum(
            "new",
            "bot_done",
            "interview_scheduled",
            "interviewed",
            "matched",
            "contract_sent",
            "closed",
            name="application_status",
        ),
        default="new",
        nullable=False,
    )

    interview_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    video_link: Mapped[str | None] = mapped_column(String(512))
    video_service: Mapped[str | None] = mapped_column(
        Enum("tolk", "yandex", "most", name="video_service_type")
    )

    manager_notes: Mapped[str | None] = mapped_column(Text)
    search_params: Mapped[dict | None] = mapped_column(JSON)

    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    matches: Mapped[list["Match"]] = relationship(back_populates="application")
    bot_messages: Mapped[list["BotMessage"]] = relationship(back_populates="application")

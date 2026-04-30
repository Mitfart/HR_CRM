import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BotMessage(Base):
    __tablename__ = "bot_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE")
    )
    channel: Mapped[str] = mapped_column(
        Enum("telegram", "whatsapp", "max", "email", name="bot_channel"),
        nullable=False,
    )
    direction: Mapped[str] = mapped_column(
        Enum("outgoing", "incoming", name="message_direction"),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    application: Mapped["Application"] = relationship(back_populates="bot_messages")

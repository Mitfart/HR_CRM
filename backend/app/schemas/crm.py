"""CRM-related Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: Optional[str] = None
    is_read: bool
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    user_id: Optional[uuid.UUID]
    user_label: Optional[str]
    action: str
    changes: Optional[dict]
    summary: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

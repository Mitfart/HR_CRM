import uuid
from datetime import datetime

from pydantic import BaseModel


class MatchCreate(BaseModel):
    application_id: uuid.UUID
    candidate_ids: list[uuid.UUID]


class MatchStatusUpdate(BaseModel):
    status: str  # accepted | declined | client_approved


class MatchOut(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    candidate_id: uuid.UUID
    status: str
    sent_at: datetime
    responded_at: datetime | None

    model_config = {"from_attributes": True}

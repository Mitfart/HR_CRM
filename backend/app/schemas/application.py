import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, model_validator


class ApplicationCreate(BaseModel):
    description: str
    telegram_username: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    max_contact: Optional[str] = None
    email: Optional[EmailStr] = None

    @model_validator(mode="after")
    def at_least_one_contact(self) -> "ApplicationCreate":
        if not any([self.telegram_username, self.whatsapp_phone, self.max_contact, self.email]):
            raise ValueError("At least one contact channel is required")
        return self


class ApplicationUpdate(BaseModel):
    manager_notes: Optional[str] = None
    search_params: Optional[dict] = None
    status: Optional[str] = None
    interview_at: Optional[datetime] = None
    video_link: Optional[str] = None
    video_service: Optional[str] = None
    contract_id: Optional[uuid.UUID] = None


class ApplicationOut(BaseModel):
    id: uuid.UUID
    description: str
    telegram_username: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    max_contact: Optional[str] = None
    email: Optional[str] = None
    status: str
    interview_at: Optional[datetime] = None
    video_link: Optional[str] = None
    video_service: Optional[str] = None
    manager_notes: Optional[str] = None
    search_params: Optional[dict] = None
    contract_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

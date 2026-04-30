import uuid
from datetime import datetime

from pydantic import BaseModel


class UserBrief(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime
    participants: list[UserBrief]
    last_message: MessageOut | None
    unread_count: int

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    user_id: uuid.UUID  # the other user to start a chat with


class MessageCreate(BaseModel):
    text: str

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class CandidateCreate(BaseModel):
    full_name: str
    age: int | None = None
    specialization: str | None = None
    experience_years: int | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    availability: str | None = None
    contacts: dict | None = None
    tags: list[str] | None = None
    notes: str | None = None


class CandidateUpdate(CandidateCreate):
    full_name: str | None = None


class CandidateOut(BaseModel):
    id: uuid.UUID
    full_name: str
    age: int | None
    specialization: str | None
    experience_years: int | None
    salary_min: Decimal | None
    salary_max: Decimal | None
    availability: str | None
    contacts: dict | None
    tags: list[str] | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

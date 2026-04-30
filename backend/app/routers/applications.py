import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_manager
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.match import Match
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationOut, ApplicationUpdate
from app.schemas.candidate import CandidateOut
from app.schemas.match import MatchOut
from app.tasks import trigger_bot_for_application

router = APIRouter()


class SearchParams(BaseModel):
    specialization: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    salary_max: Optional[float] = None
    experience_min: Optional[int] = None


class MatchWithCandidateOut(MatchOut):
    candidate: CandidateOut


# Public: submit a new application (from the website form)
@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(data: ApplicationCreate, db: AsyncSession = Depends(get_db)):
    app_obj = Application(**data.model_dump())
    db.add(app_obj)
    await db.flush()
    await db.refresh(app_obj)

    trigger_bot_for_application.delay(
        str(app_obj.id),
        app_obj.telegram_username,
    )

    return app_obj


# CRM: list all applications — managers/admins only
@router.get("", response_model=list[ApplicationOut])
async def list_applications(
    skip: int = 0,
    limit: int = 50,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    query = select(Application).offset(skip).limit(limit).order_by(Application.created_at.desc())
    if status:
        query = query.where(Application.status == status)
    result = await db.execute(query)
    return result.scalars().all()


# CRM: get single application — managers/admins only
@router.get("/{application_id}", response_model=ApplicationOut)
async def get_application(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return obj


# CRM: update application — managers/admins only
@router.patch("/{application_id}", response_model=ApplicationOut)
async def update_application(
    application_id: uuid.UUID,
    data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


# CRM: search candidates for application — managers/admins only
@router.post("/{application_id}/search", response_model=list[CandidateOut])
async def search_candidates(
    application_id: uuid.UUID,
    params: SearchParams,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    app_obj = result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    saved = app_obj.search_params or {}
    spec = params.specialization or saved.get("specialization")
    age_min = params.age_min if params.age_min is not None else saved.get("age_min")
    age_max = params.age_max if params.age_max is not None else saved.get("age_max")
    salary_max = params.salary_max if params.salary_max is not None else saved.get("salary_max")
    exp_min = params.experience_min if params.experience_min is not None else saved.get("experience_min")

    query = select(Candidate).limit(100)
    if spec:
        query = query.where(Candidate.specialization.ilike(f"%{spec}%"))
    if age_min is not None:
        query = query.where(Candidate.age >= age_min)
    if age_max is not None:
        query = query.where(Candidate.age <= age_max)
    if salary_max is not None:
        query = query.where(Candidate.salary_min <= salary_max)
    if exp_min is not None:
        query = query.where(Candidate.experience_years >= exp_min)

    candidates = await db.execute(query)
    return candidates.scalars().all()


# CRM: get matches for application — managers/admins only
@router.get("/{application_id}/matches", response_model=list[MatchWithCandidateOut])
async def get_application_matches(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(
        select(Match)
        .where(Match.application_id == application_id)
        .options(selectinload(Match.candidate))
        .order_by(Match.sent_at.desc())
    )
    matches = result.scalars().all()
    out = []
    for m in matches:
        out.append(
            MatchWithCandidateOut(
                id=m.id,
                application_id=m.application_id,
                candidate_id=m.candidate_id,
                status=m.status,
                sent_at=m.sent_at,
                responded_at=m.responded_at,
                candidate=CandidateOut.model_validate(m.candidate),
            )
        )
    return out

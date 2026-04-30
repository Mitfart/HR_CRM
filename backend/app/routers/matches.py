import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_manager
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.match import Match
from app.models.user import User
from app.schemas.candidate import CandidateOut
from app.schemas.match import MatchCreate, MatchOut, MatchStatusUpdate

router = APIRouter()


class MatchWithCandidateOut(MatchOut):
    candidate: CandidateOut


@router.post("", response_model=list[MatchOut], status_code=status.HTTP_201_CREATED)
async def create_matches(
    data: MatchCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    from app.tasks import notify_candidates

    created = []
    for candidate_id in data.candidate_ids:
        # Skip duplicates (same application + candidate)
        existing = await db.execute(
            select(Match).where(
                Match.application_id == data.application_id,
                Match.candidate_id == candidate_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        obj = Match(application_id=data.application_id, candidate_id=candidate_id)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        created.append(obj)

    if created:
        notify_candidates.delay([str(m.id) for m in created])

    return created


@router.get("/{match_id}", response_model=MatchWithCandidateOut)
async def get_match(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Match)
        .where(Match.id == match_id)
        .options(selectinload(Match.candidate))
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return MatchWithCandidateOut(
        id=obj.id,
        application_id=obj.application_id,
        candidate_id=obj.candidate_id,
        status=obj.status,
        sent_at=obj.sent_at,
        responded_at=obj.responded_at,
        candidate=CandidateOut.model_validate(obj.candidate),
    )


@router.patch("/{match_id}", response_model=MatchOut)
async def update_match_status(
    match_id: uuid.UUID,
    data: MatchStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    obj.status = data.status
    if data.status in ("accepted", "declined", "client_approved"):
        obj.responded_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.post("/{match_id}/send-to-client")
async def send_match_to_client(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """Отправляет конкретного согласованного кандидата клиенту через Telegram-бот."""
    result = await db.execute(
        select(Match)
        .where(Match.id == match_id)
        .options(selectinload(Match.candidate), selectinload(Match.application))
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    # Mark as client_approved
    match.status = "client_approved"
    match.responded_at = datetime.now(timezone.utc)
    await db.flush()

    # Notify client via bot queue
    app_obj: Application = match.application
    candidate: Candidate = match.candidate
    client_tg = app_obj.telegram_username

    if client_tg:
        from app.tasks import notify_client_about_candidate
        notify_client_about_candidate.delay(
            str(app_obj.id),
            client_tg,
            candidate.full_name,
            candidate.specialization,
            candidate.experience_years,
            float(candidate.salary_min) if candidate.salary_min is not None else None,
        )

    return {"status": "sent", "match_id": str(match_id), "candidate": candidate.full_name}


@router.post("/application/{application_id}/send-all-to-client")
async def send_all_accepted_to_client(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """Отправляет клиенту всех соискателей со статусом 'accepted' по данной заявке."""
    # Load application
    app_result = await db.execute(select(Application).where(Application.id == application_id))
    app_obj = app_result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    # Load accepted matches with candidates
    matches_result = await db.execute(
        select(Match)
        .where(Match.application_id == application_id, Match.status == "accepted")
        .options(selectinload(Match.candidate))
    )
    accepted_matches = matches_result.scalars().all()

    if not accepted_matches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет соискателей со статусом 'Согласен'",
        )

    # Mark all as client_approved
    for m in accepted_matches:
        m.status = "client_approved"
        m.responded_at = datetime.now(timezone.utc)
    await db.flush()

    # Update application status
    app_obj.status = "sent_to_client"
    await db.flush()

    # Build candidate list text
    lines = []
    for m in accepted_matches:
        c = m.candidate
        parts = [c.full_name]
        if c.specialization:
            parts.append(c.specialization)
        if c.experience_years is not None:
            parts.append(f"опыт {c.experience_years} лет")
        if c.salary_min is not None:
            parts.append(f"от {int(c.salary_min):,} ₽".replace(",", " "))
        lines.append("• " + ", ".join(parts))

    client_tg = app_obj.telegram_username
    if client_tg:
        from app.tasks import notify_client_with_candidates_list
        notify_client_with_candidates_list.delay(
            str(application_id),
            client_tg,
            lines,
        )

    return {
        "status": "sent_to_client",
        "application_id": str(application_id),
        "candidates_sent": len(accepted_matches),
    }

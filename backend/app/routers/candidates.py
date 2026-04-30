import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import and_, cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.candidate import CandidateCreate, CandidateOut, CandidateUpdate

router = APIRouter()


@router.get("", response_model=list[CandidateOut])
async def list_candidates(
    skip: int = 0,
    limit: int = 200,
    name: str | None = None,
    specialization: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
    experience_min: int | None = None,
    tags_search: str | None = None,
    availability: str | None = None,
    keyword_query: str | None = None,
    keyword_mode: str = "all_words",  # all_words | any_word
    period: str = "all_time",  # all_time | 30d | 7d
    source_method: str | None = None,
    reject_reasons: list[str] | None = None,
    country: str | None = None,
    region: str | None = None,
    city: str | None = None,
    gender: str | None = None,  # any | male | female
    work_place: list[str] | None = None,
    employment_type: list[str] | None = None,
    schedule: list[str] | None = None,
    languages: list[str] | None = None,
    driver_licenses: list[str] | None = None,
    tags: list[str] | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    from sqlalchemy import func
    from datetime import datetime, timedelta, timezone
    if period == "30d":
        query = query.where(Candidate.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
    elif period == "7d":
        query = query.where(Candidate.created_at >= datetime.now(timezone.utc) - timedelta(days=7))


    query = select(Candidate).offset(skip).limit(limit)
    if name:
        query = query.where(Candidate.full_name.ilike(f"%{name}%"))
    if specialization:
        query = query.where(Candidate.specialization.ilike(f"%{specialization}%"))
    if age_min is not None:
        query = query.where(Candidate.age >= age_min)
    if age_max is not None:
        query = query.where(Candidate.age <= age_max)
    # Salary overlap: candidate range overlaps client budget range
    if salary_min is not None:
        query = query.where(Candidate.salary_max >= salary_min)
    if salary_max is not None:
        query = query.where(Candidate.salary_min <= salary_max)
    if experience_min is not None:
        query = query.where(Candidate.experience_years >= experience_min)
    if tags_search:
        query = query.where(
            func.array_to_string(Candidate.tags, " ").ilike(f"%{tags_search}%")
        )
    if tags:
        # OR inside group: match at least one selected tag
        query = query.where(Candidate.tags.overlap(tags))
    if availability:
        query = query.where(Candidate.availability.ilike(f"%{availability}%"))
    if region:
        query = query.where(
            or_(
                Candidate.notes.ilike(f"%{region}%"),
                Candidate.specialization.ilike(f"%{region}%"),
            )
        )
    if country:
        query = query.where(
            or_(
                Candidate.notes.ilike(f"%{country}%"),
                Candidate.specialization.ilike(f"%{country}%"),
            )
        )
    if city:
        query = query.where(
            or_(
                Candidate.notes.ilike(f"%{city}%"),
                Candidate.specialization.ilike(f"%{city}%"),
            )
        )
    if gender and gender != "any":
        # Heuristic: Russian female surnames usually end with -а/-я.
        if gender == "female":
            query = query.where(
                or_(
                    Candidate.full_name.ilike("%а %"),
                    Candidate.full_name.ilike("%я %"),
                    Candidate.full_name.ilike("%а"),
                    Candidate.full_name.ilike("%я"),
                )
            )
        elif gender == "male":
            query = query.where(
                and_(
                    ~Candidate.full_name.ilike("%а %"),
                    ~Candidate.full_name.ilike("%я %"),
                    ~Candidate.full_name.ilike("%а"),
                    ~Candidate.full_name.ilike("%я"),
                )
            )

    # OR inside each checkbox group, AND between groups.
    def _notes_or(values: list[str] | None):
        if not values:
            return None
        return or_(*[Candidate.notes.ilike(f"%{v}%") for v in values if v])

    for group in [work_place, employment_type, schedule, languages, driver_licenses]:
        cond = _notes_or(group)
        if cond is not None:
            query = query.where(cond)
    if reject_reasons:
        query = query.where(or_(*[Candidate.notes.ilike(f"%{v}%") for v in reject_reasons if v]))
    if source_method and source_method != "all":
        query = query.where(
            or_(
                func.array_to_string(Candidate.tags, " ").ilike(f"%{source_method}%"),
                Candidate.notes.ilike(f"%{source_method}%"),
            )
        )

    if keyword_query:
        words = [w.strip() for w in keyword_query.split() if w.strip()]
        if words:
            haystack = func.concat_ws(
                " ",
                Candidate.full_name,
                Candidate.specialization,
                Candidate.availability,
                cast(Candidate.tags, String),
                Candidate.notes,
            )
            if keyword_mode == "any_word":
                query = query.where(or_(*[haystack.ilike(f"%{w}%") for w in words]))
            else:
                query = query.where(and_(*[haystack.ilike(f"%{w}%") for w in words]))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    obj = Candidate(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/{candidate_id}", response_model=CandidateOut)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return obj


@router.patch("/{candidate_id}", response_model=CandidateOut)
async def update_candidate(
    candidate_id: uuid.UUID,
    data: CandidateUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    await db.delete(obj)


@router.post("/import")
async def import_candidates_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Импорт соискателей из CSV файла.
    Ожидаемые колонки (все опциональны кроме full_name):
    full_name, age, specialization, experience_years, salary_min, salary_max,
    availability, telegram, whatsapp, email, tags, notes
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл должен быть в формате CSV")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # utf-8-sig handles BOM from Excel
    except UnicodeDecodeError:
        text = content.decode("cp1251")  # fallback for Windows Excel encoding

    reader = csv.DictReader(io.StringIO(text))

    created = 0
    errors = []

    for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        full_name = (row.get("full_name") or "").strip()
        if not full_name:
            errors.append(f"Строка {i}: пропущено поле full_name")
            continue

        def _int(val: str | None) -> int | None:
            try:
                return int(val) if val and val.strip() else None
            except ValueError:
                return None

        def _float(val: str | None) -> float | None:
            try:
                return float(val.replace(",", ".")) if val and val.strip() else None
            except ValueError:
                return None

        contacts: dict = {}
        if row.get("telegram", "").strip():
            contacts["telegram"] = row["telegram"].strip()
        if row.get("whatsapp", "").strip():
            contacts["whatsapp"] = row["whatsapp"].strip()
        if row.get("email", "").strip():
            contacts["email"] = row["email"].strip()

        tags_raw = (row.get("tags") or "").strip()
        tags = [t.strip() for t in tags_raw.split(",")] if tags_raw else []

        obj = Candidate(
            full_name=full_name,
            age=_int(row.get("age")),
            specialization=(row.get("specialization") or "").strip() or None,
            experience_years=_int(row.get("experience_years")),
            salary_min=_float(row.get("salary_min")),
            salary_max=_float(row.get("salary_max")),
            availability=(row.get("availability") or "").strip() or None,
            contacts=contacts or None,
            tags=tags or None,
            notes=(row.get("notes") or "").strip() or None,
        )
        db.add(obj)
        created += 1

    return {"created": created, "errors": errors}

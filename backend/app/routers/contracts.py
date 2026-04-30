import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_manager, require_admin
from app.models.contract import Contract, ContractTemplate
from app.models.application import Application
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    html_content: str
    variables: Optional[str] = None  # JSON string of variable names


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    html_content: str
    variables: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContractCreate(BaseModel):
    application_id: uuid.UUID
    candidate_id: Optional[uuid.UUID] = None
    template_id: uuid.UUID


class ContractOut(BaseModel):
    id: uuid.UUID
    application_id: Optional[uuid.UUID] = None
    candidate_id: Optional[uuid.UUID] = None
    template_id: Optional[uuid.UUID] = None
    pdf_url: Optional[str] = None
    status: str
    created_at: datetime
    sent_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Contract Templates ─────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(ContractTemplate).order_by(ContractTemplate.created_at.desc()))
    return result.scalars().all()


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    template = ContractTemplate(
        name=data.name,
        html_content=data.html_content,
        variables=data.variables,
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.put("/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    data: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(ContractTemplate).where(ContractTemplate.id == template_id))
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    tmpl.name = data.name
    tmpl.html_content = data.html_content
    tmpl.variables = data.variables
    await db.flush()
    await db.refresh(tmpl)
    return tmpl


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(ContractTemplate).where(ContractTemplate.id == template_id))
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tmpl)


# ── Contracts ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ContractOut])
async def list_contracts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Contract).order_by(Contract.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(
    data: ContractCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    # Verify template exists
    tmpl_result = await db.execute(select(ContractTemplate).where(ContractTemplate.id == data.template_id))
    tmpl = tmpl_result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    contract = Contract(
        application_id=data.application_id,
        candidate_id=data.candidate_id,
        template_id=data.template_id,
        status="draft",
    )
    db.add(contract)
    await db.flush()
    await db.refresh(contract)

    # Link contract to application
    app_result = await db.execute(select(Application).where(Application.id == data.application_id))
    app_obj = app_result.scalar_one_or_none()
    if app_obj:
        app_obj.contract_id = contract.id

    return contract


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.get("/{contract_id}/pdf")
async def download_contract_pdf(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Generate and return contract PDF.
    Requires WeasyPrint to be installed: pip install weasyprint
    """
    from sqlalchemy.orm import selectinload as sl

    result = await db.execute(
        select(Contract)
        .where(Contract.id == contract_id)
        .options(sl(Contract.template), sl(Contract.application), sl(Contract.candidate))
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if not contract.template:
        raise HTTPException(status_code=400, detail="Contract has no template")

    html = contract.template.html_content

    # Auto-substitute basic variables from application/candidate
    if contract.application:
        app = contract.application
        html = html.replace("{{description}}", app.description or "")
        html = html.replace("{{client_telegram}}", app.telegram_username or "")
        html = html.replace("{{client_email}}", app.email or "")
    if contract.candidate:
        cand = contract.candidate
        html = html.replace("{{candidate_name}}", cand.full_name or "")
        html = html.replace("{{specialization}}", cand.specialization or "")

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
    except ImportError:
        # Fallback: return HTML as text if WeasyPrint not installed
        return Response(content=html, media_type="text/html")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contract_{contract_id}.pdf"},
    )


@router.post("/{contract_id}/send", response_model=ContractOut)
async def send_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract.status = "sent"
    contract.sent_at = datetime.now(timezone.utc)

    # Update application status
    if contract.application_id:
        app_result = await db.execute(select(Application).where(Application.id == contract.application_id))
        app_obj = app_result.scalar_one_or_none()
        if app_obj:
            app_obj.status = "contract_sent"

    await db.flush()
    await db.refresh(contract)
    return contract

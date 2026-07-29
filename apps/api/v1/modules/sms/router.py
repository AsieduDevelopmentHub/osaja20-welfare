from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from v1.core.arkesel_client import ArkeselError, normalize_gh_msisdn
from v1.core.auth.dependencies import require_executive
from v1.core.database import get_db
from v1.core.models import Member
from v1.core.schemas import (
    ApiResponse,
    SmsAutomationRun,
    SmsAutomationUpdate,
    SmsCampaignUpdate,
    SmsComposeRequest,
    SmsCustomGroupCreate,
    SmsEstimateRequest,
    SmsTemplateCreate,
    SmsTemplateUpdate,
    SmsWorkflowCreate,
    SmsWorkflowRun,
    SmsWorkflowUpdate,
)
from v1.core.serializers import member_to_dict
from v1.core.sms_service import sms_service

router = APIRouter(prefix="/sms", tags=["SMS"])


@router.get("/dashboard", response_model=ApiResponse)
async def sms_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.dashboard_stats(db)
    return ApiResponse(success=True, data=data)


@router.get("/balance", response_model=ApiResponse)
async def sms_balance(
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        from v1.core import arkesel_client

        data = await arkesel_client.get_balance()
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        status_code = 502 if upstream in (401, 403) else (upstream if 400 <= upstream < 600 else 502)
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data)


@router.get("/settings", response_model=ApiResponse)
async def sms_settings(_: Annotated[Member, Depends(require_executive)]):
    return ApiResponse(success=True, data=sms_service.settings_public())


@router.get("/recipients/groups", response_model=ApiResponse)
async def list_recipient_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.list_recipient_groups(db)
    return ApiResponse(success=True, data=data)


@router.get("/recipients", response_model=ApiResponse)
async def list_recipients(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    group: str = Query(default="active"),
    member_ids: list[UUID] | None = Query(default=None),
):
    try:
        members = await sms_service.resolve_recipients(
            db, group=group, member_ids=member_ids or []
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(
        success=True,
        data=[
            {
                **member_to_dict(m),
                "phone_normalized": normalize_gh_msisdn(m.phone_number),
            }
            for m in members
        ],
    )


@router.post("/estimate", response_model=ApiResponse)
async def estimate_sms(
    payload: SmsEstimateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.estimate(
            db,
            message=payload.message,
            recipient_group=payload.recipient_group,
            member_ids=payload.member_ids,
            phones=payload.phones,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data)


@router.post("/compose", response_model=ApiResponse)
async def compose_sms(
    payload: SmsComposeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.compose_and_send(
            db,
            actor=executive,
            message=payload.message,
            name=payload.name,
            recipient_group=payload.recipient_group,
            member_ids=payload.member_ids,
            phones=payload.phones,
            schedule_at=payload.schedule_at,
            sandbox=payload.sandbox,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        # Auth-style codes from Arkesel must not clear the portal session.
        if upstream in (401, 403):
            status_code = 502
        elif upstream == 422:
            # Arkesel uses 422 for business rules (invalid recipients, etc.)
            status_code = 400
        elif 400 <= upstream < 600:
            status_code = upstream
        else:
            status_code = 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="SMS campaign submitted")


@router.get("/campaigns", response_model=ApiResponse)
async def list_campaigns(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
):
    data = await sms_service.list_campaigns(
        db, page=page, page_size=page_size, status=status
    )
    return ApiResponse(success=True, data=data)


@router.get("/history", response_model=ApiResponse)
async def sms_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    q: str | None = None,
):
    data = await sms_service.list_history(
        db, page=page, page_size=page_size, status=status, q=q
    )
    return ApiResponse(success=True, data=data)


@router.post("/messages/{message_id}/refresh", response_model=ApiResponse)
async def refresh_message_status(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.refresh_message_status(db, message_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        status_code = 502 if upstream in (401, 403) else (upstream if 400 <= upstream < 600 else 502)
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Delivery status refreshed")


@router.get("/webhooks/arkesel", response_model=ApiResponse)
@router.post("/webhooks/arkesel", response_model=ApiResponse)
async def arkesel_delivery_webhook(
    db: Annotated[AsyncSession, Depends(get_db)],
    sms_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    """Public Arkesel delivery callback — query params: sms_id, status."""
    if not sms_id or not status:
        raise HTTPException(status_code=400, detail="sms_id and status are required")
    updated = await sms_service.apply_delivery_webhook(db, sms_id=sms_id, status=status)
    if not updated:
        # Still 200 so Arkesel does not retry forever for unknown ids
        return ApiResponse(success=True, message="No matching message", data={"sms_id": sms_id})
    return ApiResponse(success=True, data=updated, message="Delivery status updated")


@router.get("/templates", response_model=ApiResponse)
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.list_templates(db)
    return ApiResponse(success=True, data=data)


@router.post("/templates", response_model=ApiResponse)
async def create_template(
    payload: SmsTemplateCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.create_template(
            db,
            actor=executive,
            name=payload.name,
            body=payload.body,
            category=payload.category,
            linked_trigger=payload.linked_trigger,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Template created")


@router.delete("/templates/{template_id}", response_model=ApiResponse)
async def delete_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        await sms_service.delete_template(db, template_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, message="Template deleted")


@router.get("/reports", response_model=ApiResponse)
async def sms_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.reports_summary(db)
    return ApiResponse(success=True, data=data)


@router.get("/reports/export")
async def sms_reports_export(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
    limit: int = Query(default=500, ge=1, le=5000),
):
    csv_text = await sms_service.export_history_csv(db, limit=limit)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sms-history.csv"'},
    )


@router.get("/automation", response_model=ApiResponse)
async def get_sms_automation(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.get_automation(db)
    return ApiResponse(success=True, data=data)


@router.get("/workflows", response_model=ApiResponse)
async def list_workflows(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.list_workflows(db)
    return ApiResponse(success=True, data=data)


@router.post("/workflows", response_model=ApiResponse)
async def create_workflow(
    payload: SmsWorkflowCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.create_workflow(
            db,
            name=payload.name,
            trigger=payload.trigger,
            recipient_group=payload.recipient_group,
            message=payload.message,
            enabled=payload.enabled,
            template_id=payload.template_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Workflow created")


@router.delete("/workflows/{workflow_id}", response_model=ApiResponse)
async def delete_workflow(
    workflow_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        await sms_service.delete_workflow(db, workflow_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, message="Workflow deleted")


@router.post("/workflows/{workflow_id}/run", response_model=ApiResponse)
async def run_workflow(
    workflow_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
    payload: SmsWorkflowRun | None = None,
):
    try:
        data = await sms_service.run_workflow(
            db,
            actor=executive,
            workflow_id=workflow_id,
            phones=(payload.phones if payload else None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        status_code = 502 if upstream in (401, 403) else (upstream if 400 <= upstream < 600 else 502)
        if upstream == 422:
            status_code = 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Workflow submitted")


@router.put("/automation", response_model=ApiResponse)
async def update_sms_automation(
    payload: SmsAutomationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    # Legacy endpoint kept for compatibility; prefer /workflows
    data = await sms_service.get_automation(db)
    return ApiResponse(success=True, data=data, message="Use /sms/workflows to manage workflows")


@router.post("/automation/run", response_model=ApiResponse)
async def run_sms_automation(
    payload: SmsAutomationRun,
    db: Annotated[AsyncSession, Depends(get_db)],
    executive: Annotated[Member, Depends(require_executive)],
):
    # Legacy: map old job names onto first matching workflow, or create ephemeral run
    try:
        job = payload.job.strip().lower()
        trigger = "birthday" if job == "birthday" else "outstanding_dues" if job == "dues" else job
        workflows = await sms_service.list_workflows(db)
        match = next((w for w in workflows if w.get("trigger") == trigger and w.get("enabled")), None)
        if match:
            data = await sms_service.run_workflow(db, actor=executive, workflow_id=str(match["id"]))
        else:
            raise ValueError("No enabled workflow found for this job — create one under Automation")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ArkeselError as exc:
        upstream = exc.status_code or 502
        status_code = 502 if upstream in (401, 403) else (upstream if 400 <= upstream < 600 else 502)
        if upstream == 422:
            status_code = 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Automation job submitted")


@router.put("/workflows/{workflow_id}", response_model=ApiResponse)
async def update_workflow(
    workflow_id: str,
    payload: SmsWorkflowUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.update_workflow(
            db,
            workflow_id=workflow_id,
            name=payload.name,
            message=payload.message,
            enabled=payload.enabled,
            template_id=payload.template_id,
            clear_template=payload.clear_template,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Workflow updated")


@router.patch("/templates/{template_id}", response_model=ApiResponse)
async def update_template_meta(
    template_id: UUID,
    payload: SmsTemplateUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    await sms_service.set_template_linked_trigger(
        db, template_id=str(template_id), linked_trigger=payload.linked_trigger
    )
    templates = await sms_service.list_templates(db)
    match = next((t for t in templates if t["id"] == str(template_id)), None)
    return ApiResponse(success=True, data=match, message="Template updated")


@router.post("/recipient-groups", response_model=ApiResponse)
async def create_recipient_group(
    payload: SmsCustomGroupCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.create_custom_group(
            db, name=payload.name, contacts=payload.contacts
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Recipient group created")


@router.post("/recipient-groups/restore-builtin", response_model=ApiResponse)
async def restore_builtin_recipient_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    data = await sms_service.restore_builtin_groups(db)
    return ApiResponse(success=True, data=data, message="Built-in groups restored")


@router.delete("/recipient-groups/{group_id}", response_model=ApiResponse)
async def delete_recipient_group(
    group_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        await sms_service.delete_custom_group(db, group_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, message="Recipient group removed")


@router.get("/campaigns/{campaign_id}", response_model=ApiResponse)
async def get_campaign(
    campaign_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.get_campaign(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data)


@router.patch("/campaigns/{campaign_id}", response_model=ApiResponse)
async def update_campaign(
    campaign_id: UUID,
    payload: SmsCampaignUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.update_scheduled_campaign(
            db,
            campaign_id=campaign_id,
            message=payload.message,
            name=payload.name,
            schedule_at=payload.schedule_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Campaign updated")


@router.post("/campaigns/{campaign_id}/cancel", response_model=ApiResponse)
async def cancel_campaign(
    campaign_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[Member, Depends(require_executive)],
):
    try:
        data = await sms_service.cancel_scheduled_campaign(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(success=True, data=data, message="Campaign cancelled")

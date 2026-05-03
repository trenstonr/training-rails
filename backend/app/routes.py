from fastapi import APIRouter, Depends, HTTPException

from app.auth import verify_api_token
from app.config import APP_NAME
from app.detections import detect_defect
from app.dispatch import dispatch_operator
from app.pins import acknowledge_pin, edit_pin, reopen_pin, resolve_pin
from app.worker import append_dispatch_log, get_pin_for_worker

router = APIRouter()


@router.get("/")
async def root():
    return {"message": f"{APP_NAME} API is running"}


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/debug/cors")
async def debug_cors():
    """Diagnostic-only: shows what the running server sees for CORS env."""
    import os
    return {
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS"),
        "CORS_ORIGIN_REGEX": os.getenv("CORS_ORIGIN_REGEX"),
    }


@router.post("/detect", dependencies=[Depends(verify_api_token)])
async def detect(defect: dict | None = None):
    if defect is None:
        raise HTTPException(status_code=400, detail="Missing JSON request body")

    return detect_defect(defect)


@router.post("/dispatch", dependencies=[Depends(verify_api_token)])
async def dispatch(payload: dict | None = None):
    if payload is None:
        raise HTTPException(status_code=400, detail="Missing JSON request body")

    return dispatch_operator(payload)


@router.post("/pins/{pin_id}/acknowledge", dependencies=[Depends(verify_api_token)])
async def acknowledge(pin_id: str):
    return acknowledge_pin(pin_id)


@router.post("/pins/{pin_id}/resolve", dependencies=[Depends(verify_api_token)])
async def resolve(pin_id: str):
    return resolve_pin(pin_id)


@router.post("/pins/{pin_id}/reopen", dependencies=[Depends(verify_api_token)])
async def reopen(pin_id: str):
    return reopen_pin(pin_id)


@router.post("/pins/{pin_id}/edit", dependencies=[Depends(verify_api_token)])
async def edit(pin_id: str, payload: dict | None = None):
    if not payload:
        raise HTTPException(status_code=400, detail="Missing JSON request body")
    defect_type = payload.get("defect_type")
    severity = payload.get("severity")
    if defect_type is None and severity is None:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of 'defect_type' or 'severity'",
        )
    return edit_pin(
        pin_id,
        defect_type=str(defect_type) if defect_type is not None else None,
        severity=severity,
    )


# Worker endpoints — public (no API_TOKEN). Auth model: open URL keyed by
# pin_id, delivered via SMS to the dispatched crew. See app/worker.py.
@router.get("/worker/pins/{pin_id}")
async def worker_get_pin(pin_id: str):
    return get_pin_for_worker(pin_id)


@router.post("/worker/pins/{pin_id}/log")
async def worker_log(pin_id: str, payload: dict | None = None):
    if payload is None:
        raise HTTPException(status_code=400, detail="Missing JSON request body")
    return append_dispatch_log(pin_id, payload)

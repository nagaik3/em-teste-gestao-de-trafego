import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.auth import router as auth_router, get_current_user
from app.database import init_db
from app.routers.atribuidor import router as atribuidor_router
from app.routers.gestao import router as gestao_router
from app.routers.nova_tarefa import router as nova_tarefa_router
from app.routers.performance import router as performance_router
from app.routers.datalake import router as datalake_router
from app.security import SecurityHeadersMiddleware, get_audit_log

app = FastAPI(title="Gestao de Testes — IMPERA")

# Initialize database tables on startup
init_db()

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS - specific origin only
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# Auth router MUST come before other routers and SPA catch-all
app.include_router(auth_router)
app.include_router(atribuidor_router)
app.include_router(gestao_router)
app.include_router(nova_tarefa_router)
app.include_router(performance_router)
app.include_router(datalake_router)


@app.get("/health")
def health():
    return {"status": "ok"}


# --- Webhook receiver (temporary bridge until VPS impera-core is live) ---
import json
import logging

_webhook_log = logging.getLogger("webhooks")
_webhook_events: list[dict] = []


@app.post("/webhooks/clickup")
async def clickup_webhook(request: Request):
    body = await request.body()
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return {"error": "invalid json"}
    # ClickUp challenge handshake
    if "challenge" in payload:
        return {"challenge": payload["challenge"]}
    event_type = payload.get("event", "unknown")
    task_id = payload.get("task_id", "")
    _webhook_events.append({"event": event_type, "task_id": task_id})
    if len(_webhook_events) > 100:
        _webhook_events.pop(0)
    _webhook_log.info("WEBHOOK: %s task=%s", event_type, task_id)
    return {"status": "received", "event": event_type, "task_id": task_id}


@app.get("/webhooks/log")
def webhook_log():
    return {"total": len(_webhook_events), "last_10": _webhook_events[-10:]}


@app.get("/auth/audit")
def audit(request: Request):
    user = get_current_user(request)
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    return get_audit_log(50)


# --- Serve frontend ---
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa(request: Request, full_path: str):
        # Prevent path traversal
        safe_path = (FRONTEND_DIR / full_path).resolve()
        if not str(safe_path).startswith(str(FRONTEND_DIR.resolve())):
            return FileResponse(str(FRONTEND_DIR / "index.html"))
        file_path = FRONTEND_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

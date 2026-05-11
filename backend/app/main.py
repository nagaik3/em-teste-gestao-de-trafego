from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.auth import router as auth_router
from app.routers.atribuidor import router as atribuidor_router
from app.routers.gestao import router as gestao_router
from app.routers.nova_tarefa import router as nova_tarefa_router
from app.routers.performance import router as performance_router

app = FastAPI(title="Gestao de Testes — IMPERA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth router MUST come before other routers and SPA catch-all
app.include_router(auth_router)
app.include_router(atribuidor_router)
app.include_router(gestao_router)
app.include_router(nova_tarefa_router)
app.include_router(performance_router)


@app.get("/health")
def health():
    return {"status": "ok"}


# --- Serve frontend ---
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa(request: Request, full_path: str):
        file_path = FRONTEND_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

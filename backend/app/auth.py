from __future__ import annotations
import os
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel
from typing import Optional
from app.config import JWT_SECRET, JWT_ALGORITHM, USERS
from app.security import check_rate_limit, clear_rate_limit, audit_log

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 7
IS_PRODUCTION = bool(os.environ.get("RENDER"))


def create_access_token(email: str, nome: str, role: str, gestor_key: Optional[str]) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode(
        {"sub": email, "nome": nome, "role": role, "gestor_key": gestor_key, "exp": expire, "type": "access"},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def create_refresh_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_DAYS)
    return jwt.encode(
        {"sub": email, "exp": expire, "type": "refresh"},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def get_current_user(request: Request) -> dict:
    # Read from Authorization header ONLY (access token)
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalido")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado ou invalido")


def require_role(*allowed_roles):
    """FastAPI dependency that checks if current user has one of the allowed roles."""
    def _dependency(request: Request) -> dict:
        user = get_current_user(request)
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Acesso negado para este perfil")
        return user
    return Depends(_dependency)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response):
    check_rate_limit(request)

    user = USERS.get(body.email)
    if not user or not pwd_context.verify(body.password, user["password_hash"]):
        audit_log(body.email, "login_failed", "Credenciais invalidas")
        raise HTTPException(status_code=401, detail="Credenciais invalidas")

    clear_rate_limit(request)

    access_token = create_access_token(body.email, user["nome"], user["role"], user["gestor_key"])
    refresh_token = create_refresh_token(body.email)

    response.set_cookie(
        "refresh_token", refresh_token,
        httponly=True, samesite="strict",
        secure=IS_PRODUCTION, max_age=60 * 60 * 24 * REFRESH_TOKEN_DAYS,
        path="/auth",  # Only sent to /auth/* endpoints
    )

    audit_log(body.email, "login_success")

    return {
        "access_token": access_token,
        "email": body.email,
        "nome": user["nome"],
        "role": user["role"],
        "gestor_key": user["gestor_key"],
    }


@router.post("/refresh")
def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sem refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")

    email = payload["sub"]
    user = USERS.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario nao encontrado")

    access_token = create_access_token(email, user["nome"], user["role"], user["gestor_key"])

    return {
        "access_token": access_token,
        "email": email,
        "nome": user["nome"],
        "role": user["role"],
        "gestor_key": user["gestor_key"],
    }


@router.get("/me")
def me(request: Request):
    user = get_current_user(request)
    return {
        "email": user["sub"],
        "nome": user["nome"],
        "role": user["role"],
        "gestor_key": user.get("gestor_key"),
    }


@router.post("/logout")
def logout(response: Response, request: Request):
    # Try to get user for audit log
    try:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
            audit_log(payload.get("sub", "unknown"), "logout")
    except Exception:
        pass
    response.delete_cookie("refresh_token", path="/auth")
    return {"ok": True}

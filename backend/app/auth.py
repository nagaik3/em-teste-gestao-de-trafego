from __future__ import annotations
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel
from typing import Optional
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_ACCESS_EXPIRE_MINUTES, USERS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])


def create_token(email: str, nome: str, role: str, gestor_key: Optional[str]) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": email, "nome": nome, "role": role, "gestor_key": gestor_key, "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalido")


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
def login(body: LoginRequest, response: Response):
    user = USERS.get(body.email)
    if not user or not pwd_context.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    token = create_token(body.email, user["nome"], user["role"], user["gestor_key"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", secure=False, max_age=86400)
    return {
        "email": body.email,
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
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}

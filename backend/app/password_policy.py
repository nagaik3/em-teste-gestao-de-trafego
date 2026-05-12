"""Password policy enforcement."""
import re
from fastapi import HTTPException

MIN_LENGTH = 8


def validate_password(password: str):
    """Enforce password complexity. Raises HTTPException if invalid."""
    errors = []
    if len(password) < MIN_LENGTH:
        errors.append(f"Minimo {MIN_LENGTH} caracteres")
    if not re.search(r'[A-Z]', password):
        errors.append("Pelo menos 1 letra maiuscula")
    if not re.search(r'[a-z]', password):
        errors.append("Pelo menos 1 letra minuscula")
    if not re.search(r'\d', password):
        errors.append("Pelo menos 1 numero")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Pelo menos 1 caractere especial")
    if errors:
        raise HTTPException(status_code=400, detail="Senha fraca: " + "; ".join(errors))

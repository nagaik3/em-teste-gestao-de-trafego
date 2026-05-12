"""Security middleware and utilities."""
import os
import time
import hashlib
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# --- Rate Limiter (in-memory, per-IP) ---
_login_attempts = defaultdict(list)  # ip -> [timestamps]
_lockouts = {}  # ip -> lockout_until

RATE_LIMIT_WINDOW = 60      # 1 minute window
RATE_LIMIT_MAX = 5           # max 5 attempts per window
LOCKOUT_DURATION = 900       # 15 min lockout after exceeding


def check_rate_limit(request: Request):
    """Check if IP is rate-limited. Call before login processing."""
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Check lockout
    if ip in _lockouts and _lockouts[ip] > now:
        remaining = int(_lockouts[ip] - now)
        raise HTTPException(429, f"Muitas tentativas. Tente novamente em {remaining}s")

    # Clean old attempts
    _login_attempts[ip] = [t for t in _login_attempts[ip] if t > now - RATE_LIMIT_WINDOW]

    if len(_login_attempts[ip]) >= RATE_LIMIT_MAX:
        _lockouts[ip] = now + LOCKOUT_DURATION
        raise HTTPException(429, f"Bloqueado por {LOCKOUT_DURATION // 60} minutos")

    _login_attempts[ip].append(now)


def clear_rate_limit(request: Request):
    """Clear rate limit on successful login."""
    ip = request.client.host if request.client else "unknown"
    _login_attempts.pop(ip, None)
    _lockouts.pop(ip, None)


# --- Security Headers Middleware ---
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Allow embedding in ClickUp (*.clickup.com) — block everything else
        response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.clickup.com https://app.clickup.com"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # HSTS only if behind HTTPS proxy (Render/Cloudflare)
        if os.environ.get("RENDER"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


# --- Audit Logger (PostgreSQL-backed) ---
from app.database import log_audit as _db_log_audit, get_audit_logs as _db_get_audit_logs


def audit_log(user_email: str, action: str, details: str = "", ip: str = ""):
    """Log a security-relevant action to PostgreSQL."""
    _db_log_audit(user_email, action, details, ip)


def get_audit_log(limit: int = 50):
    return _db_get_audit_logs(limit)

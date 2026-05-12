"""Database connection and session management."""
import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "")
# Render PostgreSQL URLs use postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    nome = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin, gestor, visitante
    gestor_key = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)


# Only create engine if DATABASE_URL is set
engine = None
SessionLocal = None

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Create tables if they don't exist."""
    if engine:
        Base.metadata.create_all(engine)


def get_db():
    """Get a database session. Use as context manager."""
    if not SessionLocal:
        return None
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(String, nullable=False)  # ISO format
    user_email = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)  # login_success, login_failed, logout, move_creative, claim_task, create_task
    details = Column(String, default="")
    ip_address = Column(String, default="")


def log_audit(email: str, action: str, details: str = "", ip: str = ""):
    """Insert an audit log entry into the database."""
    if not SessionLocal:
        return
    db = SessionLocal()
    try:
        entry = AuditLog(
            timestamp=datetime.now(timezone.utc).isoformat(),
            user_email=email,
            action=action,
            details=details[:500],
            ip_address=ip,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def get_audit_logs(limit: int = 100):
    """Return the latest audit log entries."""
    if not SessionLocal:
        return []
    db = SessionLocal()
    try:
        rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp,
                "user_email": r.user_email,
                "action": r.action,
                "details": r.details,
                "ip_address": r.ip_address,
            }
            for r in rows
        ]
    finally:
        db.close()


def get_user_by_email(email: str):
    """Fetch user by email from PostgreSQL."""
    if not SessionLocal:
        return None
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            return {
                "email": user.email,
                "nome": user.nome,
                "role": user.role,
                "gestor_key": user.gestor_key,
                "password_hash": user.password_hash,
            }
        return None
    finally:
        db.close()

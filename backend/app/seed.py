"""Seed script: migrate users from config.py to PostgreSQL.
Run once: python -m app.seed
"""
import os
import sys

# Ensure we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, SessionLocal, User, init_db

# The legacy users from config.py (preserved exactly for migration)
LEGACY_USERS = {
    "iago@impera.com": {
        "password_hash": "$2b$12$xv67V52hmOR7kCyGv/GJdO1HTJDZ9QeSf3/TQjkAg1kY50yKrD/na",
        "nome": "Iago Almeida",
        "role": "admin",
        "gestor_key": None,
    },
    "lucas@impera.com": {
        "password_hash": "$2b$12$x8SWmxb5go85fOJQo6bCIuk.pP6TYDvw346pDvo4NR5pxtOSM9oPS",
        "nome": "Lucas Cavalcanti",
        "role": "gestor",
        "gestor_key": "lucas",
    },
    "ludson@impera.com": {
        "password_hash": "$2b$12$Nb/EGarK39IhXOcwhzYqqOdt5c9wAdIZ9grWsu2oBVYtBKQeCarWe",
        "nome": "Ludson Chaves",
        "role": "gestor",
        "gestor_key": "ludson",
    },
    "douglas@impera.com": {
        "password_hash": "$2b$12$XsaTmEvWL80Wla.e8DTUkuYhW8iXkD5GDjhRzOtO1zTqA76WYeuli",
        "nome": "Douglas Oliveira",
        "role": "gestor",
        "gestor_key": "douglas",
    },
    "gustavo@impera.com": {
        "password_hash": "$2b$12$A78xN2iG6tEhjz4pHwAZ8uBsVKbeE2SYrnySGBau0yZJsJd3BGb26",
        "nome": "Gustavo Lisner",
        "role": "gestor",
        "gestor_key": "gustavo",
    },
    "gabriel@impera.com": {
        "password_hash": "$2b$12$AInJOWZbvq1Fl/FGOuaFdOAXosrM11fxnIptygwT8UjrxZNuBE.RG",
        "nome": "Gabriel Fraza",
        "role": "gestor",
        "gestor_key": "gabriel",
    },
    "visitante@impera.com": {
        "password_hash": "$2b$12$oAndkXoBTkbbxSt2T.HbveA9iKRXsfRdGY/vRJe2udk.ktbIC7cRu",
        "nome": "Visitante",
        "role": "visitante",
        "gestor_key": None,
    },
}


def seed():
    if not engine:
        print("ERROR: DATABASE_URL not set")
        return

    # Drop and recreate to ensure schema matches model (safe — only users table, seeded fresh)
    from app.database import Base
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    print("  Tables recreated")

    db = SessionLocal()

    try:
        for email, data in LEGACY_USERS.items():
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                print(f"  SKIP: {email} (already exists)")
                continue
            user = User(
                email=email,
                nome=data["nome"],
                role=data["role"],
                gestor_key=data["gestor_key"],
                password_hash=data["password_hash"],
            )
            db.add(user)
            print(f"  ADD: {email} ({data['role']})")

        db.commit()
        print(f"\nSeed complete. {db.query(User).count()} users in database.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

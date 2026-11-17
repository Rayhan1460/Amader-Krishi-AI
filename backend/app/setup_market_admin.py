"""Run locally from backend: python -m app.setup_market_admin."""
from getpass import getpass
import re

from sqlalchemy import delete
from .api.produce_market import MarketAdmin, MarketSession
from .core.security import get_password_hash
from .db import SessionLocal, engine


def main():
    username = input("Admin username: ").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,64}", username):
        raise SystemExit("Use 3 to 64 letters, numbers, dots, underscores or hyphens.")
    password = getpass("Admin password (at least 12 characters): ")
    if not 12 <= len(password) <= 256 or password != getpass("Confirm password: "):
        raise SystemExit("Password is too short or the confirmation does not match.")
    MarketAdmin.__table__.create(engine, checkfirst=True)
    MarketSession.__table__.create(engine, checkfirst=True)
    with SessionLocal() as db:
        row = db.get(MarketAdmin, username)
        if row is None:
            row = MarketAdmin(username=username)
            db.add(row)
        else:
            db.execute(delete(MarketSession).where(MarketSession.username == username))
        row.password_hash = get_password_hash(password)
        db.commit()
    print("AGRISPHERE_MARKET_ADMIN_READY")


if __name__ == "__main__":
    main()

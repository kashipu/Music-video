"""Run migrations manually. Run with: python -m app.db.migrate"""
import asyncio
from app.database import init_db, close_db


async def migrate():
    await init_db()
    print("Migrations applied successfully.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(migrate())

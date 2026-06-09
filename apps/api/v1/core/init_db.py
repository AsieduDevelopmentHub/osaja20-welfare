from sqlalchemy.ext.asyncio import AsyncSession
import re

from sqlalchemy import inspect, text

from v1.core.database import Base, engine
from v1.core import models  # noqa: F401 — register all tables before create_all
from v1.core.services import registry


async def init_database() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_migrations(conn)


async def _apply_migrations(conn) -> None:
    def migrate(sync_conn):
        insp = inspect(sync_conn)
        if "members" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("members")}
        if "username" not in cols:
            sync_conn.execute(text("ALTER TABLE members ADD COLUMN username VARCHAR(50)"))
            rows = sync_conn.execute(
                text("SELECT id, email FROM members WHERE username IS NULL OR username = ''")
            ).fetchall()
            seen: set[str] = set()
            for row in rows:
                local = str(row.email).split("@")[0].lower()
                local = re.sub(r"[^a-z0-9_]", "", local) or "member"
                candidate = local
                n = 1
                while candidate in seen:
                    candidate = f"{local}{n}"
                    n += 1
                seen.add(candidate)
                sync_conn.execute(
                    text("UPDATE members SET username = :u WHERE id = :id"),
                    {"u": candidate[:50], "id": row.id},
                )
            sync_conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_members_username ON members (username)"))

        if "avatar_url" not in cols:
            sync_conn.execute(text("ALTER TABLE members ADD COLUMN avatar_url VARCHAR(500)"))
        if "preferences" not in cols:
            sync_conn.execute(text("ALTER TABLE members ADD COLUMN preferences JSON"))

        if "contributions" in insp.get_table_names():
            contrib_cols = {c["name"] for c in insp.get_columns("contributions")}
            if "period_year" not in contrib_cols:
                sync_conn.execute(text("ALTER TABLE contributions ADD COLUMN period_year INTEGER"))
            if "period_month" not in contrib_cols:
                sync_conn.execute(text("ALTER TABLE contributions ADD COLUMN period_month INTEGER"))
            sync_conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_contribution_member_period "
                    "ON contributions (member_id, period_year, period_month)"
                )
            )

        if "votes" in insp.get_table_names():
            vote_cols = {c["name"] for c in insp.get_columns("votes")}
            if "results_published" not in vote_cols:
                sync_conn.execute(
                    text("ALTER TABLE votes ADD COLUMN results_published BOOLEAN DEFAULT FALSE")
                )
            if "results_published_at" not in vote_cols:
                sync_conn.execute(
                    text("ALTER TABLE votes ADD COLUMN results_published_at TIMESTAMPTZ")
                )

        if "welfare_cases" in insp.get_table_names():
            sync_conn.execute(
                text(
                    "UPDATE welfare_cases SET status = 'pending' "
                    "WHERE status IN ('created', 'executive_review')"
                )
            )
            sync_conn.execute(
                text(
                    "UPDATE welfare_cases SET status = 'allocated' "
                    "WHERE status = 'support_allocated'"
                )
            )

    await conn.run_sync(migrate)


async def warm_indexes(db: AsyncSession) -> None:
    await registry.rebuild(db)

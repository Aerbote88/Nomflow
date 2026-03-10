"""
Fix remaining migration issues:
1. UserSettings - re-insert all rows (clear conflict first)
2. LeaderboardEntry - read from SQLite using raw SQL (older schema missing list_id)
3. ChallengeSession - migrate
4. XpLog - migrate
"""
import os
import sqlite3
from sqlalchemy import create_engine, text, inspect
from sqlmodel import SQLModel, Session, select
from backend.models import UserSettings, LeaderboardEntry, ChallengeSession, XpLog
from backend.database import engine as supabase_engine
from dotenv import load_dotenv

load_dotenv()

SQLITE_PATH = "backend/learning.db"

def fix():
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cur = sqlite_conn.cursor()

    with supabase_engine.connect() as conn:

        # --- 1. UserSettings --- (already done, skip)
        if False:
        print("Fixing UserSettings...")
        conn.execute(text('DELETE FROM "usersettings"'))
        conn.commit()

        cur.execute("SELECT * FROM usersettings")
        rows = cur.fetchall()
        if rows:
            columns = [d[0] for d in cur.description]
            keys = [f'"{c}"' for c in columns]
            placeholders = [f":{c}" for c in columns]
            sql = text(f'INSERT INTO "usersettings" ({", ".join(keys)}) VALUES ({", ".join(placeholders)})')
            data = [dict(row) for row in rows]
            conn.execute(sql, data)
            conn.commit()
            conn.execute(text("SELECT setval(pg_get_serial_sequence('\"usersettings\"', 'id'), MAX(id)) FROM \"usersettings\";"))
            conn.commit()
            print(f"  Inserted {len(rows)} UserSettings rows")
        else:
            print("  No UserSettings rows in SQLite")

        # --- 2. LeaderboardEntry ---
        print("Fixing LeaderboardEntry...")
        conn.execute(text('DELETE FROM "leaderboardentry"'))
        conn.commit()

        cur.execute("PRAGMA table_info(leaderboardentry)")
        sqlite_cols = [r["name"] for r in cur.fetchall()]
        print(f"  SQLite leaderboardentry columns: {sqlite_cols}")

        cur.execute("SELECT * FROM leaderboardentry")
        rows = cur.fetchall()
        if rows:
            # Get model columns and only use ones that exist in SQLite
            model_cols = [c.key for c in inspect(LeaderboardEntry).mapper.column_attrs]
            usable_cols = [c for c in model_cols if c in sqlite_cols]
            missing_cols = [c for c in model_cols if c not in sqlite_cols]
            print(f"  Missing columns (will use NULL): {missing_cols}")

            keys = [f'"{c}"' for c in usable_cols]
            placeholders = [f":{c}" for c in usable_cols]
            sql = text(f'INSERT INTO "leaderboardentry" ({", ".join(keys)}) VALUES ({", ".join(placeholders)})')
            data = [{c: dict(row).get(c) for c in usable_cols} for row in rows]
            conn.execute(sql, data)
            conn.commit()
            conn.execute(text("SELECT setval(pg_get_serial_sequence('\"leaderboardentry\"', 'id'), MAX(id)) FROM \"leaderboardentry\";"))
            conn.commit()
            print(f"  Inserted {len(rows)} LeaderboardEntry rows")
        else:
            print("  No LeaderboardEntry rows in SQLite")

        # --- 3. ChallengeSession ---
        print("Fixing ChallengeSession...")
        conn.execute(text('DELETE FROM "challengesession"'))
        conn.commit()

        cur.execute("PRAGMA table_info(challengesession)")
        sqlite_cols = [r["name"] for r in cur.fetchall()]
        cur.execute("SELECT * FROM challengesession")
        rows = cur.fetchall()
        if rows:
            model_cols = [c.key for c in inspect(ChallengeSession).mapper.column_attrs]
            usable_cols = [c for c in model_cols if c in sqlite_cols]
            keys = [f'"{c}"' for c in usable_cols]
            placeholders = [f":{c}" for c in usable_cols]
            sql = text(f'INSERT INTO "challengesession" ({", ".join(keys)}) VALUES ({", ".join(placeholders)})')
            data = [{c: dict(row).get(c) for c in usable_cols} for row in rows]
            conn.execute(sql, data)
            conn.commit()
            print(f"  Inserted {len(rows)} ChallengeSession rows")
        else:
            print("  No ChallengeSession rows in SQLite")

        # --- 4. XpLog ---
        print("Fixing XpLog...")
        conn.execute(text('DELETE FROM "xplog"'))
        conn.commit()

        cur.execute("PRAGMA table_info(xplog)")
        sqlite_cols = [r["name"] for r in cur.fetchall()]
        # Only include rows whose user_id exists in the user table (skip deleted users)
        cur.execute("SELECT * FROM xplog WHERE user_id IN (SELECT id FROM user)")
        rows = cur.fetchall()
        if rows:
            model_cols = [c.key for c in inspect(XpLog).mapper.column_attrs]
            usable_cols = [c for c in model_cols if c in sqlite_cols]
            keys = [f'"{c}"' for c in usable_cols]
            placeholders = [f":{c}" for c in usable_cols]
            sql = text(f'INSERT INTO "xplog" ({", ".join(keys)}) VALUES ({", ".join(placeholders)})')

            batch_size = 500
            total = len(rows)
            for i in range(0, total, batch_size):
                batch = rows[i:i+batch_size]
                data = [{c: dict(row).get(c) for c in usable_cols} for row in batch]
                conn.execute(sql, data)
                conn.commit()
                print(f"  XpLog batch {i//batch_size + 1}/{(total-1)//batch_size + 1}")
            conn.execute(text("SELECT setval(pg_get_serial_sequence('\"xplog\"', 'id'), MAX(id)) FROM \"xplog\";"))
            conn.commit()
            print(f"  Inserted {total} XpLog rows")
        else:
            print("  No XpLog rows in SQLite")

    sqlite_conn.close()
    print("\nFix complete!")

if __name__ == "__main__":
    fix()

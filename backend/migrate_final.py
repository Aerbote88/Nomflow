import os
import sqlite3
import traceback
from sqlalchemy import create_engine, text, inspect
from sqlmodel import SQLModel, Session, select
from backend.models import (
    User, UserSettings, SourceText, Line, Character,
    Expression, ExpressionCharacter, UserProgress,
    StudyList, StudyListItem, LeaderboardEntry, ChallengeSession, XpLog
)
from backend.database import engine as supabase_engine
from dotenv import load_dotenv

load_dotenv()

# Local SQLite setup
sqlite_url = "sqlite:///learning.db"
local_engine = create_engine(sqlite_url)

def migrate():
    # 1. Clean up and Ensure tables exist in Supabase
    print("Dropping and Recreating tables in Supabase (with CASCADE)...")
    with supabase_engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE;CREATE SCHEMA public;GRANT ALL ON SCHEMA public TO postgres;GRANT ALL ON SCHEMA public TO public;"))
        conn.commit()
    
    print("Recreating clean tables...")
    SQLModel.metadata.create_all(supabase_engine)

    # 2. Migration Order
    models = [
        User,
        SourceText,
        Character,
        Expression,
        ExpressionCharacter,
        Line,
        UserSettings,
        UserProgress,
        StudyList,
        StudyListItem,
        LeaderboardEntry,
        ChallengeSession,
        XpLog
    ]

    with Session(local_engine) as local_session:
        for model in models:
            items = local_session.exec(select(model)).all()
            print(f"Migrating {model.__name__} ({len(items)} items)...")
            if not items:
                print(f"  SKIPPING {model.__name__} (no items)")
                continue
            
            # Get columns correctly
            columns = [c.key for c in inspect(model).mapper.column_attrs]
            table_name = model.__tablename__

            # Use raw SQL to preserve IDs and avoid ORM overrides
            with supabase_engine.connect() as conn:
                # Prepare the INSERT statement
                keys = [f'"{k}"' for k in columns]
                placeholders = [f":{k}" for k in columns]
                sql = text(f'INSERT INTO "{table_name}" ({", ".join(keys)}) VALUES ({", ".join(placeholders)})')
                
                # Batch processing
                batch_size = 100
                for i in range(0, len(items), batch_size):
                    batch = items[i:i + batch_size]
                    batch_data = []
                    for item in batch:
                        item_data = {k: getattr(item, k) for k in columns if hasattr(item, k)}
                        batch_data.append(item_data)
                    
                    try:
                        conn.execute(sql, batch_data)
                        conn.commit()
                        print(f"  Completed batch {i//batch_size + 1}/{(len(items)-1)//batch_size + 1}")
                    except Exception as e:
                        conn.rollback()
                        print(f"  FAILED to insert batch in {model.__name__}: {str(e)[:500]}")
                        # If a batch fails, we might want to try item by item to pinpoint the issue
                        for d in batch_data:
                            try:
                                conn.execute(sql, d)
                                conn.commit()
                            except Exception as item_e:
                                conn.rollback()
                                print(f"    Item failed: {str(item_e)[:200]}")
                
                # Update the sequence after manual ID insertion (PostgreSQL specific)
                try:
                    conn.execute(text(f"SELECT setval(pg_get_serial_sequence('\"{table_name}\"', 'id'), MAX(id)) FROM \"{table_name}\";"))
                    conn.commit()
                except Exception:
                    # Some tables might not have a serial id or it might fail if table is empty
                    conn.rollback()

    print("Migration finished!")

if __name__ == "__main__":
    migrate()

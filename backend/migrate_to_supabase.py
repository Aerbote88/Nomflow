import os
from urllib.parse import quote_plus
from sqlmodel import SQLModel, Session, create_engine, select
from backend.models import (
    User, UserSettings, SourceText, Line, Character,
    Expression, ExpressionCharacter, UserProgress,
    StudyList, StudyListItem, LeaderboardEntry, ChallengeSession, XpLog
)
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text, inspect
from sqlmodel import SQLModel, Session, select, Relationship
from backend.models import (
    User, UserSettings, SourceText, Line, Character,
    Expression, ExpressionCharacter, UserProgress,
    StudyList, StudyListItem, LeaderboardEntry, ChallengeSession, XpLog
)
from backend.database import engine as supabase_engine
# Local SQLite setup
sqlite_url = "sqlite:///learning.db"
local_engine = create_engine(sqlite_url)

import traceback

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
            
            # Using a fresh session for each model to avoid state bleed
            with Session(supabase_engine) as supabase_session:
                batch_size = 100
                # Get only the keys for database columns
                columns = [c.key for c in inspect(model).mapper.column_attrs]
                
                for i in range(0, len(items), batch_size):
                    batch = items[i:i + batch_size]
                    for item in batch:
                        try:
                            clean_data = {k: getattr(item, k) for k in columns if hasattr(item, k)}
                            new_item = model(**clean_data)
                            supabase_session.add(new_item)
                        except Exception as e:
                             print(f"  Error preparing item in {model.__name__}: {e}")
                             traceback.print_exc()
                    
                    try:
                        supabase_session.commit()
                        print(f"  Completed batch {i//batch_size + 1}/{(len(items)-1)//batch_size + 1}")
                    except Exception as e:
                        supabase_session.rollback()
                        print(f"  FAILED to commit batch in {model.__name__}:")
                        traceback.print_exc()
                
                print(f"  Successfully finished {model.__name__}.")

if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        print("ERROR: DATABASE_URL not found in environment.")
    else:
        migrate()

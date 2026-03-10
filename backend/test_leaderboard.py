import os
import traceback
from sqlmodel import Session, select, create_engine
from backend.models import LeaderboardEntry, User, SourceText, StudyList
from backend.database import engine as supabase_engine

# Local SQLite setup
sqlite_url = "sqlite:///learning.db"
local_engine = create_engine(sqlite_url)

def test_leaderboard_migration():
    print("Testing LeaderboardEntry migration...")
    with Session(local_engine) as local_session:
        with Session(supabase_engine) as supabase_session:
            items = local_session.exec(select(LeaderboardEntry)).all()
            print(f"Found {len(items)} local items.")
            
            for item in items:
                try:
                    data = item.model_dump()
                    clean_data = {k: v for k, v in data.items() if not k.startswith('_') and not isinstance(v, (list, dict))}
                    print(f"  Preparing item: {clean_data}")
                    new_item = LeaderboardEntry(**clean_data)
                    supabase_session.add(new_item)
                except Exception as e:
                    print(f"  PREPARE ERROR: {e}")
            
            try:
                print("  Committing...")
                supabase_session.commit()
                print("  SUCCESS")
            except Exception as e:
                supabase_session.rollback()
                print("  COMMIT FAILED:")
                traceback.print_exc()

if __name__ == "__main__":
    test_leaderboard_migration()

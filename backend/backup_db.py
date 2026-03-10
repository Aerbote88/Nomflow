import os
import json
import base64
import resend
from datetime import datetime
from sqlmodel import Session, select
from .database import engine
from .models import (
    User, Line, SourceText, UserProgress, UserSettings,
    StudyList, StudyListItem, LeaderboardEntry, ChallengeSession,
    XpLog, Character, Expression, ExpressionCharacter, Feedback
)

BACKUP_EMAIL = os.getenv("BACKUP_EMAIL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "backup@nomflow.app")

TABLES = [
    ("users", User),
    ("lines", Line),
    ("source_texts", SourceText),
    ("user_progress", UserProgress),
    ("user_settings", UserSettings),
    ("study_lists", StudyList),
    ("study_list_items", StudyListItem),
    ("leaderboard_entries", LeaderboardEntry),
    ("challenge_sessions", ChallengeSession),
    ("xp_logs", XpLog),
    ("characters", Character),
    ("expressions", Expression),
    ("expression_characters", ExpressionCharacter),
    ("feedback", Feedback),
]


def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def perform_backup():
    if not BACKUP_EMAIL:
        print("Backup skipped: BACKUP_EMAIL not set")
        return
    if not RESEND_API_KEY:
        print("Backup skipped: RESEND_API_KEY not set")
        return

    print(f"Starting Postgres backup: {datetime.now()}")
    backup = {}

    try:
        with Session(engine) as session:
            for table_name, model in TABLES:
                try:
                    rows = session.exec(select(model)).all()
                    backup[table_name] = [row.model_dump() for row in rows]
                    print(f"  {table_name}: {len(rows)} rows")
                except Exception as e:
                    print(f"  {table_name}: failed ({e})")
                    backup[table_name] = []
    except Exception as e:
        print(f"Backup failed during DB export: {e}")
        return

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"nomflow_backup_{timestamp}.json"
    content = json.dumps(backup, default=serialize, indent=2)
    encoded = base64.b64encode(content.encode()).decode()

    try:
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": BACKUP_EMAIL,
            "subject": f"NômFlow DB Backup — {timestamp}",
            "html": f"<p>Automated daily backup attached.</p><p>Tables: {', '.join(backup.keys())}</p>",
            "attachments": [{"filename": filename, "content": encoded}],
        })
        print(f"Backup emailed to {BACKUP_EMAIL}")
    except Exception as e:
        print(f"Backup email failed: {e}")


if __name__ == "__main__":
    perform_backup()

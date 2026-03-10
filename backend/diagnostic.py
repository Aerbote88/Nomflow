import os
from sqlmodel import Session, select, func
from backend.models import (
    User, UserSettings, SourceText, Line, Character,
    Expression, ExpressionCharacter, UserProgress,
    StudyList, StudyListItem, LeaderboardEntry, ChallengeSession, XpLog
)
from backend.database import engine

def diagnostic():
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
    
    print("Row counts in Supabase:")
    with Session(engine) as session:
        for model in models:
            try:
                count = session.exec(select(func.count()).select_from(model)).one()
                print(f"{model.__name__}: {count}")
            except Exception as e:
                print(f"{model.__name__}: ERROR - {e}")

if __name__ == "__main__":
    diagnostic()

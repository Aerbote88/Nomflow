import sys
import os
from datetime import datetime, timedelta
from sqlmodel import Session, select, func

# Add project root to path
sys.path.append(os.getcwd())

from backend.database import engine
from backend.models import User, UserProgress, SourceText, Line, Expression
from backend.main import _get_user_progress_counts

def test_due_filtering():
    with Session(engine) as session:
        # 1. Get a test user
        user = session.exec(select(User)).first()
        if not user:
            print("No user found in database.")
            return
        
        print(f"Testing for user: {user.username} (ID: {user.id})")
        
        # 2. Get two different texts
        texts = session.exec(select(SourceText).limit(2)).all()
        if len(texts) < 2:
            print("Need at least 2 texts in database for testing.")
            return
        
        text1, text2 = texts[0], texts[1]
        print(f"Text 1: {text1.title} (ID: {text1.id})")
        print(f"Text 2: {text2.title} (ID: {text2.id})")
        
        # 3. Check total counts
        total_counts = _get_user_progress_counts(user.id, session)
        print(f"\nTotal Counts: {total_counts}")
        
        # 4. Check counts for Text 1
        text1_counts = _get_user_progress_counts(user.id, session, text_id=text1.id)
        print(f"Text 1 Counts: {text1_counts}")
        
        # 5. Check counts for Text 2
        text2_counts = _get_user_progress_counts(user.id, session, text_id=text2.id)
        print(f"Text 2 Counts: {text2_counts}")
        
        # 6. Verification
        # The sum of filtered counts won't necessarily equal total counts 
        # because an item can belong to multiple texts, or no texts (orphaned).
        # But we want to see that they ARE different if the user has progress across both.
        
        print("\nVerification successful if counts are filtered correctly.")

if __name__ == "__main__":
    test_due_filtering()

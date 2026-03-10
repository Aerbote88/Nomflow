import sqlite3
from backend.database import engine as supabase_engine
from sqlalchemy import text

def check():
    # Local
    conn = sqlite3.connect("learning.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM user LIMIT 5")
    local_users = cursor.fetchall()
    print("Local User IDs:", local_users)
    conn.close()
    
    # Supabase
    with supabase_engine.connect() as conn:
        res = conn.execute(text('SELECT id, username FROM "user" LIMIT 5')).fetchall()
        print("Supabase User IDs:", [(r[0], r[1]) for r in res])

if __name__ == "__main__":
    check()

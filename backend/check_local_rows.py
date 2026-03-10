import sqlite3
import os

def check():
    conn = sqlite3.connect("learning.db")
    cursor = conn.cursor()
    tables = ["leaderboardentry", "challengesession", "xplog"]
    for t in tables:
        try:
            cursor.execute(f"SELECT count(*) FROM {t}")
            print(f"{t}: {cursor.fetchone()[0]}")
        except Exception as e:
            print(f"{t}: ERROR ({e})")
    conn.close()

if __name__ == "__main__":
    check()

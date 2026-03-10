import sqlite3
import os

def check():
    if not os.path.exists("learning.db"):
        print("learning.db not found")
        return
    conn = sqlite3.connect("learning.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    print("Local SQLite Tables:")
    for row in cursor.fetchall():
        print(f" - {row[0]}")
    conn.close()

if __name__ == "__main__":
    check()

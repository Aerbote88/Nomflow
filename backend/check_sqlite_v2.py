import sqlite3
import os

def check():
    conn = sqlite3.connect("learning.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Exact Local Tables:")
    for t in sorted(tables):
        print(f"'{t}'")
    conn.close()

if __name__ == "__main__":
    check()

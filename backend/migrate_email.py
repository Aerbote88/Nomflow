"""One-time migration: add email column to user table and create passwordresettoken table."""
import os
import sys
from dotenv import load_dotenv
from urllib.parse import quote_plus
import psycopg2

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# Re-encode password with special chars
if "://" in DATABASE_URL:
    prefix, rest = DATABASE_URL.split("://", 1)
    at_split = rest.rsplit("@", 1)
    if len(at_split) == 2:
        user_pass, host_port_db = at_split
        user_split = user_pass.split(":", 1)
        if len(user_split) == 2:
            username, password = user_split
            encoded_pass = quote_plus(password)
            DATABASE_URL = f"postgresql://{username}:{encoded_pass}@{host_port_db}"

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print("Running migrations...")

cur.execute("""
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email VARCHAR;
""")
print("  ✓ Added email column to user table")

cur.execute("""
    CREATE INDEX IF NOT EXISTS ix_user_email ON "user" (email);
""")
print("  ✓ Created index on user.email")

cur.execute("""
    CREATE TABLE IF NOT EXISTS passwordresettoken (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id),
        token VARCHAR NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
""")
print("  ✓ Created passwordresettoken table")

cur.execute("""
    CREATE INDEX IF NOT EXISTS ix_passwordresettoken_user_id ON passwordresettoken (user_id);
    CREATE INDEX IF NOT EXISTS ix_passwordresettoken_token ON passwordresettoken (token);
""")
print("  ✓ Created indexes on passwordresettoken")

cur.close()
conn.close()
print("\nDone! Restart your backend server.")

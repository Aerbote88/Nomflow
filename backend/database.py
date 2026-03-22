import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event
from sqlalchemy.engine import Engine

from urllib.parse import quote_plus
load_dotenv()

# Database Config
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Supabase/PostgreSQL
    if "://" in DATABASE_URL:
        prefix, rest = DATABASE_URL.split("://", 1)
        # Split from the right for the host to handle @ in passwords
        at_split = rest.rsplit("@", 1)
        if len(at_split) == 2:
            user_pass, host_port_db = at_split
            user_split = user_pass.split(":", 1)
            if len(user_split) == 2:
                username, password = user_split
                encoded_pass = quote_plus(password)
                DATABASE_URL = f"postgresql://{username}:{encoded_pass}@{host_port_db}"
            else:
                # Fallback to direct replacement if format is unexpected
                DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        else:
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
            
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20
    )
else:
    # Local SQLite
    sqlite_file_name = "learning.db"
    sqlite_url = f"sqlite:///{sqlite_file_name}"
    connect_args = {
        "check_same_thread": False,
        "timeout": 30  # 30 seconds busy timeout
    }
    engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

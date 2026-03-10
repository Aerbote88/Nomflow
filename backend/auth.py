from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from .models import User
from .main import get_session # Circular import? Avoid. Pass session to dep.
# Actually main probably imports auth. Need to be careful.
# Usually session dependency is defined in a shared valid module or locally.
# Let's redefine get_session or import from database module? 
# Currently everything is in main.py. I should probably move database init to database.py 
# but for now I will duplicate or just pass session.

# Logic configuration
SECRET_KEY = "CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_IN_PROD"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30000 # Long expiry for demo

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Dependency to get current user
# Need to import Session/engine. Ideally from a database.py.
# Since main.py has `engine`, I can't import main here easily without circular dep if main imports auth.
# Solution: Create database.py or put this in main.py?
# Putting in main.py makes it huge.
# Better: Create auth_utils.py just for util functions, and put dependency in main/auth_dep.py?
# Let's create `backend/auth.py` with utils, and define the dependency inside main.py explicitly or pass it around.
# Actually, I can put `get_current_user` here if I solve the session import.
# I'll modify the plan: Move engine/session logic to `backend/database.py` first to solve circular imports.


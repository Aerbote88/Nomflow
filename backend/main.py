from fastapi import FastAPI, Depends, HTTPException, Request, status, Response
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select, func, delete, text, union_all, literal_column, case, desc as sqlmodel_desc
from sqlalchemy import desc
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import os
import json
import unicodedata
import secrets
import resend
from jose import JWTError, jwt
import asyncio
import os
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .backup_db import perform_backup

from .database import get_session, create_db_and_tables
from .models import Line, UserProgress, UserSettings, StudyList, StudyListItem, User, SourceText, LeaderboardEntry, ChallengeSession, XpLog, Character, Expression, ExpressionCharacter, Feedback, PasswordResetToken, CharacterStrokes
from .srs_logic import calculate_review, get_review_intervals
from .auth import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM, oauth2_scheme

# Set up background scheduler
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing Database...")
    create_db_and_tables()

    print("Starting Automated Database Backups (Daily at 03:00)...")
    scheduler.add_job(
        perform_backup,
        CronTrigger(hour=3, minute=0),  # Run every day at 3:00 AM
        id="daily_db_backup",
        replace_existing=True
    )
    scheduler.start()

    # Warm the writing-practice character-sequence cache in the background so
    # the first user request is served from memory instead of hitting the DB.
    import asyncio
    async def _warm_writing_cache():
        try:
            from sqlmodel import Session
            from .database import engine
            with Session(engine) as s:
                texts = s.exec(select(SourceText)).all()
                for t in texts:
                    title = (t.title or "").lower()
                    if "kiều" in title or "kieu" in title:
                        get_text_character_sequence(t.id, s)
                        print(f"Warmed writing-practice cache for text_id={t.id} ({t.title})")
                        break
        except Exception as e:
            print(f"Writing-practice cache warm failed: {e}")
    asyncio.create_task(_warm_writing_cache())

    yield
    print("Shutting down scheduler...")
    scheduler.shutdown()

from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow requests from the frontend
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Maintenance Mode Middleware
@app.middleware("http")
async def maintenance_middleware(request: Request, call_next):
    # Skip for health check or if not enabled
    if request.url.path == "/api/health" or os.getenv("MAINTENANCE_MODE") != "true":
        return await call_next(request)
    
    # Return 503 for API calls
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=503,
            content={"detail": "Site is currently undergoing maintenance. Please check back later."},
            headers={"Retry-After": "3600"}
        )
    
    # Optional: Redirect web requests to /maintenance if they aren't /api or /maintenance
    if request.url.path != "/maintenance":
         return RedirectResponse(url="/maintenance")
         
    return await call_next(request)

# Enable GZIP compression for all responses > 1000 bytes (Huge performance boost for JSON arrays)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Only force JSON for /api/ routes
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    # Default behavior for other routes (HTML redirects, etc.)
    if exc.status_code == 401:
        return RedirectResponse(url="/login")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )

# --- Auth Dependency ---
async def get_current_user(request: Request, session: Session = Depends(get_session)):
    token = request.cookies.get("access_token")
    if not token:
        # Try Header
        auth_header = request.headers.get("Authorization")
        if auth_header:
            token = auth_header
    
    # If using Swagger UI, it sends Authorization: Bearer <token>
    # If using Cookie, we stored it as "Bearer <token>"
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Remove 'Bearer ' prefix
    if token.startswith("Bearer "):
        token = token.split(" ", 1)[1]
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception
    return user

async def get_optional_user(request: Request, session: Session = Depends(get_session)):
    token = request.cookies.get("access_token")
    if not token: return None
    if token.startswith("Bearer "): token = token.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username: return None
        return session.exec(select(User).where(User.username == username)).first()
    except JWTError:
        return None

# --- Auth Endpoints ---

class LoginResponse(BaseModel):
    username: str

@app.post("/api/token", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login_for_access_token(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    login_id = form_data.username.strip()
    user = session.exec(select(User).where(
        (User.username == login_id) | (User.email == login_id.lower())
    )).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(days=2)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 2,
        path="/",
    )
    return {"username": user.username}

@app.get("/api/logout")
def logout():
    response = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(key="access_token", path="/", httponly=True, secure=True, samesite="lax")
    return response

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8)
    email: str

RESERVED_USERNAMES = {"albert e"}

@app.post("/api/register")
@limiter.limit("5/hour")
def register(req: RegisterRequest, request: Request, session: Session = Depends(get_session)):
    if req.username.strip().lower() in RESERVED_USERNAMES:
        raise HTTPException(status_code=400, detail="Username already exists")
    existing = session.exec(select(User).where(User.username == req.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    clean_email = req.email.strip().lower()
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required.")
    email_taken = session.exec(select(User).where(User.email == clean_email)).first()
    if email_taken:
        raise HTTPException(status_code=400, detail="Email already in use.")

    hashed = get_password_hash(req.password)
    new_user = User(username=req.username, password_hash=hashed, email=clean_email)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    settings = UserSettings(user_id=new_user.id, daily_new_limit=10)
    session.add(settings)
    session.commit()
    
    return {"status": "created", "username": new_user.username}

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == req.email.lower().strip())).first()
    # Always return success to avoid email enumeration
    if not user:
        return {"status": "ok"}

    # Invalidate old tokens for this user
    old_tokens = session.exec(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.used == False)).all()
    for t in old_tokens:
        t.used = True
    session.commit()

    token_value = secrets.token_urlsafe(32)
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_value,
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    session.add(reset_token)
    session.commit()

    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={token_value}"

    try:
        resend.Emails.send({
            "from": os.environ.get("RESEND_FROM_EMAIL", "NômFlow <noreply@nomflow.app>"),
            "to": [req.email],
            "subject": "Reset your NômFlow password",
            "html": f"""
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #333;">
                    <h2 style="color: #d97706;">NômFlow Password Reset</h2>
                    <p>You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.</p>
                    <a href="{reset_link}" style="display:inline-block; margin: 24px 0; padding: 12px 28px; background: #d97706; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Reset Password
                    </a>
                    <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            """
        })
    except Exception as e:
        print(f"Email send error: {e}")

    return {"status": "ok"}

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, session: Session = Depends(get_session)):
    now = datetime.utcnow()
    token = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.token == req.token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now
        )
    ).first()

    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    user = session.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")

    user.password_hash = get_password_hash(req.new_password)
    token.used = True
    session.add(user)
    session.add(token)
    session.commit()

    return {"status": "ok"}

# Helper Models
class ReviewSubmission(BaseModel):
    item_id: int
    quality: int = Field(ge=0, le=3)

class DashboardStats(BaseModel):
    due_count: int
    learning_count: int
    learned_count: int
    points: int
    streak: int
    level: int
    next_level_xp: int
    level_progress: float
    active_source_name: Optional[str] = None
    active_source_type: Optional[str] = None
    curriculum_id: Optional[int] = None
    kieu_id: Optional[int] = None
    active_text_id: Optional[int] = None
    active_list_id: Optional[int] = None
    all_texts: List[dict] = []
    user_lists: List[dict] = []

# ...


class BrowseResponse(BaseModel):
    total_lines: int
    total_pages: int
    current_page: int
    text_title: Optional[str] = None
    author: Optional[str] = None
    is_curated: bool = False
    lines: List[dict]

class SettingsUpdate(BaseModel):
    daily_new_limit: int = Field(ge=1, le=200)
    active_list_id: Optional[int] = None

class CreateListRequest(BaseModel):
    name: str
    description: Optional[str] = None

class AddListItemRequest(BaseModel):
    item_type: str
    item_id: int

class FeedbackRequest(BaseModel):
    type: str  # "bug", "suggestion", "other"
    message: str


# --- User API ---
@app.get("/api/user/me")
def get_user_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "hide_from_leaderboard": user.hide_from_leaderboard
    }

class UserSettingsUpdate(BaseModel):
    email: Optional[str] = None
    hide_from_leaderboard: Optional[bool] = None

@app.post("/api/user/settings")
def update_user_settings(req: UserSettingsUpdate, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if req.email is not None:
        clean_email = req.email.strip().lower() or None
        if clean_email:
            existing = session.exec(select(User).where(User.email == clean_email, User.id != user.id)).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use.")
        user.email = clean_email
    if req.hide_from_leaderboard is not None:
        user.hide_from_leaderboard = req.hide_from_leaderboard
    session.add(user)
    session.commit()
    return {"status": "ok"}

@app.delete("/api/user")
def delete_account(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Permanently delete account and all associated data."""
    # 1. Delete Progress
    session.exec(delete(UserProgress).where(UserProgress.user_id == user.id))
    
    # 2. Delete Settings
    session.exec(delete(UserSettings).where(UserSettings.user_id == user.id))
    
    # 3. Delete Study Lists and Items
    user_lists = session.exec(select(StudyList).where(StudyList.user_id == user.id)).all()
    for lst in user_lists:
        session.exec(delete(StudyListItem).where(StudyListItem.study_list_id == lst.id))
        session.delete(lst)
        
    # 4. Delete Leaderboard Entries
    session.exec(delete(LeaderboardEntry).where(LeaderboardEntry.user_id == user.id))

    # 5. Delete Challenge Sessions
    session.exec(delete(ChallengeSession).where(ChallengeSession.user_id == user.id))

    # 6. Delete XP Log
    session.exec(delete(XpLog).where(XpLog.user_id == user.id))

    # 7. Delete User record
    session.delete(user)
    
    session.commit()
    return {"status": "account_deleted"}

# --- Dictionary Helpers ---

import string

def normalize_key(s: str) -> str:
    if not s: return ""
    # Strip, lower, remove punctuation
    s = s.strip().lower()
    extras = '“”‘’'
    translator = str.maketrans('', '', string.punctuation + extras)
    return s.translate(translator)

def get_or_create_dictionary_entry(session: Session, nom: str, qn: str):
    # Normalize for lookup
    nom_clean = nom.strip()
    qn_clean = qn.strip()
    qn_norm = normalize_key(qn_clean)
    
    # Try logic: 
    # 1. Exact match (fast path)
    # 2. Normalized match (if exact not found)
    
    # Optimizing: Let's search by Nom first (indexed), then filter by QN.
    # Because normalized QN is not indexed and computed.
    
    candidates = session.exec(select(Character).where(Character.nom_char == nom_clean)).all()
    target_entry = None
    
    for entry in candidates:
        if normalize_key(entry.quoc_ngu) == qn_norm:
            target_entry = entry
            break
            
    if not target_entry:
        # Create new
        # Use simple strip() for storage, but it will match normalized queries later
        target_entry = Character(nom_char=nom_clean, quoc_ngu=qn_clean, popularity=1)
        session.add(target_entry)
        session.commit()
        session.refresh(target_entry)
    else:
        # Update popularity?
        pass
        
    return target_entry

def get_or_create_line_dict(session: Session, nom_text: str, qn_text: str):
    # check if Expression exists
    line_dict = session.exec(select(Expression).where(Expression.nom_text == nom_text, Expression.quoc_ngu_text == qn_text)).first()
    
    if not line_dict:
        line_dict = Expression(nom_text=nom_text, quoc_ngu_text=qn_text)
        session.add(line_dict)
        session.commit()
        session.refresh(line_dict)
        # Character linking is handled by the caller via update_line_characters().

    return line_dict

def update_line_characters(session: Session, line_dict: Expression, nom_chars: List[str], qn_words: List[str]):
    # Clear existing links? Or assuming new line_dict means empty?
    # If line_dict is shared, we should NOT modify its characters unless we are sure.
    # WAIT: If Expression is "Immutable Unique Content", then we should trigger this ONLY on creation.
    # If we edit a line text, we are essentially switching to a different Expression ID.
    
    # Check if chars exist
    if not line_dict.characters:
        count = min(len(nom_chars), len(qn_words))
        for i in range(count):
            char_entry = get_or_create_dictionary_entry(session, nom_chars[i], qn_words[i])
            
            link = ExpressionCharacter(
                line_dict_id=line_dict.id,
                dictionary_id=char_entry.id,
                order_in_line=i
            )
            session.add(link)
        session.commit()

def cleanup_orphaned_line_dict(session: Session, line_dict_id: int):
    """
    Checks if a Expression is still used by any Line.
    If not, deletes it and checks its constituent dictionary entries for cleanup.
    """
    # 1. Check if used by any Line
    usage_count = session.exec(select(func.count(Line.id)).where(Line.line_dictionary_id == line_dict_id)).one()
    if usage_count > 0:
        return # Still in use
        
    line_dict = session.get(Expression, line_dict_id)
    if not line_dict: return
    
    # 2. Get constituent DictionaryEntries before deleting links
    # We need to know which characters *might* become orphans
    entries_to_check = []
    for link in line_dict.characters:
        if link.dictionary_entry:
            entries_to_check.append(link.dictionary_entry)
            
    # 3. Delete Expression (Cascades to ExpressionCharacter usually, but let's be safe)
    # Delete links first if no cascade
    session.exec(delete(ExpressionCharacter).where(ExpressionCharacter.line_dict_id == line_dict_id))
    
    # Delete UserProgress for this Expression (The Line Item itself)
    session.exec(delete(UserProgress).where(UserProgress.item_type == "line", UserProgress.item_id == line_dict_id))
    
    # Delete StudyListItem if in any lists
    session.exec(delete(StudyListItem).where(StudyListItem.item_type == "line", StudyListItem.item_id == line_dict_id))
    
    session.delete(line_dict)
    
    # 4. Check each Character for orphans
    for entry in entries_to_check:
        # Is this entry used by ANY other ExpressionCharacter?
        usage = session.exec(select(func.count(ExpressionCharacter.id)).where(ExpressionCharacter.dictionary_id == entry.id)).one()
        
        if usage == 0:
            # Orphaned Character!
            # Delete UserProgress for this Character
            session.exec(delete(UserProgress).where(UserProgress.item_type == "character", UserProgress.item_id == entry.id))
            
            # Delete StudyListItem
            session.exec(delete(StudyListItem).where(StudyListItem.item_type == "character", StudyListItem.item_id == entry.id))
            
            session.delete(entry)
            
    session.commit()

class LineUpdateRequest(BaseModel):
    nom_text: str
    quoc_ngu_text: str

@app.put("/api/lines/{line_id}")
def update_line(line_id: int, req: LineUpdateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    line = session.get(Line, line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
        
    old_line_dict_id = line.line_dictionary_id
    old_line_dict = session.get(Expression, old_line_dict_id) if old_line_dict_id else None

    # 1. Get or Create Master Line
    line_dict = get_or_create_line_dict(session, req.nom_text, req.quoc_ngu_text)
    
    # Transfer translation and analysis if missing
    if old_line_dict and old_line_dict.english_translation and not line_dict.english_translation:
        line_dict.english_translation = old_line_dict.english_translation
        session.add(line_dict)
    if old_line_dict and old_line_dict.analysis and not line_dict.analysis:
        line_dict.analysis = old_line_dict.analysis
        session.add(line_dict)

    # 2. Populate characters if new (Automation)
    nom_chars = [c for c in req.nom_text if c.strip()]
    qn_words = req.quoc_ngu_text.split()
    update_line_characters(session, line_dict, nom_chars, qn_words)
    
    # 3. Update Line to point to new Dict
    line.line_dictionary_id = line_dict.id
    session.add(line)
    
    # Transfer StudyListItems and UserProgress to prevent data loss
    if old_line_dict_id and old_line_dict_id != line_dict.id:
        list_items = session.exec(select(StudyListItem).where(StudyListItem.item_type == "line", StudyListItem.item_id == old_line_dict_id)).all()
        for li in list_items:
            existing = session.exec(select(StudyListItem).where(StudyListItem.study_list_id == li.study_list_id, StudyListItem.item_type == "line", StudyListItem.item_id == line_dict.id)).first()
            if not existing:
                li.item_id = line_dict.id
                session.add(li)
            else:
                session.delete(li)
                
        user_progresses = session.exec(select(UserProgress).where(UserProgress.item_type == "line", UserProgress.item_id == old_line_dict_id)).all()
        for up in user_progresses:
            existing_up = session.exec(select(UserProgress).where(UserProgress.user_id == up.user_id, UserProgress.item_type == "line", UserProgress.item_id == line_dict.id)).first()
            if not existing_up:
                up.item_id = line_dict.id
                session.add(up)
            else:
                session.delete(up)

    session.commit()
    
    # CLEANUP OLD DICTIONARY IF ORPHANED
    if old_line_dict_id and old_line_dict_id != line_dict.id:
        cleanup_orphaned_line_dict(session, old_line_dict_id)
        
    return {"status": "updated", "char_count": len(nom_chars)}

@app.delete("/api/lines/{line_id}")
def delete_line(line_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    line = session.get(Line, line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
        
    text_id = line.text_id
    line_num = line.line_number
    line_dict_id = line.line_dictionary_id
    
    # We delete the Line pointer.
    # We do NOT delete the underlying Expression or DictionaryEntries (they are persistent).
    session.delete(line)
    
    # Shift remaining lines up
    session.exec(
        text("UPDATE line SET line_number = line_number - 1 WHERE text_id = :tid AND line_number > :ln")
        .bindparams(tid=text_id, ln=line_num)
    )
    
    session.commit()
    
    # Cleanup Dictionary if Orphaned
    if line_dict_id:
        cleanup_orphaned_line_dict(session, line_dict_id)
        
    return {"status": "deleted"}

class InsertLineRequest(BaseModel):
    line_number: int
    nom_text: str = ""
    quoc_ngu_text: str = ""

@app.post("/api/texts/{text_id}/insert_line")
def insert_line(text_id: int, req: InsertLineRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    # 1. Shift lines down
    session.exec(
        text("UPDATE line SET line_number = line_number + 1 WHERE text_id = :tid AND line_number >= :ln")
        .bindparams(tid=text_id, ln=req.line_number)
    )
    
    # 2. Prepare Dict
    line_dict = get_or_create_line_dict(session, req.nom_text, req.quoc_ngu_text)
    
    if req.nom_text and req.quoc_ngu_text:
        nom_chars = [c for c in req.nom_text if c.strip()]
        qn_words = req.quoc_ngu_text.split()
        update_line_characters(session, line_dict, nom_chars, qn_words)

    # 3. Insert new line
    new_line = Line(
        text_id=text_id,
        line_number=req.line_number,
        line_dictionary_id=line_dict.id
    )
    session.add(new_line)
    session.commit()
    
    return {"status": "inserted", "line_id": new_line.id}

class CreateLineRequest(BaseModel):
    nom_text: str
    quoc_ngu_text: str

@app.post("/api/texts/{text_id}/lines")
def add_line(text_id: int, req: CreateLineRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    text_obj = session.get(SourceText, text_id)
    if not text_obj:
        raise HTTPException(status_code=404, detail="Text not found")

    # Get max line number
    max_ln = session.exec(select(func.max(Line.line_number)).where(Line.text_id == text_id)).first()
    next_ln = (max_ln or 0) + 1

    line_dict = get_or_create_line_dict(session, req.nom_text, req.quoc_ngu_text)

    if req.nom_text and req.quoc_ngu_text:
        nom_chars = [c for c in req.nom_text if c.strip()]
        qn_words = req.quoc_ngu_text.split()
        update_line_characters(session, line_dict, nom_chars, qn_words)

    new_line = Line(
        text_id=text_id,
        line_number=next_ln,
        line_dictionary_id=line_dict.id
    )
    session.add(new_line)
    session.commit()

    return {"status": "created", "id": new_line.id}

class UpdateLineDictRequest(BaseModel):
    english_translation: Optional[str] = None

@app.put("/api/line-dict/{line_dict_id}")
def update_line_dict(line_dict_id: int, req: UpdateLineDictRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    line_dict = session.get(Expression, line_dict_id)
    if not line_dict:
        raise HTTPException(status_code=404, detail="Expression not found")
    
    if req.english_translation is not None:
        line_dict.english_translation = req.english_translation
        session.add(line_dict)
        session.commit()
    
    return {"status": "updated", "id": line_dict_id}

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.post("/api/user/password")
def update_password(req: ChangePasswordRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not verify_password(req.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect old password")
        
    user.password_hash = get_password_hash(req.new_password)
    session.add(user)
    session.commit()
    
    return {"status": "ok", "message": "Password updated successfully"}

# --- API Routes ---

@app.get("/api/texts", response_model=List[SourceText])
def get_texts(session: Session = Depends(get_session)):
    return session.exec(select(SourceText)).all()

# ... (Dashboard unchanged) ...

@app.get("/api/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(
    text_id: Optional[int] = None,
    list_id: Optional[int] = None,
    user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    try:
        now = datetime.utcnow()

        counts = _get_user_progress_counts(user.id, session, text_id=text_id, list_id=list_id)
        due_count = counts["due"]
        learning_count = counts["learning"]
        learned_count = counts["learned"]

        settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
        if not settings:
            settings = UserSettings(user_id=user.id)
            session.add(settings)
            session.commit()
            session.refresh(settings)

        current_xp = settings.total_xp
        level = 1 + int(current_xp ** 0.5) // 3
        next_level_xp = 9 * (level ** 2)
        current_level_start_xp = 9 * ((level - 1) ** 2)
        if next_level_xp == current_level_start_xp:
            progress_percent = 0.0
        else:
            progress_percent = (current_xp - current_level_start_xp) / (next_level_xp - current_level_start_xp)
        progress_percent = min(max(progress_percent, 0.0), 1.0)

        # Fetch all texts once — reuse for active source, onboarding IDs, and custom study list
        all_texts = session.exec(select(SourceText)).all()
        texts_by_id = {t.id: t for t in all_texts}

        active_source_name = None
        active_source_type = None
        if settings.active_list_id:
            lst = session.get(StudyList, settings.active_list_id)
            if lst:
                active_source_name = lst.name
                active_source_type = "List"
        elif settings.active_text_id:
            txt = texts_by_id.get(settings.active_text_id)
            if txt:
                active_source_name = txt.title
                active_source_type = "Curated List" if txt.author in ["Chunom.org", "Digitizing Vietnam Team"] else "Classic Text"

        # Find onboarding IDs in Python — no extra queries
        curriculum = next((t for t in all_texts if "Standard Nôm Curriculum" in t.title), None)
        kieu = next((t for t in all_texts if "Truyện Kiều" in t.title), None)

        user_lists = session.exec(select(StudyList).where(StudyList.user_id == user.id)).all()

        return DashboardStats(
            due_count=due_count,
            learning_count=learning_count,
            learned_count=learned_count,
            points=settings.total_xp,
            streak=settings.current_streak,
            level=level,
            next_level_xp=next_level_xp,
            level_progress=progress_percent,
            active_source_name=active_source_name,
            active_source_type=active_source_type,
            curriculum_id=curriculum.id if curriculum else None,
            kieu_id=kieu.id if kieu else None,
            active_text_id=settings.active_text_id,
            active_list_id=settings.active_list_id,
            all_texts=[{"id": t.id, "title": t.title} for t in all_texts],
            user_lists=[{"id": l.id, "name": l.name} for l in user_lists]
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/study/next")
def get_next_study_item(
    mode: str = "srs",
    list_id: Optional[int] = None,
    text_id: Optional[int] = None,
    count: int = 1,
    seen: Optional[str] = None,
    custom_params: Optional[str] = None,
    all: Optional[bool] = False,
    user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    # Common Parameter Parsing
    target_list_id = list_id
    target_text_id = text_id
    target_item_type = None
    
    if custom_params:
        for p in custom_params.split(','):
            if p.startswith('type:'):
                target_item_type = p.split(':')[1]

    # 1. Random Mode Implementation
    if mode == "random":
        results = []
        import random

        # Content Type Filtering handled at function level

        # Parse seen items to exclude
        excluded = set()
        if seen:
            for s in seen.split(','):
                try:
                    t, i = s.split(':', 1)
                    excluded.add((t, int(i)))
                except: pass

        if target_list_id:
            # Optimized sampling for Lists
            query = select(StudyListItem.item_type, StudyListItem.item_id).where(StudyListItem.study_list_id == target_list_id)
            if excluded:
                # Filter out seen items using explicit exclusions for best compatibility
                for t, i in excluded:
                    query = query.where(~((StudyListItem.item_type == t) & (StudyListItem.item_id == i)))
            
            choices = session.exec(query.order_by(func.random()).limit(count)).all()
            for choice_type, choice_id in choices:
                results.append((choice_type, choice_id))
                
        elif target_text_id:
            # Combine all candidate types into a single query based on selection
            queries = []
            if not target_item_type or target_item_type == "line":
                queries.append(select(literal_column("'line'").label("item_type"), Line.line_dictionary_id.label("item_id")).where(Line.text_id == target_text_id, Line.line_dictionary_id != None))
            
            if not target_item_type or target_item_type == "character":
                # For characters, combine both sources
                queries.append(select(literal_column("'character'").label("item_type"), Line.dictionary_id.label("item_id")).where(Line.text_id == target_text_id, Line.dictionary_id != None))
                queries.append(select(literal_column("'character'").label("item_type"), ExpressionCharacter.dictionary_id.label("item_id")).join(Line, Line.line_dictionary_id == ExpressionCharacter.line_dict_id).where(Line.text_id == target_text_id))
            
            if not queries:
                return {"status": "done", "message": "No matching content types found."}
            
            # Optimize: Sample from each query separately then combine
            all_choices = []
            
            # Apply seen filter if needed
            seen_set = set()
            if seen:
                for s in seen.split(','):
                    seen_set.add(s)
            
            for query in queries:
                # Get more than needed from each source, then we'll randomly pick
                choices = session.exec(query.order_by(func.random()).limit(count * 2)).all()
                
                # Filter out seen items in Python (simpler than SQL)
                for choice_type, choice_id in choices:
                    item_key = f"{choice_type}:{choice_id}"
                    if item_key not in seen_set:
                        all_choices.append((choice_type, choice_id))
            
            # Deduplicate and pick the requested count
            results_set = set()
            random.shuffle(all_choices)
            for choice_type, choice_id in all_choices:
                if len(results_set) >= count: break
                results_set.add((choice_type, choice_id))
            
            for item in results_set:
                results.append(item)
        
        else:
            # ALL SOURCES Random Sampling
            queries = []
            
            if not target_item_type or target_item_type == "line":
                queries.append(select(literal_column("'line'").label("item_type"), Expression.id.label("item_id")))
            if not target_item_type or target_item_type == "character":
                queries.append(select(literal_column("'character'").label("item_type"), Character.id.label("item_id")))
            
            if not queries:
                 return {"status": "done", "message": "No matching content types found."}

            all_choices = []
            
            # Apply seen filter if needed
            seen_set = set()
            if seen:
                for s in seen.split(','):
                    seen_set.add(s)
            
            for query in queries:
                # Optimized sampling: get a pool from each type
                # For "All Sources", we use a much larger pool but still limited
                pool_size = count * 20
                choices = session.exec(query.order_by(func.random()).limit(pool_size)).all()
                
                # Filter out seen items in Python
                for choice_type, choice_id in choices:
                    item_key = f"{choice_type}:{choice_id}"
                    if item_key not in seen_set:
                        all_choices.append((choice_type, choice_id))
            
            # Deduplicate and pick the requested count
            results_set = set()
            random.shuffle(all_choices)
            for choice_type, choice_id in all_choices:
                if len(results_set) >= count: break
                results_set.add((choice_type, choice_id))
            
            for item in results_set:
                results.append(item)
        
        if not results:
            return {"status": "done", "message": "No studyable items found in this source."}
        
        # Build contents for all selected items
        # 1. Bulk fetch existing UserProgress
        existing_progress_map = {}
        if results:
            # We can use a tuple-in query for multi-column matching in some DBs,
            # but for broadest compatibility we'll use OR or just filter in Python if count is small.
            # Since count is usually 20, we can just fetch all for the user and filter.
            # Better: Filter by the set of IDs and types.
            char_ids = [r[1] for r in results if r[0] == "character"]
            line_ids = [r[1] for r in results if r[0] == "line"]
            
            p_list = []
            if char_ids:
                p_list.extend(session.exec(select(UserProgress).where(UserProgress.user_id == user.id, UserProgress.item_type == "character", UserProgress.item_id.in_(char_ids))).all())
            if line_ids:
                p_list.extend(session.exec(select(UserProgress).where(UserProgress.user_id == user.id, UserProgress.item_type == "line", UserProgress.item_id.in_(line_ids))).all())
            
            for p in p_list:
                existing_progress_map[(p.item_type, p.item_id)] = p

        progress_items = []
        for choice_type, choice_id in results:
            prog = existing_progress_map.get((choice_type, choice_id))
            if not prog:
                # Mock object – not added to session
                prog = UserProgress(
                    user_id=user.id,
                    item_type=choice_type,
                    item_id=choice_id,
                    is_learning=True,
                    next_review_due=datetime.utcnow(),
                    interval=0.0,
                    ease_factor=2.5
                )
            progress_items.append(prog)
        
        if progress_items:
            # Note: No session.flush() here as we want mocks to remain ephemeral
            batch_response = _get_content_batch(progress_items, session, preferred_text_id=target_text_id if target_text_id else None)
            for content in batch_response:
                content["is_new"] = False
                content["is_practice"] = True
        else:
            batch_response = []
        
        if not batch_response:
             return {"status": "done", "message": "Failed to load content for selected items."}
             
        return batch_response if count > 1 else batch_response[0]

    # 2. Regular SRS Mode
    # Use provided list_id/text_id or fall back to user settings
    total_due = 0
    settings = None
    
    if not target_list_id and not target_text_id:
        settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
        if settings:
            target_list_id = settings.active_list_id
            target_text_id = settings.active_text_id

    # If still no source, fall back to default text and persist it
    if not target_list_id and not target_text_id:
        default_text = session.exec(select(SourceText).where(SourceText.title == "Truyện Kiều")).first()
        if default_text:
            target_text_id = default_text.id
            if not settings:
                settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
            if settings:
                settings.active_text_id = target_text_id
                session.add(settings)
                session.commit()

    # Initialize base query for due items
    review_query = select(UserProgress).where(
        UserProgress.user_id == user.id,
        UserProgress.next_review_due <= datetime.utcnow()
    )

    # Only apply expensive source filtering if text_id or list_id was EXPLICITLY provided (not from settings)
    # This keeps Comprehensive Study fast while enabling Custom Study filtering
    if list_id:
        # Join with StudyListItem to filter
        review_query = review_query.join(
            StudyListItem, 
            (UserProgress.item_type == StudyListItem.item_type) & 
            (UserProgress.item_id == StudyListItem.item_id)
        ).where(StudyListItem.study_list_id == target_list_id)
    elif text_id:
        # Optimized EXISTS approach for SQLite
        from sqlmodel import exists

        review_query = review_query.where(
            (
                (UserProgress.item_type == "character") & 
                (
                    exists().where(Line.text_id == text_id, Line.dictionary_id == UserProgress.item_id) |
                    exists().where(Line.text_id == text_id, Line.line_dictionary_id == ExpressionCharacter.line_dict_id, ExpressionCharacter.dictionary_id == UserProgress.item_id)
                )
            ) | (
                (UserProgress.item_type == "line") & 
                (exists().where(Line.text_id == text_id, Line.line_dictionary_id == UserProgress.item_id))
            )
        )
    
    # Calculate total due count AFTER source filtering is applied
    total_due = session.exec(select(func.count()).select_from(review_query.subquery())).one()
    
    # Parse seen items into a set for reuse (also applied to new items below)
    excluded_set: set = set()
    if seen:
        print(f"[Study API] Received seen parameter: {seen}")
        excluded_items = []
        for s in seen.split(','):
            try:
                item_type, item_id = s.split(':', 1)
                excluded_items.append((item_type, int(item_id)))
                excluded_set.add((item_type, int(item_id)))
            except Exception as e:
                print(f"[Study API] Failed to parse seen item '{s}': {e}")
                pass

        if excluded_items:
            print(f"[Study API] Excluding {len(excluded_items)} seen items from query")
            # Build exclusion conditions for due items
            for item_type, item_id in excluded_items:
                review_query = review_query.where(
                    ~((UserProgress.item_type == item_type) & (UserProgress.item_id == item_id))
                )
        else:
            print(f"[Study API] No valid excluded items parsed")
    else:
        print(f"[Study API] No seen parameter provided")
    
    # Note: Source filtering already applied above if list_id or text_id provided
    
    # To prevent duplicate items (same item_type + item_id), we need to deduplicate
    # Use the subquery columns explicitly to avoid confusion with the base table
    review_sub = review_query.subquery()
    
    dedup_subquery = (
        select(
            func.min(review_sub.c.id).label('min_id')
        )
        .select_from(review_sub)
        .group_by(review_sub.c.item_type, review_sub.c.item_id)
        .order_by(func.min(review_sub.c.next_review_due))
        .limit(count)
        .subquery()
    )
    
    # Now get the actual UserProgress records with those IDs
    due_items = session.exec(
        select(UserProgress)
        .where(UserProgress.id.in_(select(dedup_subquery.c.min_id)))
        .where(UserProgress.user_id == user.id) # Safety check
        .order_by(UserProgress.next_review_due)
    ).all()
    results = []
    
    # Fill from Due Items first
    if due_items:
        results = _get_content_batch(due_items, session, preferred_text_id=text_id, preferred_list_id=list_id)
        print(f"[Study API Debug] Returning {len(results)} due items: {[r['content_id'] for r in results]}")
        for content in results:
            content["is_new"] = False
        
    # B. Get New Items only when the SRS due query is truly empty for this
    # fetch — i.e. every due item the user has is either already in their
    # session's seen list or was reviewed in a prior session. A short batch
    # with `len(results) > 0` just means the rest of the user's due items
    # are already in flight; introducing new items here would mix them into
    # the user's queue while they still have reviews to finish.
    if not results:
        if not settings:
            settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
            if not settings:
                settings = UserSettings(user_id=user.id)
                session.add(settings)
                session.commit()
        
        # Priority: Provided/Active List > Provided/Active Text
        # If 'all' is true but no active source set, we don't pull new items from "everywhere" 
        # because that would be chaotic. We stick to pulling from the session's identified source.
        
        new_progress_items = []
        
        if target_list_id:
            # Optimized Bulk Fetch for New Items in List
            list_query = select(StudyListItem).where(StudyListItem.study_list_id == target_list_id)
            if target_item_type:
                list_query = list_query.where(StudyListItem.item_type == target_item_type)
            
            list_items = session.exec(list_query).all()
            
            if list_items:
                # Find which list items the user hasn't studied yet
                # Filter in Python if the list is small, or use a better query
                # Since count is small (20), we can just pull candidates and filter
                for item in list_items:
                    if len(results) + len(new_progress_items) >= count: break
                    if (item.item_type, item.item_id) in excluded_set: continue

                    prog = session.exec(select(UserProgress).where(
                        UserProgress.user_id == user.id,
                        UserProgress.item_type == item.item_type,
                        UserProgress.item_id == item.item_id
                    )).first()

                    if not prog:
                        prog = UserProgress(
                            user_id=user.id,
                            item_type=item.item_type,
                            item_id=item.item_id,
                            is_learning=True,
                            next_review_due=datetime.utcnow(),
                            interval=0.0,
                            ease_factor=2.5
                        )
                        session.add(prog)
                        new_progress_items.append(prog)
        
        elif target_text_id:
            # Optimized Bulk Fetch for New Items in Text
            # 1. Fetch character candidates
            candidate_chars = []
            if not target_item_type or target_item_type == "character":
                # A. Characters inside Line Dictionaries (Standard Texts)
                chars_in_dicts = session.exec(
                    select(Character.id, Line.line_number)
                    .join(ExpressionCharacter, Character.id == ExpressionCharacter.dictionary_id)
                    .join(Expression, ExpressionCharacter.line_dict_id == Expression.id)
                    .join(Line, Line.line_dictionary_id == Expression.id)
                    .outerjoin(
                        UserProgress,
                        (UserProgress.item_id == Character.id) &
                        (UserProgress.item_type == "character") &
                        (UserProgress.user_id == user.id)
                    )
                    .where(Line.text_id == target_text_id)
                    .where(UserProgress.id == None)
                    .order_by(Line.line_number, ExpressionCharacter.order_in_line)
                    .limit(count)
                ).all()

                # B. Characters linked directly to Lines (Vocabulary Lists)
                chars_direct = session.exec(
                    select(Character.id, Line.line_number)
                    .join(Line, Line.dictionary_id == Character.id)
                    .outerjoin(
                        UserProgress,
                        (UserProgress.item_id == Character.id) &
                        (UserProgress.item_type == "character") &
                        (UserProgress.user_id == user.id)
                    )
                    .where(Line.text_id == target_text_id)
                    .where(UserProgress.id == None)
                    .order_by(Line.line_number)
                    .limit(count)
                ).all()

                candidate_ids = list(set(chars_in_dicts + chars_direct))
                candidate_ids.sort(key=lambda x: x[1]) # Sort by line number
                candidate_ids = candidate_ids[:count]
                
                # Convert back to (Character, line_number) for consistency with downstream logic
                if candidate_ids:
                    id_list = [cid for cid, ln in candidate_ids]
                    # Fetch entries in bulk
                    entries = {e.id: e for e in session.exec(select(Character).where(Character.id.in_(id_list))).all()}
                    candidate_chars = [(entries[cid], ln) for cid, ln in candidate_ids if cid in entries]
            
            text_obj = session.get(SourceText, target_text_id)
            is_curated = text_obj.author in ["Chunom.org", "Digitizing Vietnam Team"] if text_obj else False
            
            candidate_lines = []
            if (not target_item_type or target_item_type == "line") and not is_curated:
                candidate_lines = session.exec(
                    select(Expression, Line.line_number)
                    .join(Line, Line.line_dictionary_id == Expression.id)
                    .outerjoin(
                        UserProgress,
                        (UserProgress.item_id == Expression.id) &
                        (UserProgress.item_type == "line") &
                        (UserProgress.user_id == user.id)
                    )
                    .where(Line.text_id == target_text_id)
                    .where(UserProgress.id == None)
                    .order_by(Line.line_number)
                    .limit(count)
                ).all()

            # Merge and sort
            merged = []
            for c, ln in candidate_chars:
                merged.append({"type": "character", "obj": c, "ln": ln})
            for l, ln in candidate_lines:
                merged.append({"type": "line", "obj": l, "ln": ln})
            
            merged.sort(key=lambda x: x["ln"])
            
            # Filter out seen items and deduplicate new candidates
            dedup_merged = []
            seen_in_merge = set()
            for m in merged:
                k = (m["type"], m["obj"].id)
                if k not in excluded_set and k not in seen_in_merge:
                    seen_in_merge.add(k)
                    dedup_merged.append(m)

            for item in dedup_merged[:count - len(results)]:
                prog = UserProgress(
                    user_id=user.id,
                    item_type=item["type"],
                    item_id=item["obj"].id,
                    is_learning=True,
                    next_review_due=datetime.utcnow(),
                    interval=0.0,
                    ease_factor=2.5
                )
                session.add(prog)
                new_progress_items.append(prog)
        
        if new_progress_items:
            session.commit() # Save all new progress items in one go
            for prog in new_progress_items:
                session.refresh(prog)  # Ensure DB-assigned IDs are loaded before batch fetch
            new_contents = _get_content_batch(new_progress_items, session, preferred_text_id=text_id or target_text_id, preferred_list_id=list_id or target_list_id)
            for content in new_contents:
                content["is_new"] = True
                results.append(content)
    if not results:
        return {"status": "done", "message": "All items in this source studied!"}
    
    # Add stats to all results in batch
    for res in results:
        res["session_stats"] = {"due": total_due}
    
    return results if count > 1 else results[0]

def _create_new_progress(user_id, item_type, item_id, session, preferred_text_id: Optional[int] = None):
    # Final safety check to prevent duplicates
    existing = session.exec(select(UserProgress).where(
        UserProgress.user_id == user_id,
        UserProgress.item_type == item_type,
        UserProgress.item_id == item_id
    )).first()
    if existing:
        return _get_content(existing, session, preferred_text_id=preferred_text_id)

    new_prog = UserProgress(
        user_id=user_id,
        item_type=item_type,
        item_id=item_id,
        is_learning=True,
        next_review_due=datetime.utcnow(),
        interval=0.0,
        ease_factor=2.5
    )
    session.add(new_prog)
    session.commit()
    session.refresh(new_prog)
    content = _get_content(new_prog, session, preferred_text_id=preferred_text_id)
    content["is_new"] = True
    return content

@app.get("/api/browse", response_model=BrowseResponse)
def browse_content(text_id: Optional[int] = None, page: int = 1, limit: int = 20, user: Optional[User] = Depends(get_optional_user), session: Session = Depends(get_session)):
    offset = (page - 1) * limit

    query = select(Line)
    if text_id:
        query = query.where(Line.text_id == text_id).order_by(Line.line_number)

    total = session.exec(select(func.count()).select_from(query.subquery())).one()

    # Eagerly load the line dictionaries, characters, and dictionary entries to prevent N+1 queries
    query = query.options(
        selectinload(Line.line_dict).selectinload(Expression.characters).selectinload(ExpressionCharacter.dictionary_entry)
    )

    lines = session.exec(query.offset(offset).limit(limit)).all()

    # Pre-fetch user progress for these lines/characters (skipped for guests)
    progress_map = {}
    if lines and user:
        line_ids = [l.id for l in lines]

        # Get Expression IDs and Character IDs
        line_dict_ids = [l.line_dictionary_id for l in lines if l.line_dictionary_id]
        char_entry_ids = [l.dictionary_id for l in lines if l.dictionary_id]

        # Query Line Progress
        if line_dict_ids:
            line_progress = session.exec(
                select(UserProgress).where(
                    UserProgress.user_id == user.id,
                    UserProgress.item_type == "line",
                    UserProgress.item_id.in_(line_dict_ids)
                )
            ).all()
            for p in line_progress:
                progress_map[f"line:{p.item_id}"] = "learning" if p.is_learning else "learned"

        # Query Character Progress
        if char_entry_ids:
            char_progress = session.exec(
                select(UserProgress).where(
                    UserProgress.user_id == user.id,
                    UserProgress.item_type == "character",
                    UserProgress.item_id.in_(char_entry_ids)
                )
            ).all()
            for p in char_progress:
                progress_map[f"character:{p.item_id}"] = "learning" if p.is_learning else "learned"

    lines_data = []
    for line in lines:
        # Access chars via Expression -> Link -> Character
        # line.characters returns List[ExpressionCharacter]
        chars_data = []
        if line.line_dict and line.line_dict.characters:
            # Sort by order
            sorted_chars = sorted(line.line_dict.characters, key=lambda x: x.order_in_line)
            for c in sorted_chars:
                if c.dictionary_entry:
                     chars_data.append({
                         "id": c.dictionary_entry.id, 
                         "nom": c.dictionary_entry.nom_char, 
                         "quoc_ngu": c.dictionary_entry.quoc_ngu
                     })

        # Determine status key
        status_key = None
        if line.dictionary_id:
            status_key = f"character:{line.dictionary_id}"
        elif line.line_dictionary_id:
            status_key = f"line:{line.line_dictionary_id}"
            
        status = progress_map.get(status_key, "unseen") if status_key else "unseen"
        
        lines_data.append({
            "id": line.id,
            "line_dict_id": line.line_dictionary_id,
            "char_id": line.dictionary_id, # Link directly to character if set
            "line_number": line.line_number,
            "nom": line.nom_text,
            "quoc_ngu": line.quoc_ngu_text,
            "chars": chars_data,
            "status": status
        })
        
    text_title = "Unknown Text"
    author = "Unknown"
    is_curated = False
    if text_id:
        text_obj = session.get(SourceText, text_id)
        if text_obj:
            text_title = text_obj.title
            author = text_obj.author
            is_curated = author in ["Chunom.org", "Digitizing Vietnam Team"]

    return BrowseResponse(
        total_lines=total,
        total_pages=max(1, (total + limit - 1) // limit),
        current_page=page,
        text_title=text_title,
        author=author,
        is_curated=is_curated,
        lines=lines_data
    )

class LineUpdateRequest(BaseModel):
    nom_text: str
    quoc_ngu_text: str

@app.post("/api/study/review")
def submit_review(submission: ReviewSubmission, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    print(f"[SRS Debug] Review for item_id={submission.item_id} by user_id={user.id}")
    progress = session.exec(select(UserProgress).where(
        UserProgress.id == submission.item_id,
        UserProgress.user_id == user.id
    )).first()
    
    if not progress:
        print(f"[SRS Error] Item {submission.item_id} not found for User {user.id}")
        # Let's check if it exists for SOME other user
        alt = session.exec(select(UserProgress).where(UserProgress.id == submission.item_id)).first()
        if alt:
            print(f"[SRS Error] Item {submission.item_id} exists but belongs to User {alt.user_id}")
        
        raise HTTPException(status_code=404, detail="Item not found")
        
    # BACKUP state for undo
    progress.prev_next_review_due = progress.next_review_due
    progress.prev_interval = progress.interval
    progress.prev_ease_factor = progress.ease_factor
    progress.prev_review_count = progress.review_count
    progress.prev_consecutive_correct = progress.consecutive_correct
    progress.prev_is_learning = progress.is_learning
    progress.prev_last_reviewed = progress.last_reviewed
    
    updated_progress = calculate_review(progress, submission.quality)
    updated_progress.last_reviewed = datetime.utcnow()
    print(f"[SRS Debug] Updated progress: item={progress.item_type}:{progress.item_id}, quality={submission.quality}, next_due={updated_progress.next_review_due}")
    session.add(updated_progress)
    
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if not settings: 
        settings = UserSettings(user_id=user.id)
        session.add(settings)
    
    xp_gain = 0
    if submission.quality >= 3: xp_gain = 10
    elif submission.quality == 2: xp_gain = 5
    
    settings.total_xp += xp_gain
    
    if xp_gain > 0:
        session.add(XpLog(user_id=user.id, xp_amount=xp_gain, activity_type="Review"))
    
    # Streak Logic match
    today = datetime.utcnow().date()
    last_study = settings.last_study_date.date() if settings.last_study_date else None
    
    if last_study != today:
        if last_study and (today - last_study).days == 1:
            settings.current_streak += 1
        elif last_study and (today - last_study).days > 1:
            settings.current_streak = 1
        else:
            if settings.current_streak == 0: settings.current_streak = 1
            
        settings.last_study_date = datetime.utcnow()
        if settings.current_streak > settings.longest_streak:
            settings.longest_streak = settings.current_streak

    session.add(settings)
    session.commit()
    return {"status": "ok", "next_due": updated_progress.next_review_due, "xp_gained": xp_gain}

@app.post("/api/study/undo")
def undo_review(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Find the most recently reviewed item by this user
    progress = session.exec(select(UserProgress).where(
        UserProgress.user_id == user.id,
        UserProgress.last_reviewed != None
    ).order_by(UserProgress.last_reviewed.desc())).first()
    
    if not progress or progress.prev_last_reviewed is None and progress.prev_interval is None:
        raise HTTPException(status_code=400, detail="No review to undo")
        
    # Revert SRS state
    progress.next_review_due = progress.prev_next_review_due
    progress.interval = progress.prev_interval
    progress.ease_factor = progress.prev_ease_factor
    progress.review_count = progress.prev_review_count
    progress.consecutive_correct = progress.prev_consecutive_correct
    progress.is_learning = progress.prev_is_learning
    progress.last_reviewed = progress.prev_last_reviewed
    
    # Clear backup to prevent double-undo of the same state (simplification)
    progress.prev_last_reviewed = None 
    
    session.add(progress)
    
    # Revert XP (approximate)
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if settings:
        # We don't track exact XP per review in history, but we know it's usually 5 or 10.
        # For now, let's just subtract 10 if xp > 10, or just skip XP revert for simplicity
        # as it's complex to be exact without a separate ReviewLog table.
        pass
        
    session.commit()
    
    # Return the content so UI can reload it
    return _get_content(progress, session)

@app.get("/api/settings")
def get_settings(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    
    # Logic to ensure default text is active if none set
    kieu = session.exec(select(SourceText).where(SourceText.title == "Truyện Kiều")).first()
    default_id = kieu.id if kieu else None
    
    if not settings:
        settings = UserSettings(user_id=user.id, daily_new_limit=10, active_text_id=default_id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    elif settings.active_text_id is None and default_id:
        # Retroactive fix for users visiting settings
        settings.active_text_id = default_id
        session.add(settings)
        session.commit()
        session.refresh(settings)
        
    return settings

class SettingsUpdate(BaseModel):
    daily_new_limit: int = Field(ge=1, le=200)
    active_list_id: Optional[int] = None
    active_text_id: Optional[int] = None

@app.post("/api/settings")
def update_settings(update: SettingsUpdate, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if not settings:
        settings = UserSettings(daily_new_limit=update.daily_new_limit, user_id=user.id)
    
    settings.daily_new_limit = update.daily_new_limit
    
    # Logic: Only one active source at a time? Or if list is present use list?
    # Let's say if active_list_id is passed (even if None), we set it.
    # Same for text.
    
    # If update.active_list_id is sent, it overrides text?
        # User UI should enforce mutual exclusivity by sending the other as None.
    
    settings.active_list_id = update.active_list_id
    settings.active_text_id = update.active_text_id
    
    session.add(settings)
    session.commit()
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {
        "message": "Nom Study Tool API Backend (NextJS Version)",
        "status": "online",
        "database": "learning.db"
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/settings/reset")
def reset_progress(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Delete all UserProgress for this user
    progress = session.exec(select(UserProgress).where(UserProgress.user_id == user.id)).all()
    for p in progress:
        session.delete(p)
    
    # Reset settings (XP/Streak)
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if settings:
        settings.total_xp = 0
        settings.current_streak = 0
        settings.longest_streak = 0
        settings.last_study_date = None
        session.add(settings)

    session.commit()
    return {"status": "reset_complete"}

# --- List Management APIs ---

@app.get("/api/lists")
def get_lists(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    lists = session.exec(select(StudyList).where(StudyList.user_id == user.id)).all()
    if not lists:
        return []
    list_ids = [l.id for l in lists]
    counts = dict(session.exec(
        select(StudyListItem.study_list_id, func.count(StudyListItem.id))
        .where(StudyListItem.study_list_id.in_(list_ids))
        .group_by(StudyListItem.study_list_id)
    ).all())
    return [
        {"id": l.id, "name": l.name, "description": l.description, "item_count": counts.get(l.id, 0)}
        for l in lists
    ]

@app.post("/api/lists")
def create_list(req: CreateListRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    new_list = StudyList(name=req.name, description=req.description, user_id=user.id)
    session.add(new_list)
    session.commit()
    session.refresh(new_list)
    return new_list

@app.get("/api/lists/{list_id}")
def get_list_details(list_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    lst = session.exec(select(StudyList).where(StudyList.id == list_id, StudyList.user_id == user.id)).first()
    if not lst: raise HTTPException(404, "List not found")
    
    # Optimized Bulk Fetch
    items_raw = lst.items
    char_ids = [li.item_id for li in items_raw if li.item_type == "character"]
    line_ids = [li.item_id for li in items_raw if li.item_type == "line"]
    
    char_map = {}
    if char_ids:
        chars = session.exec(select(Character).where(Character.id.in_(char_ids))).all()
        char_map = {c.id: c for c in chars}
        
    line_map = {}
    if line_ids:
        lines = session.exec(select(Expression).where(Expression.id.in_(line_ids))).all()
        line_map = {l.id: l for l in lines}
        
    items = []
    for li in items_raw:
        if li.item_type == "character":
            c = char_map.get(li.item_id)
            if c: items.append({"id": c.id, "type": "character", "nom": c.nom_char, "quoc_ngu": c.quoc_ngu})
        elif li.item_type == "line":
            l = line_map.get(li.item_id)
            if l: items.append({"id": l.id, "type": "line", "nom": l.nom_text, "quoc_ngu": l.quoc_ngu_text})
            
    return {"id": lst.id, "name": lst.name, "description": lst.description, "items": items}

@app.post("/api/lists/{list_id}/items")
def add_item_to_list(list_id: int, req: AddListItemRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    lst = session.exec(select(StudyList).where(StudyList.id == list_id, StudyList.user_id == user.id)).first()
    if not lst: raise HTTPException(404, "List not found")
    
    # Check if exists
    exists = session.exec(select(StudyListItem).where(
        StudyListItem.study_list_id == list_id,
        StudyListItem.item_type == req.item_type,
        StudyListItem.item_id == req.item_id
    )).first()
    
    if exists: return {"status": "already_exists"}
    
    new_item = StudyListItem(study_list_id=list_id, item_type=req.item_type, item_id=req.item_id)
    session.add(new_item)
    session.commit()
    return {"status": "added"}

@app.delete("/api/lists/{list_id}/items/{item_type}/{item_id}")
def remove_item_from_list(list_id: int, item_type: str, item_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Verify ownership of list first
    lst = session.exec(select(StudyList).where(StudyList.id == list_id, StudyList.user_id == user.id)).first()
    if not lst: raise HTTPException(404, "List not found")
    
    item = session.exec(select(StudyListItem).where(
        StudyListItem.study_list_id == list_id,
        StudyListItem.item_type == item_type,
        StudyListItem.item_id == item_id
    )).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in list")
        
    session.delete(item)
    session.commit()
    return {"status": "removed"}

@app.delete("/api/lists/{list_id}")
def delete_list(list_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Verify ownership
    lst = session.exec(select(StudyList).where(StudyList.id == list_id, StudyList.user_id == user.id)).first()
    if not lst: raise HTTPException(404, "List not found")
    
    # If the list is active, unset it in UserSettings
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if settings and settings.active_list_id == list_id:
        settings.active_list_id = None
        session.add(settings)
    
    # Delete list (Items should cascade delete if relationships set up, otherwise we might need to delete them manually)
    # Checking models.py for cascade... usually safer to manually delete items if not sure.
    # But usually SQLModel relationships handle this if configured. 
    # Let's manually delete items just in case to be safe and clean.
    for item in lst.items:
        session.delete(item)
        
    session.delete(lst)
    session.commit()
    return {"status": "deleted"}

@app.get("/api/user/vocab")
def get_user_vocab(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Join UserProgress with Content (Character/Line)
    # Optimization: Bulk fetch characters and lines to avoid N+1 queries
    progress_items = session.exec(
        select(UserProgress)
        .where(UserProgress.user_id == user.id)
        .order_by(UserProgress.next_review_due)
    ).all()
    
    if not progress_items:
        return []

    # Separate IDs
    char_ids = [p.item_id for p in progress_items if p.item_type == "character"]
    line_ids = [p.item_id for p in progress_items if p.item_type == "line"]
    
    # Bulk Fetch
    chars_map = {}
    if char_ids:
        chars = session.exec(select(Character).where(Character.id.in_(char_ids))).all()
        chars_map = {c.id: c for c in chars}
        
    lines_map = {}
    if line_ids:
        lines = session.exec(select(Expression).where(Expression.id.in_(line_ids))).all()
        lines_map = {l.id: l for l in lines}
        
    results = []
    for p in progress_items:
        if p.item_type == "character":
            entry = chars_map.get(p.item_id)
            if entry:
                results.append({
                    "user_progress_id": p.id,
                    "item_type": "character",
                    "content_id": entry.id,
                    "nom": entry.nom_char,
                    "quoc_ngu": _clean_text(entry.quoc_ngu),
                    "is_learning": p.is_learning,
                    "next_review_due": p.next_review_due,
                    "interval": p.interval
                })
        else:
            ld = lines_map.get(p.item_id)
            if ld:
                results.append({
                    "user_progress_id": p.id,
                    "item_type": "line",
                    "content_id": ld.id,
                    "nom": ld.nom_text,
                    "quoc_ngu": _clean_text(ld.quoc_ngu_text, lower=False),
                    "english": ld.english_translation,
                    "is_learning": p.is_learning,
                    "next_review_due": p.next_review_due,
                    "interval": p.interval
                })
        
    return results

def _get_user_progress_counts(user_id: int, session: Session, text_id: Optional[int] = None, list_id: Optional[int] = None):
    now = datetime.utcnow()
    query = select(UserProgress).where(UserProgress.user_id == user_id)
    
    if list_id:
        query = query.join(
            StudyListItem, 
            (UserProgress.item_type == StudyListItem.item_type) & 
            (UserProgress.item_id == StudyListItem.item_id)
        ).where(StudyListItem.study_list_id == list_id)
    elif text_id:
        from sqlmodel import exists
        query = query.where(
            (
                (UserProgress.item_type == "character") & 
                (
                    exists().where(Line.text_id == text_id, Line.dictionary_id == UserProgress.item_id) |
                    exists().where(Line.text_id == text_id, Line.line_dictionary_id == ExpressionCharacter.line_dict_id, ExpressionCharacter.dictionary_id == UserProgress.item_id)
                )
            ) | (
                (UserProgress.item_type == "line") & 
                (exists().where(Line.text_id == text_id, Line.line_dictionary_id == UserProgress.item_id))
            )
        )
        
    sub = query.subquery()
    counts_row = session.exec(
        select(
            func.sum(case((sub.c.next_review_due <= now, 1), else_=0)).label("due"),
            func.sum(case((sub.c.is_learning == True, 1), else_=0)).label("learning"),
            func.sum(case((sub.c.is_learning == False, 1), else_=0)).label("learned"),
        )
    ).one()
    
    return {
        "due": int(counts_row.due or 0),
        "learning": int(counts_row.learning or 0),
        "learned": int(counts_row.learned or 0)
    }

def _get_content_batch(progress_items: List[UserProgress], session: Session, include_context: bool = True, preferred_text_id: Optional[int] = None, preferred_list_id: Optional[int] = None):
    if not progress_items:
        return []
    
    # 1. Fetch User Settings once
    user_id = progress_items[0].user_id
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    active_text_id = preferred_text_id

    # 2. Source Resolution for title labeling
    source_title = None
    is_curated = False
    
    if preferred_list_id:
        lst = session.get(StudyList, preferred_list_id)
        if lst:
            source_title = lst.name
    elif active_text_id:
        txt = session.get(SourceText, active_text_id)
        if txt:
            source_title = txt.title
            if txt.author in ["Chunom.org", "Digitizing Vietnam Team"]:
                is_curated = True
            
    # 3. Bulk fetch Character and Expression
    char_ids = [p.item_id for p in progress_items if p.item_type == "character"]
    line_ids = [p.item_id for p in progress_items if p.item_type == "line"]
    
    char_entries = {}
    if char_ids:
        entries = session.exec(select(Character).where(Character.id.in_(char_ids))).all()
        char_entries = {e.id: e for e in entries}
        
    line_entries = {}
    if line_ids:
        entries = session.exec(select(Expression).where(Expression.id.in_(line_ids))).all()
        line_entries = {e.id: e for e in entries}

    # 4. Fetch provenance for Lines (Source title and line number)
    all_line_provenance = {}
    if line_ids:
        prov_query = (
            select(Line.line_dictionary_id, Line.line_number, SourceText.title, SourceText.id)
            .join(SourceText, Line.text_id == SourceText.id)
            .where(Line.line_dictionary_id.in_(line_ids))
        )
        prov_data = session.exec(prov_query).all()
        for ld_id, ln, title, txt_id in prov_data:
            if ld_id not in all_line_provenance:
                all_line_provenance[ld_id] = []
            all_line_provenance[ld_id].append({"ln": ln, "title": title, "text_id": txt_id})

    results = []
    
    # Process each item
    # Optimization: Pre-fetch context lines for all CHARACTERS in a single query
    all_context_candidates = {}
    if char_ids and include_context and not is_curated:
        # Fetch candidate lines for these dictionary entries
        # JOIN with UserProgress to see if user has studied these lines
        candidates_query = (
            select(
                ExpressionCharacter.dictionary_id,
                Expression.nom_text,
                Line.text_id,
                SourceText.title.label("source_title"),
                Line.line_number,
                ExpressionCharacter.order_in_line,
                UserProgress.id.label("line_progress_id")
            )
            .join(Expression, ExpressionCharacter.line_dict_id == Expression.id)
            .join(Line, Line.line_dictionary_id == Expression.id)
            .join(SourceText, Line.text_id == SourceText.id)
            .outerjoin(
                UserProgress,
                (UserProgress.user_id == user_id) &
                (UserProgress.item_type == "line") &
                (UserProgress.item_id == Expression.id)
            )
            .where(ExpressionCharacter.dictionary_id.in_(char_ids))
            .where(SourceText.author.not_in(["Chunom.org", "Digitizing Vietnam Team"]))
        )
        # Optimization: Prioritize active text first (so the LIMIT below cannot
        # exhaust before active-text rows are reached), then studied lines, then line number
        order_clauses = []
        if active_text_id:
            order_clauses.append(case((Line.text_id == active_text_id, 0), else_=1))
        order_clauses.append(case((UserProgress.id != None, 0), else_=1))
        order_clauses.append(Line.line_number)
        
        candidates_query = candidates_query.order_by(*order_clauses)
            
        candidates_query = candidates_query.limit(len(char_ids) * 20) # Slightly more candidates to find studied ones
        
        candidates = session.exec(candidates_query).all()
        # Group by dictionary_id
        for dict_id, nom_text, text_id, s_title, line_ln, order, line_prog_id in candidates:
            if dict_id not in all_context_candidates:
                all_context_candidates[dict_id] = []
            all_context_candidates[dict_id].append({
                "text": nom_text,
                "text_id": text_id,
                "source_title": s_title,
                "line_number": line_ln,
                "order": order,
                "has_progress": line_prog_id is not None
            })

    for progress in progress_items:
        if progress.item_type == "character":
            entry = char_entries.get(progress.item_id)
            if not entry: continue
            
            context_line = ""
            item_source_title = source_title
            if include_context and not is_curated:
                candidates = all_context_candidates.get(entry.id, [])
                if candidates:
                    # Pick the best candidate in Python
                    # Priority 1: From active text (the source being studied)
                    # Priority 2: Studied
                    # Priority 3: Smallest line number

                    best = None
                    in_active = [c for c in candidates if active_text_id and c["text_id"] == active_text_id]
                    pool = in_active if in_active else candidates

                    studied = [c for c in pool if c["has_progress"]]
                    if studied:
                        best = studied[0]
                    else:
                        pool.sort(key=lambda x: (x["line_number"] or 999999))
                        best = pool[0]
                    
                    context_line = best["text"]
                    item_source_title = best.get("source_title", source_title)
                    
                    # Highlight the specific instance if we have the order
                    if "order" in best and best["text"]:
                        # Convert to list of characters to handle position accurately
                        chars = list(best["text"])
                        if best["order"] < len(chars):
                            target_char = chars[best["order"]]
                            chars[best["order"]] = f'<span class="current-char-highlight">{target_char}</span>'
                            context_line = "".join(chars)
            
            results.append({
                "user_progress_id": progress.id,
                "item_type": "character",
                "content_id": entry.id,
                "nom": entry.nom_char,
                "quoc_ngu": _clean_text(entry.quoc_ngu),
                "context_line": context_line,
                "source_title": item_source_title,
                "intervals": get_review_intervals(progress)
            })
        else:
            ld = line_entries.get(progress.item_id)
            if not ld: continue
            
            # Find best provenance
            prov_list = all_line_provenance.get(ld.id, [])
            best_prov = None
            if prov_list:
                if active_text_id:
                    best_prov = next((p for p in prov_list if p["text_id"] == active_text_id), None)
                if not best_prov:
                    best_prov = prov_list[0]
            
            results.append({
                "user_progress_id": progress.id,
                "item_type": "line",
                "content_id": ld.id,
                "nom": ld.nom_text,
                "quoc_ngu": _clean_text(ld.quoc_ngu_text, lower=False),
                "english": ld.english_translation,
                "source_title": best_prov["title"] if best_prov else "Unknown Source",
                "line_number": best_prov["ln"] if best_prov else None,
                "intervals": get_review_intervals(progress)
            })
            
    return results

def _get_content(progress: UserProgress, session: Session, include_context: bool = True, preferred_text_id: Optional[int] = None):
    # Backward compatibility: Use the batch function for a single item
    result = _get_content_batch([progress], session, include_context, preferred_text_id)
    return result[0] if result else None

import re
import unicodedata

def _clean_text(text: str, lower: bool = True) -> str:
    if not text: return ""
    # Normalize to NFC
    text = unicodedata.normalize('NFC', text)
    if lower:
        text = text.lower()
    
    # Tone Unification (Unify common variations)
    tone_map = {
        'oà': 'òa', 'oá': 'óa', 'oả': 'ỏa', 'oã': 'õa', 'oạ': 'ọa',
        'oè': 'òe', 'oé': 'óe', 'oẻ': 'ỏe', 'oẽ': 'õe', 'oẹ': 'ọe',
        'uỳ': 'ùy', 'uý': 'úy', 'uỷ': 'ủy', 'uỹ': 'ũy', 'uỵ': 'ụy',
    }
    for old_form, new_form in tone_map.items():
        text = text.replace(old_form, new_form)
        if not lower:
            # Also handle upper/title case variants for tones
            text = text.replace(old_form.upper(), new_form.upper())
            text = text.replace(old_form.capitalize(), new_form.capitalize())
        
    # Keep only letters, numbers, and spaces (preserving case if not lowered)
    clean = re.sub(r'[^\w\s]', ' ', text)
    return re.sub(r'\s+', ' ', clean).strip()

# --- Challenge & Leaderboard APIs ---

@app.get("/api/leaderboard/global")
def get_global_leaderboard(period: str = "daily", session: Session = Depends(get_session)):
    # period: daily, weekly, monthly
    now = datetime.utcnow()
    if period == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "monthly":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "lifetime":
        start_date = datetime(2000, 1, 1) # Effectively no filter
    else:
        start_date = now - timedelta(days=1)
        
    rankings = session.exec(
        select(User.username, User.is_admin, func.sum(XpLog.xp_amount).label("xp"))
        .join(XpLog, User.id == XpLog.user_id)
        .where(XpLog.timestamp >= start_date)
        .where(User.hide_from_leaderboard == False)
        .group_by(User.id)
        .order_by(text("xp DESC"))
        .limit(20)
    ).all()

    return [{"username": "Albert E" if r[1] else r[0], "xp": int(r[2])} for r in rankings]

@app.get("/api/leaderboard/titles")
def get_leaderboard_titles(session: Session = Depends(get_session)):
    texts = session.exec(select(SourceText)).all()
    return [{"id": t.id, "title": t.title} for t in texts]

@app.get("/api/leaderboard/{text_id}")
def get_leaderboard(text_id: str, session: Session = Depends(get_session)):
    if text_id == "all" or text_id == "0":
        text_title = "All Sources"
        target_text_id = 0
    else:
        target_text_id = int(text_id)
        text_obj = session.get(SourceText, target_text_id)
        text_title = text_obj.title if text_obj else f"Text {target_text_id}"

    def get_rankings(mode_name):
        # 1. Fetch persisted personal bests
        # Using string-based columns to be absolutely unambiguous for SQLite
        rankings_query = (
            select(
                LeaderboardEntry.score.label("score"),
                LeaderboardEntry.achieved_at.label("achieved_at"),
                User.username.label("username"),
                User.is_admin.label("is_admin"),
                User.id.label("user_id")
            )
            .join(User, LeaderboardEntry.user_id == User.id)
            .where(LeaderboardEntry.text_id == target_text_id)
            .where(LeaderboardEntry.mode == mode_name)
            .where(User.hide_from_leaderboard == False)
            .order_by(desc(LeaderboardEntry.score))
        )
        best_entries = session.exec(rankings_query).all()
        
        # 2. Fetch active sessions (live progress)
        active_query = (
            select(
                ChallengeSession.current_index.label("score"),
                ChallengeSession.last_updated.label("achieved_at"),
                User.username.label("username"),
                User.is_admin.label("is_admin"),
                User.id.label("user_id")
            )
            .join(User, ChallengeSession.user_id == User.id)
            .where(ChallengeSession.text_id == target_text_id)
            .where(ChallengeSession.mode == mode_name)
            .where(ChallengeSession.current_index > 0)
            .where(User.hide_from_leaderboard == False)
        )
        active_sessions = session.exec(active_query).all()
        
        # Merge logic
        user_best = {} # user_id -> {username, score, achieved_at, is_live}
        
        # 1. Add persisted bests
        for score, achieved_at, username, is_admin, user_id in best_entries:
            user_best[user_id] = {
                "username": "Albert E" if is_admin else (username or "Unknown Scholar"),
                "score": score,
                "achieved_at": achieved_at,
                "is_live": False
            }
            
        # 2. Add/Override with live progress if higher
        for score, achieved_at, username, is_admin, user_id in active_sessions:
            if user_id not in user_best or score > user_best[user_id]["score"]:
                user_best[user_id] = {
                    "username": "Albert E" if is_admin else (username or "Unknown Scholar"),
                    "score": score,
                    "achieved_at": achieved_at,
                    "is_live": True
                }
        
        # Convert to list and sort
        results = list(user_best.values())
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:10]

    # Calculate all three rankings
    challenge_results = get_rankings("sudden_death")
    normal_results = get_rankings("normal")
    
    # 3. Study Progress (Lines studied)
    # Join on Expression logic
    progress_query = (
        select(User.username, User.is_admin, func.count(UserProgress.user_id).label("lines_count"))
        .join(UserProgress, User.id == UserProgress.user_id)
        .join(Line, UserProgress.item_id == Line.line_dictionary_id)
        .where(UserProgress.item_type == "line")
        .where(User.hide_from_leaderboard == False)
    )
    
    if target_text_id > 0:
        progress_query = progress_query.where(Line.text_id == target_text_id)

    progress_entries = session.exec(
        progress_query
        .group_by(User.id, User.username, User.is_admin)
        .order_by(desc("lines_count"))
        .limit(10)
    ).all()
    
    progress_results = []
    for username, is_admin, count in progress_entries:
        progress_results.append({
            "username": "Albert E" if is_admin else username,
            "score": count
        })
        
    return {
        "text_title": text_title,
        "challenge": challenge_results,
        "normal": normal_results,
        "progress": progress_results
    }


class ScoreSubmission(BaseModel):
    text_id: int = 0
    score: int
    mode: str = "sudden_death"

@app.post("/api/challenge/correct")
def record_challenge_correct(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Record XP for a correct answer during a challenge."""
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if settings:
        settings.total_xp += 10
        session.add(XpLog(user_id=user.id, xp_amount=10, activity_type="Challenge"))
        session.add(settings)
        session.commit()
    return {"status": "ok", "xp_gained": 10}

@app.post("/api/challenge/score")
def submit_score(sub: ScoreSubmission, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    is_new_record = False
    
    if sub.mode and sub.mode != "practice":
        # Handle 0/all
        target_tid = sub.text_id if sub.text_id and sub.text_id > 0 else None
        
        query = select(LeaderboardEntry).where(LeaderboardEntry.user_id == user.id, LeaderboardEntry.mode == sub.mode)
        if sub.list_id:
            query = query.where(LeaderboardEntry.list_id == sub.list_id)
        elif target_tid:
            query = query.where(LeaderboardEntry.text_id == target_tid)
        else:
            return {"status": "error", "message": "No source provided"}

        existing = session.exec(query).first()
        
        if existing:
            if sub.score > existing.score:
                existing.score = sub.score
                existing.achieved_at = datetime.utcnow()
                session.add(existing)
                is_new_record = True
        else:
            entry = LeaderboardEntry(
                user_id=user.id, 
                text_id=target_tid if not sub.list_id else None, 
                list_id=sub.list_id,
                score=sub.score, 
                mode=sub.mode
            )
            session.add(entry)
            is_new_record = True
            
        session.commit()
    
    # Clear session on Game Over or Completion
    del_stmt = delete(ChallengeSession).where(
        ChallengeSession.user_id == user.id,
        ChallengeSession.mode == sub.mode
    )
    if sub.list_id:
        del_stmt = del_stmt.where(ChallengeSession.list_id == sub.list_id)
    elif sub.text_id and sub.text_id > 0:
        del_stmt = del_stmt.where(ChallengeSession.text_id == sub.text_id)

    session.exec(del_stmt)
    session.commit()
    
    return {"status": "ok", "new_record": is_new_record}

class PauseRequest(BaseModel):
    text_id: Optional[int] = None
    list_id: Optional[int] = None
    current_index: int
    mode: str = "sudden_death"

@app.post("/api/challenge/pause")
def pause_challenge(req: PauseRequest, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if req.list_id:
        existing = session.exec(select(ChallengeSession).where(
            ChallengeSession.user_id == user.id,
            ChallengeSession.list_id == req.list_id,
            ChallengeSession.mode == req.mode
        )).first()
    else:
        existing = session.exec(select(ChallengeSession).where(
            ChallengeSession.user_id == user.id,
            ChallengeSession.text_id == (req.text_id if req.text_id is not None else 0),
            ChallengeSession.mode == req.mode
        )).first()
    
    if existing:
        existing.current_index = req.current_index
        existing.last_updated = datetime.utcnow()
        session.add(existing)
    else:
        new_session = ChallengeSession(
            user_id=user.id,
            text_id=req.text_id,
            list_id=req.list_id,
            current_index=req.current_index,
            mode=req.mode
        )
        session.add(new_session)
        
    session.commit()
    return {"status": "saved"}

@app.get("/api/challenge/session")
def get_challenge_session_query(mode: Optional[str] = None, text_id: Optional[str] = None, list_id: Optional[int] = None, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    query = select(ChallengeSession).where(ChallengeSession.user_id == user.id)
    
    if list_id:
        query = query.where(ChallengeSession.list_id == list_id)
    elif text_id:
        try:
            # Handle possible "all" or non-numeric text_id strings
            tid = int(text_id)
            query = query.where(ChallengeSession.text_id == tid)
        except (ValueError, TypeError):
            # If not a valid integer, it can't match a text challenge session
            return {"status": "none"}
    
    if mode:
        query = query.where(ChallengeSession.mode == mode)
        
    session_row = session.exec(query).first()
    
    if not session_row:
        return {"status": "none"}
        
    return {
        "status": "found",
        "current_index": session_row.current_index,
        "mode": session_row.mode,
        "last_updated": session_row.last_updated
    }

@app.delete("/api/challenge/session")
def clear_challenge_session_query(mode: Optional[str] = None, text_id: Optional[str] = None, list_id: Optional[int] = None, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = delete(ChallengeSession).where(ChallengeSession.user_id == user.id)
    if list_id:
        statement = statement.where(ChallengeSession.list_id == list_id)
    elif text_id:
        try:
            tid = int(text_id)
            statement = statement.where(ChallengeSession.text_id == tid)
        except (ValueError, TypeError):
            return {"status": "none"}
        
    if mode:
        statement = statement.where(ChallengeSession.mode == mode)
        
    session.exec(statement)
    session.commit()
    return {"status": "cleared"}

@app.get("/api/challenge/text/{text_id}")
def get_challenge_content(text_id: str, session: Session = Depends(get_session)):
    if text_id == "all" or text_id == "0":
         # Global challenge
         lines = session.exec(select(Line).options(joinedload(Line.line_dict), joinedload(Line.dictionary_entry)).order_by(Line.id).limit(1000)).all()
    else:
         lines = session.exec(select(Line).options(joinedload(Line.line_dict), joinedload(Line.dictionary_entry)).where(Line.text_id == int(text_id)).order_by(Line.line_number, Line.id)).all()
    
    return [{"id": l.id, "nom": l.nom_text, "quoc_ngu": l.quoc_ngu_text} for l in lines]

@app.get("/api/challenge/list/{list_id}")
def get_challenge_list_content(list_id: int, session: Session = Depends(get_session)):
    # Get all items in the list
    list_items = session.exec(select(StudyListItem).where(StudyListItem.study_list_id == list_id).order_by(StudyListItem.id)).all()
    
    mock_progress = [
        UserProgress(item_type=item.item_type, item_id=item.item_id, user_id=0, next_review_due=datetime.utcnow())
        for item in list_items
    ]
    
    batch_content = _get_content_batch(mock_progress, session, include_context=False)
    
    results = []
    # Map batch content back to original list item IDs for reference
    # Note: _get_content_batch might return fewer items if some are missing in DB, 
    # but for challenge mode we want to preserve as many as possible.
    # We can match by (item_type, item_id)
    content_map = {(c["item_type"], c["content_id"]): c for c in batch_content}
    
    for item in list_items:
        content = content_map.get((item.item_type, item.item_id))
        if content:
            results.append({"id": item.id, "nom": content["nom"], "quoc_ngu": content["quoc_ngu"]})
            
    import random
    random.shuffle(results)
    return results

# --- Dictionary Feature ---

_text_character_sequence_cache: dict[int, dict] = {}

@app.get("/api/texts/{text_id}/characters")
def get_text_character_sequence(text_id: int, session: Session = Depends(get_session)):
    cached = _text_character_sequence_cache.get(text_id)
    if cached is not None:
        return cached

    text = session.get(SourceText, text_id)
    if not text:
        raise HTTPException(404, "Text not found")
    lines = session.exec(
        select(Line)
        .where(Line.text_id == text_id)
        .order_by(Line.line_number)
        .options(
            selectinload(Line.line_dict)
            .selectinload(Expression.characters)
            .selectinload(ExpressionCharacter.dictionary_entry),
            selectinload(Line.dictionary_entry),
        )
    ).all()
    entries: list[dict] = []
    seen: set[str] = set()
    for line in lines:
        nom = line.nom_text or ""
        line_quoc_ngu = line.quoc_ngu_text or ""

        # Build a map: position-in-line -> quoc_ngu, using ExpressionCharacter ordering
        per_char: dict[str, str] = {}
        if line.line_dict and line.line_dict.characters:
            for ec in line.line_dict.characters:
                if ec.dictionary_entry and ec.dictionary_entry.nom_char:
                    per_char.setdefault(ec.dictionary_entry.nom_char, ec.dictionary_entry.quoc_ngu or "")
        elif line.dictionary_entry and line.dictionary_entry.nom_char:
            per_char.setdefault(line.dictionary_entry.nom_char, line.dictionary_entry.quoc_ngu or "")

        for ch in nom:
            if not ch.strip() or ch in seen:
                continue
            seen.add(ch)
            entries.append({
                "character": ch,
                "character_quoc_ngu": per_char.get(ch, ""),
                "line_nom": nom,
                "line_quoc_ngu": line_quoc_ngu,
                "line_number": line.line_number,
            })
    result = {"title": text.title, "entries": entries}
    _text_character_sequence_cache[text_id] = result
    return result

@app.get("/api/characters/strokes/{codepoint}")
def get_character_strokes(codepoint: int, session: Session = Depends(get_session)):
    row = session.get(CharacterStrokes, codepoint)
    if not row:
        raise HTTPException(404, "Stroke data not found")
    return {
        "character": row.character,
        "strokes": json.loads(row.strokes_json),
        "medians": json.loads(row.medians_json),
    }

# Public sample deck for guests trying the product without an account.
# Mixes a few Truyện Kiều lines (if available) with popular single characters so
# the demo shows both item types.
@app.get("/api/guest/study/sample")
def get_guest_study_sample(session: Session = Depends(get_session)):
    items = []
    fake_id = -1

    all_texts = session.exec(select(SourceText)).all()
    kieu = next(
        (t for t in all_texts if "kiều" in t.title.lower() or "kieu" in t.title.lower()),
        None,
    )

    line_limit = 5
    if kieu:
        lines = session.exec(
            select(Line)
            .options(selectinload(Line.line_dict))
            .where(Line.text_id == kieu.id, Line.line_dictionary_id != None)
            .order_by(Line.line_number)
            .limit(line_limit)
        ).all()
        for l in lines:
            ld = l.line_dict
            if not ld:
                continue
            items.append({
                "user_progress_id": fake_id,
                "item_type": "line",
                "content_id": ld.id,
                "nom": ld.nom_text,
                "quoc_ngu": ld.quoc_ngu_text,
                "english": ld.english_translation,
                "source_title": kieu.title,
                "line_number": l.line_number,
                "is_new": True,
                "is_learning": False,
                "next_review_due": datetime.utcnow().isoformat(),
                "interval": 0,
            })
            fake_id -= 1

    char_limit = 15 - len(items)
    chars = session.exec(
        select(Character)
        .order_by(Character.popularity.desc())
        .limit(char_limit)
    ).all()
    for c in chars:
        items.append({
            "user_progress_id": fake_id,
            "item_type": "character",
            "content_id": c.id,
            "nom": c.nom_char,
            "quoc_ngu": c.quoc_ngu,
            "english": c.definition,
            "source_title": None,
            "is_new": True,
            "is_learning": False,
            "next_review_due": datetime.utcnow().isoformat(),
            "interval": 0,
        })
        fake_id -= 1

    return items

@app.get("/api/dictionary/char/{entry_id}")
def get_dictionary_char_data(entry_id: int, user: Optional[User] = Depends(get_optional_user), session: Session = Depends(get_session)):
    entry = session.get(Character, entry_id)
    if not entry: raise HTTPException(404, "Character not found")
    
    import re
    def _clean_str(s):
        return re.sub(r'[^\w\s]', '', s).lower() if s else ""

    # 1. Variants (Same Nom, diff Quoc Ngu)
    variants_raw = session.exec(select(Character).where(Character.nom_char == entry.nom_char, Character.id != entry.id)).all()
    
    # Deduplicate variants by CLEAN Quoc Ngu
    variants = []
    seen_qn = {_clean_str(entry.quoc_ngu)}
    for v in variants_raw:
        qn_clean = _clean_str(v.quoc_ngu)
        if qn_clean not in seen_qn:
            seen_qn.add(qn_clean)
            variants.append(v)
    
    # 2. Homophones
    import unicodedata
    homophones_raw = session.exec(select(Character).where(Character.quoc_ngu == entry.quoc_ngu, Character.id != entry.id)).all()
    # Filter to ensure exact Unicode match — some DB collations are accent-insensitive
    # and treat e.g. "thân" and "than" as equal when they are distinct readings
    target_nfc = unicodedata.normalize('NFC', entry.quoc_ngu.strip())
    homophones_raw = [h for h in homophones_raw if unicodedata.normalize('NFC', h.quoc_ngu.strip()) == target_nfc]
    homophones = []
    seen_nom = {entry.nom_char}
    for h in homophones_raw:
        if h.nom_char not in seen_nom:
            seen_nom.add(h.nom_char)
            homophones.append(h)
            
    target_clean = _clean_str(entry.quoc_ngu)

    # 3. Examples
    candidates = session.exec(select(Character).where(Character.nom_char == entry.nom_char)).all()
    related_ids = [c.id for c in candidates if _clean_str(c.quoc_ngu) == target_clean]
            
    lines = session.exec(
        select(Expression, Line, SourceText, ExpressionCharacter)
        .join(ExpressionCharacter, Expression.id == ExpressionCharacter.line_dict_id)
        .join(Line, Line.line_dictionary_id == Expression.id)
        .join(SourceText, Line.text_id == SourceText.id)
        .where(ExpressionCharacter.dictionary_id.in_(related_ids))
        .order_by(Line.text_id, Line.line_number)
        .limit(50)
    ).all()
    
    examples_data = []
    seen_lines = set()
    for ld, l, st, link in lines:
        if ld.id in seen_lines: continue
        seen_lines.add(ld.id)
        
        nom_text = ld.nom_text
        if link and link.order_in_line is not None:
            chars_list = list(nom_text)
            if link.order_in_line < len(chars_list):
                target = chars_list[link.order_in_line]
                chars_list[link.order_in_line] = f'<span class="current-char-highlight">{target}</span>'
                nom_text = "".join(chars_list)

        examples_data.append({
            "line_id": ld.id,
            "nom": nom_text,
            "quoc_ngu": ld.quoc_ngu_text,
            "source": f"{st.title} - Line {l.line_number}"
        })
        
    # Get user stats for this char (skipped for guests)
    prog = None
    if user:
        prog = session.exec(select(UserProgress).where(UserProgress.user_id == user.id, UserProgress.item_type == "character", UserProgress.item_id == entry.id)).first()
    
    display_qn = entry.quoc_ngu.lower().strip(".,;?! ")
    
    return {
        "id": entry.id,
        "nom": entry.nom_char,
        "quoc_ngu": display_qn,
        "variants": [{"id": v.id, "nom": v.nom_char, "quoc_ngu": v.quoc_ngu.lower().strip(".,;?! ")} for v in variants],
        "homophones": [{"id": h.id, "nom": h.nom_char, "quoc_ngu": h.quoc_ngu.lower().strip(".,;?! ")} for h in homophones],
        "examples": examples_data,
        "stats": {
            "is_learning": prog.is_learning if prog else False,
            "next_review": prog.next_review_due if prog else None
        }
    }
    


@app.get("/api/dictionary/line/{line_id}")
def get_dictionary_line_data(line_id: int, user: Optional[User] = Depends(get_optional_user), session: Session = Depends(get_session)):
    # line_id here is Expression.id
    ld = session.get(Expression, line_id)
    if not ld: raise HTTPException(404, "Line not found")
    
    # Get constituent characters
    # Join ExpressionCharacter -> Character
    chars = session.exec(
        select(Character, ExpressionCharacter)
        .join(ExpressionCharacter, Character.id == ExpressionCharacter.dictionary_id)
        .where(ExpressionCharacter.line_dict_id == ld.id)
        .order_by(ExpressionCharacter.order_in_line)
    ).all()
    
    chars_data = []
    for de, link in chars:
        # Filter Punctuation (User Request: Don't show boxes for punctuation)
        # Check if ALL characters in the token are punctuation
        is_punct = True
        if de.nom_char:
            for c in de.nom_char:
                if not unicodedata.category(c).startswith('P'):
                    is_punct = False
                    break
        else:
            is_punct = False # Empty string? Keep it or handle as error? usually keep.

        if is_punct: continue
            
        chars_data.append({
            "id": de.id,
            "nom": de.nom_char,
            "quoc_ngu": de.quoc_ngu.lower().strip(".,;?! "),
            "order": link.order_in_line
        })
        
    # Get user stats for this line (skipped for guests)
    prog = None
    if user:
        prog = session.exec(select(UserProgress).where(UserProgress.user_id == user.id, UserProgress.item_type == "line", UserProgress.item_id == ld.id)).first()

    # Provenance: which source text(s) and line number(s) reference this Expression
    sources_query = (
        select(SourceText.id, SourceText.title, Line.line_number)
        .join(Line, Line.text_id == SourceText.id)
        .where(Line.line_dictionary_id == ld.id)
        .order_by(SourceText.title, Line.line_number)
    )
    sources_data = [
        {"text_id": tid, "text_title": title, "line_number": ln}
        for tid, title, ln in session.exec(sources_query).all()
    ]

    return {
        "id": ld.id,
        "nom": ld.nom_text,
        "quoc_ngu": ld.quoc_ngu_text,
        "english_translation": ld.english_translation,
        "analysis": json.loads(ld.analysis) if ld.analysis else None,
        "characters": chars_data,
        "sources": sources_data,
        "stats": {
             "is_learning": prog.is_learning if prog else False,
             "next_review": prog.next_review_due if prog else None
        }
    }

# --- Feedback Endpoints ---
@app.post("/api/feedback")
def submit_feedback(
    request: FeedbackRequest,
    session: Session = Depends(get_session),
    user: Optional[User] = Depends(get_optional_user),
):
    if request.type not in ("bug", "suggestion", "other"):
        raise HTTPException(status_code=400, detail="Invalid feedback type")
    entry = Feedback(
        user_id=user.id if user else None,
        username=user.username if user else None,
        type=request.type,
        message=request.message.strip(),
    )
    session.add(entry)
    session.commit()

    notify_to = os.environ.get("FEEDBACK_NOTIFY_EMAIL", "")
    if notify_to:
        try:
            resend.api_key = os.environ.get("RESEND_API_KEY", "")
            from_addr = os.environ.get("RESEND_FROM_EMAIL", "NômFlow <noreply@nomflow.app>")
            submitter = user.username if user else "anonymous"
            safe_message = (entry.message or "").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
            resend.Emails.send({
                "from": from_addr,
                "to": [notify_to],
                "subject": f"[NômFlow Feedback] {entry.type} from {submitter}",
                "html": f"""
                    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
                        <h2 style="color: #d97706;">New {entry.type} feedback</h2>
                        <p style="color: #666; font-size: 13px;">From: <strong>{submitter}</strong></p>
                        <div style="padding: 16px; background: #f7f7f7; border-radius: 8px; white-space: pre-wrap;">{safe_message}</div>
                    </div>
                """
            })
        except Exception as e:
            print(f"Feedback notification email error: {e}")

    return {"status": "ok"}

@app.get("/api/feedback")
def get_feedback(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    entries = session.exec(select(Feedback).order_by(Feedback.created_at.desc())).all()
    return entries

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

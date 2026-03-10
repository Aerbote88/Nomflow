from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import UniqueConstraint, Index
from typing import Optional, List
from datetime import datetime

class SourceText(SQLModel, table=True):
    __tablename__ = "sourcetext"
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    author: str
    description: Optional[str] = None
    image_url: Optional[str] = None

    lines: List["Line"] = Relationship(back_populates="text")

class Character(SQLModel, table=True):
    __tablename__ = "dictionaryentry"
    id: Optional[int] = Field(default=None, primary_key=True)
    nom_char: str = Field(index=True)
    quoc_ngu: str = Field(index=True)
    popularity: int = 0
    definition: Optional[str] = None

class Expression(SQLModel, table=True):
    __tablename__ = "linedictionary"
    id: Optional[int] = Field(default=None, primary_key=True)
    nom_text: str = Field(index=True)
    quoc_ngu_text: str = Field(index=True)

    english_translation: Optional[str] = None
    analysis: Optional[str] = None # JSON string

    characters: List["ExpressionCharacter"] = Relationship(back_populates="line_dict")

class ExpressionCharacter(SQLModel, table=True):
    __tablename__ = "linedictionarycharacter"
    id: Optional[int] = Field(default=None, primary_key=True)
    line_dict_id: int = Field(foreign_key="linedictionary.id", index=True)
    dictionary_id: int = Field(foreign_key="dictionaryentry.id", index=True)
    order_in_line: int

    line_dict: Optional[Expression] = Relationship(back_populates="characters")
    dictionary_entry: Optional[Character] = Relationship()

class Line(SQLModel, table=True):
    __tablename__ = "line"
    id: Optional[int] = Field(default=None, primary_key=True)
    text_id: Optional[int] = Field(default=None, foreign_key="sourcetext.id", index=True)
    line_number: int  # 1-indexed line number
    # Link to master content
    line_dictionary_id: Optional[int] = Field(default=None, foreign_key="linedictionary.id", index=True)
    dictionary_id: Optional[int] = Field(default=None, foreign_key="dictionaryentry.id", index=True)

    text: Optional["SourceText"] = Relationship(back_populates="lines")
    line_dict: Optional["Expression"] = Relationship()
    dictionary_entry: Optional["Character"] = Relationship()

    @property
    def nom_text(self):
        if self.line_dict: return self.line_dict.nom_text
        if self.dictionary_entry: return self.dictionary_entry.nom_char
        return ""

    @property
    def quoc_ngu_text(self):
        if self.line_dict: return self.line_dict.quoc_ngu_text
        if self.dictionary_entry: return self.dictionary_entry.quoc_ngu
        return ""

    @property
    def characters(self):
        if self.line_dict:
            return self.line_dict.characters
        return []

class User(SQLModel, table=True):
    __tablename__ = "user"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    display_name: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None, index=True)
    password_hash: str
    is_admin: bool = Field(default=False)

    progress: List["UserProgress"] = Relationship(back_populates="user")
    settings: Optional["UserSettings"] = Relationship(back_populates="user")
    lists: List["StudyList"] = Relationship(back_populates="user")

class UserProgress(SQLModel, table=True):
    __tablename__ = "userprogress"
    __table_args__ = (
        UniqueConstraint('user_id', 'item_type', 'item_id', name='uq_userprogress_user_item'),
        Index('ix_userprogress_user_due', 'user_id', 'next_review_due'),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    item_type: str = Field(index=True)
    item_id: int

    # SRS Fields
    next_review_due: datetime = Field(index=True)
    interval: float = Field(default=0.0) # Days
    ease_factor: float = Field(default=2.5)
    review_count: int = Field(default=0)
    consecutive_correct: int = Field(default=0)
    is_learning: bool = Field(default=True, index=True)

    last_reviewed: Optional[datetime] = None

    # Previous State for Undo
    prev_next_review_due: Optional[datetime] = None
    prev_interval: Optional[float] = None
    prev_ease_factor: Optional[float] = None
    prev_review_count: Optional[int] = None
    prev_consecutive_correct: Optional[int] = None
    prev_is_learning: Optional[bool] = None
    prev_last_reviewed: Optional[datetime] = None

    user: Optional["User"] = Relationship(back_populates="progress")

class StudyList(SQLModel, table=True):
    __tablename__ = "studylist"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    name: str
    description: Optional[str] = None

    items: List["StudyListItem"] = Relationship(back_populates="study_list")
    user: Optional[User] = Relationship(back_populates="lists")

class StudyListItem(SQLModel, table=True):
    __tablename__ = "studylistitem"
    id: Optional[int] = Field(default=None, primary_key=True)
    study_list_id: int = Field(foreign_key="studylist.id")
    item_type: str # "line" or "character"
    item_id: int

    study_list: Optional["StudyList"] = Relationship(back_populates="items")

class UserSettings(SQLModel, table=True):
    __tablename__ = "usersettings"
    __table_args__ = (
        UniqueConstraint('user_id', name='uq_usersettings_user_id'),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    daily_new_limit: int = 10

    # Active Source (Mutually Exclusive or Priority-based)
    active_list_id: Optional[int] = Field(default=None, foreign_key="studylist.id")
    active_text_id: Optional[int] = Field(default=None, foreign_key="sourcetext.id")

    # Gamification
    total_xp: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    last_study_date: Optional[datetime] = None

    user: Optional["User"] = Relationship(back_populates="settings")

class LeaderboardEntry(SQLModel, table=True):
    __tablename__ = "leaderboardentry"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    text_id: Optional[int] = Field(default=None, foreign_key="sourcetext.id")
    list_id: Optional[int] = Field(default=None, foreign_key="studylist.id")
    mode: str = Field(default="sudden_death") # "normal" or "sudden_death"
    score: int
    achieved_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship()
    text: Optional["SourceText"] = Relationship()

class ChallengeSession(SQLModel, table=True):
    __tablename__ = "challengesession"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    text_id: Optional[int] = Field(default=None, foreign_key="sourcetext.id")
    list_id: Optional[int] = Field(default=None, foreign_key="studylist.id")
    mode: str = Field(default="sudden_death") # "normal" or "sudden_death"
    current_index: int = 0
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship()

class XpLog(SQLModel, table=True):
    __tablename__ = "xplog"
    __table_args__ = (
        Index('ix_xplog_user_timestamp', 'user_id', 'timestamp'),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    xp_amount: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    activity_type: Optional[str] = None # e.g. "Review", "Challenge"

class PasswordResetToken(SQLModel, table=True):
    __tablename__ = "passwordresettoken"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token: str = Field(index=True, unique=True)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Feedback(SQLModel, table=True):
    __tablename__ = "feedback"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    username: Optional[str] = None
    type: str  # "bug", "suggestion", "other"
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

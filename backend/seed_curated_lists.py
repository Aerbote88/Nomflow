
import sqlite3
from . import nom_grades_data
import os

def seed():
    # Target the learning.db in the root relative to this script in backend/
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, '..', 'learning.db')
    
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found.")
        # Fallback to local if running from root
        db_path = 'learning.db'
        if not os.path.exists(db_path):
            print("Fallback also failed.")
            return

    print(f"Connecting to: {os.path.abspath(db_path)}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables_raw = cursor.fetchall()
    tables = [t[0].lower() for t in tables_raw]
    print("Tables in DB:", tables)
    
    # Map SQLModel names to real table names (usually lowercase)
    tbl_source = 'sourcetext'
    tbl_line = 'line'
    tbl_char = 'character'
    tbl_list = 'studylist'
    tbl_list_item = 'studylistitem'
    
    # 1. Process each Grade/List
    # config: (list_name, author, description, data)
    curated_config = [
        ("Grade 1: Fundamentals", "Chunom.org", "Graded frequency lists for systematic learning.", nom_grades_data.grade1),
        ("Grade 2: Intermediate", "Chunom.org", "Graded frequency lists for systematic learning.", nom_grades_data.grade2),
        ("Grade 3: Advanced", "Chunom.org", "Graded frequency lists for systematic learning.", nom_grades_data.grade3),
        ("Grade 4: Expert", "Chunom.org", "Graded frequency lists for systematic learning.", nom_grades_data.grade4),
        ("Common Animals", "Digitizing Vietnam Team", "A curated list of common animals and their Nôm characters.", nom_grades_data.animal_list),
    ]
    
    for list_name, author, desc, data in curated_config:
        print(f"Processing {list_name} by {author} ({len(data)} characters)...")
        
        # 1. Ensure SourceText exists
        # For Grades, we group them under one SourceText if we want, 
        # but User said they should be separate or at least have different authors.
        # Let's keep one SourceText per Grade/List for simplicity in this refined approach if preferred,
        # OR group by Author. 
        # User said: "I wanted the animals to go in the curated list section... author should be Digitizing Vietnam Team"
        # The dashbord pulls based on text.author.
        
        # We'll use list_name as SourceText title for "Common Animals", 
        # but for Grades we might want to keep them under "Standard Nôm Curriculum" or separate them.
        # Usually Curry is one text with many grades. 
        # Let's use list_name as the title for the animal list.
        
        source_title = list_name if "Grade" not in list_name else "Standard Nôm Curriculum"
        
        cursor.execute(f"SELECT id FROM {tbl_source} WHERE title=?", (source_title,))
        res = cursor.fetchone()
        if res:
            source_id = res[0]
            # Update author if needed
            cursor.execute(f"UPDATE {tbl_source} SET author=? WHERE id=?", (author, source_id))
        else:
            cursor.execute(f"INSERT INTO {tbl_source} (title, author, description) VALUES (?, ?, ?)", 
                           (source_title, author, desc))
            source_id = cursor.lastrowid

        # 2. Add characters to the SourceText
        for nom, qn in data:
            line_text = nom
            # Use line_number to keep order if grades are in one text
            cursor.execute(f"SELECT MAX(line_number) FROM {tbl_line} WHERE text_id=?", (source_id,))
            max_ln_res = cursor.fetchone()
            max_ln = max_ln_res[0] if max_ln_res and max_ln_res[0] else 0
            
            cursor.execute(f"SELECT id FROM {tbl_line} WHERE text_id=? AND nom_text=?", (source_id, line_text))
            res = cursor.fetchone()
            if res:
                line_id = res[0]
            else:
                cursor.execute(f"INSERT INTO {tbl_line} (text_id, line_number, nom_text, quoc_ngu_text) VALUES (?, ?, ?, ?)", 
                               (source_id, max_ln + 1, line_text, qn))
                line_id = cursor.lastrowid
            
            # Create the Character record
            cursor.execute(f"SELECT id FROM {tbl_char} WHERE line_id=? AND nom_char=?", (line_id, nom))
            res = cursor.fetchone()
            if not res:
                cursor.execute(f"INSERT INTO {tbl_char} (nom_char, quoc_ngu_char, line_id, order_in_line) VALUES (?, ?, ?, ?)", 
                               (nom, qn, line_id, 0))
                
    conn.commit()
    conn.close()
    print("Seeding complete!")


def seed_prose():
    """Seed prose-level curated texts via SQLModel engine.

    Uses the configured DATABASE_URL (Postgres in prod / Supabase, SQLite locally).
    Independent of seed() so it runs even if the character-level seeder fails.
    """
    from sqlmodel import Session, select
    from .database import engine
    from .models import SourceText, Expression, Line

    BORG_DESC_TEMPLATE = (
        "{prayer_en} from Borg.tonch.18, an 18th-century Vietnamese "
        "Catholic prayer manuscript by Philipphê Bỉnh held at the "
        "Biblioteca Apostolica Vaticana. Full transcription by Nguyễn Nam: "
        "https://www.digitizingvietnam.com/en/our-collections/the-han-nom-catholic-prayer-philipphe-binh/borg-tonch-18"
    )
    BORG_AUTHOR = "Nguyễn Nam (Transcription)"

    prose_texts = [
        {
            "title": "Kinh Tin Kính (Apostles' Creed)",
            "author": BORG_AUTHOR,
            "description": BORG_DESC_TEMPLATE.format(prayer_en="Apostles' Creed"),
            "lines": nom_grades_data.borg_tonch_18_kinh_tin_kinh,
        },
        {
            "title": "Kinh Thiên Chúa (Lord's Prayer)",
            "author": BORG_AUTHOR,
            "description": BORG_DESC_TEMPLATE.format(prayer_en="The Lord's Prayer (Pater Noster)"),
            "lines": nom_grades_data.borg_tonch_18_kinh_thien_chua,
        },
        {
            "title": "Kinh A-ve (Hail Mary)",
            "author": BORG_AUTHOR,
            "description": BORG_DESC_TEMPLATE.format(prayer_en="The Hail Mary (Ave Maria)"),
            "lines": nom_grades_data.borg_tonch_18_kinh_ave,
        },
    ]

    with Session(engine) as session:
        print(f"Connected via engine: {engine.url.render_as_string(hide_password=True)}")
        for t in prose_texts:
            seed_prose_text_orm(session, t["title"], t["author"], t["description"], t["lines"])
        session.commit()
    print("Prose seeding complete!")


import re


def _extract_char_readings(lines):
    """Best-effort per-character (nom_char, quoc_ngu) reading map from prose tuples.

    Splits each Quốc ngữ line on whitespace and hyphens (transliterations like
    "Giê-su" count as separate syllables, matching the per-Nôm-codepoint layout).
    Codepoints that are whitespace or ASCII punctuation in the Nôm are stripped
    before alignment. Returns {nom_char: quoc_ngu_reading} where first occurrence
    wins. Lines whose codepoint count doesn't match the syllable count are
    skipped silently — defensive against unexpected punctuation or alignment
    quirks; chars from those lines that appear elsewhere will still be picked up.
    """
    readings = {}
    for row in lines:
        nom, qn = row[0], row[1]
        nom_chars = [
            ch for ch in nom
            if not ch.isspace() and not (ord(ch) < 128 and not ch.isalnum())
        ]
        syllables = [s for s in re.split(r'[\s\-]+', qn.strip()) if s]
        if len(nom_chars) != len(syllables):
            continue
        for ch, syl in zip(nom_chars, syllables):
            readings.setdefault(ch, syl)
    return readings


def seed_prose_text_orm(session, title, author, description, lines):
    """Upsert one prose curated text via SQLModel session.

    Each tuple is (nom, qn) or (nom, qn, english). One Expression row + one Line
    row per tuple, in order. Each codepoint of the Nôm text is also linked to
    a Character (dictionaryentry) row via an ExpressionCharacter row, so the
    SRS new-items query at backend/main.py:1233-1250 can surface individual
    character cards. New characters not already in the dictionary are inserted
    using readings derived from the line-level Nôm↔QN alignment. Idempotent
    on re-run.
    """
    from sqlmodel import select
    from .models import SourceText, Expression, ExpressionCharacter, Character, Line

    # Avoid Windows cp1252 console encoding crashes when the title/author
    # contains characters like 'ễ'.
    safe_title = title.encode("ascii", "replace").decode("ascii")
    safe_author = author.encode("ascii", "replace").decode("ascii")
    print(f"Processing prose text '{safe_title}' by {safe_author} ({len(lines)} lines)...")

    src = session.exec(select(SourceText).where(SourceText.title == title)).first()
    if src:
        src.author = author
        src.description = description
    else:
        src = SourceText(title=title, author=author, description=description)
        session.add(src)
    session.flush()  # populate src.id

    # Backfill the dictionary with any new characters from this prose text,
    # using readings derived from the line-level Nôm↔QN alignment. Existing
    # Character entries are left untouched — their data is canonical.
    derived_readings = _extract_char_readings(lines)
    inserted_chars = 0
    for nom_char, reading in derived_readings.items():
        existing = session.exec(
            select(Character).where(Character.nom_char == nom_char)
        ).first()
        if existing is None:
            session.add(Character(nom_char=nom_char, quoc_ngu=reading, popularity=0))
            inserted_chars += 1
    if inserted_chars:
        session.flush()
        print(f"  inserted {inserted_chars} new Character entries from prose alignment")

    # Cache Character lookups across all lines in this text to avoid an N+1
    # query storm. Built lazily as new codepoints are encountered.
    char_cache: dict[str, "Character | None"] = {}

    def lookup_char(nom_char: str):
        if nom_char in char_cache:
            return char_cache[nom_char]
        entry = session.exec(
            select(Character).where(Character.nom_char == nom_char)
        ).first()
        char_cache[nom_char] = entry
        return entry

    missing_chars: set[str] = set()

    for idx, row in enumerate(lines, start=1):
        nom, qn = row[0], row[1]
        english = row[2] if len(row) > 2 else None

        expr = session.exec(
            select(Expression).where(Expression.nom_text == nom, Expression.quoc_ngu_text == qn)
        ).first()
        if expr:
            if english is not None:
                expr.english_translation = english
        else:
            expr = Expression(nom_text=nom, quoc_ngu_text=qn, english_translation=english)
            session.add(expr)
            session.flush()

        line = session.exec(
            select(Line).where(Line.text_id == src.id, Line.line_number == idx)
        ).first()
        if line:
            line.line_dictionary_id = expr.id
            line.dictionary_id = None
        else:
            session.add(Line(text_id=src.id, line_number=idx, line_dictionary_id=expr.id))

        # Link each Nôm codepoint to its Character entry so character cards
        # surface in SRS sessions for this text. Skip whitespace and ASCII
        # punctuation; only link existing dictionary entries.
        existing_links = {
            ec.order_in_line
            for ec in session.exec(
                select(ExpressionCharacter).where(ExpressionCharacter.line_dict_id == expr.id)
            ).all()
        }
        for char_idx, ch in enumerate(nom):
            if ch.isspace() or (ord(ch) < 128 and not ch.isalnum()):
                continue
            if char_idx in existing_links:
                continue
            char_entry = lookup_char(ch)
            if char_entry is None:
                missing_chars.add(ch)
                continue
            session.add(ExpressionCharacter(
                line_dict_id=expr.id,
                dictionary_id=char_entry.id,
                order_in_line=char_idx,
            ))

    if missing_chars:
        sample = "".join(sorted(missing_chars)[:20])
        safe_sample = sample.encode("ascii", "replace").decode("ascii")
        print(
            f"  warning: {len(missing_chars)} codepoint(s) had no Character entry "
            f"and were skipped (sample: {safe_sample})"
        )


def seed_prose_text(cursor, title, author, description, lines):
    """Seed a prose curated text using the Expression (linedictionary) path.

    Each tuple is (nom, qn) or (nom, qn, english). One Expression row and one
    Line row per tuple, in order. Idempotent.
    """
    tbl_source = 'sourcetext'
    tbl_line = 'line'
    tbl_expr = 'linedictionary'

    print(f"Processing prose text '{title}' by {author} ({len(lines)} lines)...")

    # Upsert SourceText
    cursor.execute(f"SELECT id FROM {tbl_source} WHERE title=?", (title,))
    res = cursor.fetchone()
    if res:
        source_id = res[0]
        cursor.execute(
            f"UPDATE {tbl_source} SET author=?, description=? WHERE id=?",
            (author, description, source_id),
        )
    else:
        cursor.execute(
            f"INSERT INTO {tbl_source} (title, author, description) VALUES (?, ?, ?)",
            (title, author, description),
        )
        source_id = cursor.lastrowid

    for idx, row in enumerate(lines, start=1):
        nom, qn = row[0], row[1]
        english = row[2] if len(row) > 2 else None

        # Upsert Expression (linedictionary), keyed on Nôm+QN. Refresh english.
        cursor.execute(
            f"SELECT id FROM {tbl_expr} WHERE nom_text=? AND quoc_ngu_text=?",
            (nom, qn),
        )
        res = cursor.fetchone()
        if res:
            expr_id = res[0]
            if english is not None:
                cursor.execute(
                    f"UPDATE {tbl_expr} SET english_translation=? WHERE id=?",
                    (english, expr_id),
                )
        else:
            cursor.execute(
                f"INSERT INTO {tbl_expr} (nom_text, quoc_ngu_text, english_translation) VALUES (?, ?, ?)",
                (nom, qn, english),
            )
            expr_id = cursor.lastrowid

        # Upsert Line for this SourceText at this position
        cursor.execute(
            f"SELECT id FROM {tbl_line} WHERE text_id=? AND line_number=?",
            (source_id, idx),
        )
        res = cursor.fetchone()
        if res:
            cursor.execute(
                f"UPDATE {tbl_line} SET line_dictionary_id=?, dictionary_id=NULL WHERE id=?",
                (expr_id, res[0]),
            )
        else:
            cursor.execute(
                f"INSERT INTO {tbl_line} (text_id, line_number, line_dictionary_id) VALUES (?, ?, ?)",
                (source_id, idx, expr_id),
            )


if __name__ == "__main__":
    import sys
    if "--prose-only" in sys.argv:
        seed_prose()
    else:
        try:
            seed()
        except Exception as e:
            print(f"seed() failed: {e}")
        seed_prose()


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

if __name__ == "__main__":
    seed()

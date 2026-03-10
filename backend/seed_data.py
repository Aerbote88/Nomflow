from sqlmodel import Session, select
from backend.database import engine, create_db_and_tables
from backend.models import Line, Character, UserProgress, StudyList

def seed_data():
    create_db_and_tables()
    
    with Session(engine) as session:
        # Check if already seeded
        existing = session.exec(select(Line)).first()
        if existing:
            print("Database already contains data.")
            return

        print("Seeding database...")
        
        # Data from search results + Quoc Ngu
        # Line 1: Trăm năm trong cõi người ta / 𤾓𢆥𥪝𡎝𠊛些
        l1 = Line(line_number=1, nom_text="𤾓𢆥𥪝𡎝𠊛些", quoc_ngu_text="Trăm năm trong cõi người ta")
        l1_chars = [
            Character(nom_char="𤾓", quoc_ngu_char="Trăm", order_in_line=0, line=l1),
            Character(nom_char="𢆥", quoc_ngu_char="năm", order_in_line=1, line=l1),
            Character(nom_char="𥪝", quoc_ngu_char="trong", order_in_line=2, line=l1),
            Character(nom_char="𡎝", quoc_ngu_char="cõi", order_in_line=3, line=l1),
            Character(nom_char="𠊛", quoc_ngu_char="người", order_in_line=4, line=l1),
            Character(nom_char="些", quoc_ngu_char="ta", order_in_line=5, line=l1),
        ]
        
        # Line 2: Chữ tài chữ mệnh khéo là ghét nhau / 𡨸才𡨸命𠹾羅𢞂饒 (Common variant from user request context "menh" vs "sac")
        # Search result gave "Sac" variant, but user prompt used "menh". Let's stick to user request "menh" if possible, 
        # or use the "sac" variant if unicode is better known.
        # User prompt: "Chữ tài chữ mệnh khéo là ghét nhau"
        # Search result 2 mentions: 𡦂才𡦂命窖羅恄饒
        l2 = Line(line_number=2, nom_text="𡦂才𡦂命窖羅恄饒", quoc_ngu_text="Chữ tài chữ mệnh khéo là ghét nhau")
        l2_chars = [
            Character(nom_char="𡦂", quoc_ngu_char="Chữ", order_in_line=0, line=l2),
            Character(nom_char="才", quoc_ngu_char="tài", order_in_line=1, line=l2),
            Character(nom_char="𡦂", quoc_ngu_char="chữ", order_in_line=2, line=l2),
            Character(nom_char="命", quoc_ngu_char="mệnh", order_in_line=3, line=l2),
            Character(nom_char="窖", quoc_ngu_char="khéo", order_in_line=4, line=l2),
            Character(nom_char="羅", quoc_ngu_char="là", order_in_line=5, line=l2),
            Character(nom_char="恄", quoc_ngu_char="ghét", order_in_line=6, line=l2),
            Character(nom_char="饒", quoc_ngu_char="nhau", order_in_line=7, line=l2),
        ]

        # Add to session
        session.add(l1)
        for c in l1_chars: session.add(c)
        
        session.add(l2)
        for c in l2_chars: session.add(c)
        
        session.commit()
        print("Database seeded successfully.")

if __name__ == "__main__":
    seed_data()

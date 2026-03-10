import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

raw_url = os.getenv("DATABASE_URL")

if raw_url and "://" in raw_url:
    prefix, rest = raw_url.split("://", 1)
    at_split = rest.rsplit("@", 1)
    if len(at_split) == 2:
        user_pass, host_port_db = at_split
        user_split = user_pass.split(":", 1)
        if len(user_split) == 2:
            username, password = user_split
            encoded_pass = quote_plus(password)
            final_url = f"postgresql://{username}:{encoded_pass}@{host_port_db}"
            
            try:
                engine = create_engine(final_url)
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';")).fetchall()
                    print("Tables and Row Counts in Supabase:")
                    for row in result:
                        table_name = row[0]
                        try:
                            count_res = conn.execute(text(f'SELECT count(*) FROM "{table_name}"')).one()
                            print(f" - {table_name}: {count_res[0]}")
                        except Exception as e:
                            print(f" - {table_name}: ERROR counting ({e})")
            except Exception as e:
                print(f"Connection Error: {e}")
        else:
            print("Failed to split username:password")
    else:
        print("Failed to split user_pass@host")
else:
    print("DATABASE_URL not found or invalid format")

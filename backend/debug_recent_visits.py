
from sqlalchemy import create_engine, text
import os

DATABASE_URL = "postgresql://neondb_owner:npg_6Eky0dKJiQzL@ep-fancy-grass-a2128859-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

def check_recent_visits():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, office_id, status, outcome, created_at FROM visits ORDER BY created_at DESC LIMIT 5"))
        print("\nRecent Visits:")
        for row in result:
            print(f"ID: {row[0]}, Office: {row[1]}, Status: '{row[2]}', Outcome: '{row[3]}', Time: {row[4]}")

if __name__ == "__main__":
    check_recent_visits()


import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine
from app import models

def migrate_visit_lists():
    print("Migrating visit lists tables...")
    try:
        models.VisitList.__table__.create(bind=engine, checkfirst=True)
        models.VisitListMember.__table__.create(bind=engine, checkfirst=True)
        print("Visit List tables created successfully.")
    except Exception as e:
        print(f"Error migrating visit lists: {e}")

if __name__ == "__main__":
    migrate_visit_lists()

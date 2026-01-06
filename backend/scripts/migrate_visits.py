
import sys
import os

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine
from app import models

def migrate_visits():
    print("Migrating visits table...")
    try:
        # Drop the table to force recreation with new columns
        print("Dropping visits table...")
        models.Visit.__table__.drop(bind=engine, checkfirst=True)
        
        print("Creating visits table...")
        models.Visit.__table__.create(bind=engine)
        print("Visits table recreated successfully.")
    except Exception as e:
        print(f"Error migrating visits: {e}")

if __name__ == "__main__":
    migrate_visits()

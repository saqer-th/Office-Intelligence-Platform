import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine, Base
from app.models import User
import datetime

def migrate_users():
    print("Creating 'users' table...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")
    
    # Seed default users
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=engine)
    db = Session()
    
    if not db.query(User).filter(User.email == "admin@oomi.com").first():
        print("Seeding Admin user...")
        admin = User(
            name="Saqer Al Saqri",
            email="admin@oomi.com",
            role="Admin",
            created_at=datetime.datetime.utcnow()
        )
        db.add(admin)
        
        operator = User(
            name="Team Member",
            email="team@oomi.com",
            role="Operator",
            created_at=datetime.datetime.utcnow()
        )
        db.add(operator)
        db.commit()
        print("Users seeded.")
    else:
        print("Users already exist.")
        
    db.close()

if __name__ == "__main__":
    migrate_users()

from app.db import SessionLocal
from app import models, auth
from datetime import datetime

def create_admin():
    db = SessionLocal()
    email = "admin@oomi.com"
    password = "admin"
    
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        print(f"User {email} already exists. Updating password.")
        existing.hashed_password = auth.get_password_hash(password)
        existing.role = "Admin"
    else:
        print(f"Creating user {email}")
        user = models.User(
            email=email,
            name="Admin User",
            hashed_password=auth.get_password_hash(password),
            role="Admin",
            created_at=datetime.utcnow()
        )
        db.add(user)
    
    db.commit()
    db.close()
    print("Done")

if __name__ == "__main__":
    create_admin()

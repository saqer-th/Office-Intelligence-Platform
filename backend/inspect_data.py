from app.db import SessionLocal
from app import models

def inspect_data():
    db = SessionLocal()
    try:
        print("--- Inspecting Interested Offices ---")
        offices = db.query(models.Office).filter(models.Office.interest_status == "Interested").all()
        for o in offices:
            print(f"ID: {o.id}, Name: {o.name}, District: {o.district}, Interest: {o.interest_status}")
            
        print("\n--- Inspecting 'Al Wahat' Offices ---")
        wahat_offices = db.query(models.Office).filter(models.Office.district == "الواحة").all()
        print(f"Total in Al Wahat: {len(wahat_offices)}")
        for o in wahat_offices:
            print(f"ID: {o.id}, Interest: {o.interest_status}")

    except Exception as e:
        print(e)
    finally:
        db.close()

if __name__ == "__main__":
    inspect_data()

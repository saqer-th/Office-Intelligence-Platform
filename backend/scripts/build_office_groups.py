import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import (
    Office,
    OfficeScore,
    OfficeGroup,
    OfficeGroupMember,
    OfficePlaybook,
    GroupPlaybook,
)

GRID_SIZE_LAT = 0.005
GRID_SIZE_LNG = 0.005


def grid_key(lat, lng):
    lat_index = math.floor(lat / GRID_SIZE_LAT)
    lng_index = math.floor(lng / GRID_SIZE_LNG)
    return f"{lat_index}_{lng_index}"


def main():
    load_dotenv()
    session = SessionLocal()
    try:
        session.query(OfficeGroupMember).delete()
        session.query(OfficeGroup).delete()
        session.query(OfficePlaybook).delete()
        session.query(GroupPlaybook).delete()
        session.commit()

        rows = (
            session.query(
                Office.id,
                Office.city,
                Office.district,
                Office.latitude,
                Office.longitude,
                OfficeScore.priority_score,
            )
            .outerjoin(OfficeScore, OfficeScore.office_id == Office.id)
            .all()
        )

        by_grid = defaultdict(list)
        by_district = defaultdict(list)
        for office_id, city, district, lat, lng, priority in rows:
            if lat is not None and lng is not None:
                by_grid[grid_key(lat, lng)].append(
                    (office_id, city, district, priority)
                )
            if district:
                by_district[(city, district)].append(
                    (office_id, city, district, priority)
                )

        groups = []
        used_offices = set()

        for grid_id, members in by_grid.items():
            if len(members) < 3:
                continue
            group_name = f"Grid {grid_id}"
            groups.append((group_name, None, None, grid_id, members))
            used_offices.update([office_id for office_id, _, _, _ in members])

        for (city, district), members in by_district.items():
            remaining = [
                member for member in members if member[0] not in used_offices
            ]
            if len(remaining) < 3:
                continue
            group_name = f"{city or ''} {district or ''}".strip()
            groups.append((group_name, city, district, None, remaining))
            used_offices.update([office_id for office_id, _, _, _ in remaining])

        now = datetime.utcnow()
        for group_name, city, district, grid_id, members in groups:
            priorities = [
                float(priority) for _, _, _, priority in members if priority is not None
            ]
            priority_score = sum(priorities) / len(priorities) if priorities else None
            group = OfficeGroup(
                group_name=group_name or "Group",
                city=city,
                district=district,
                grid_id=grid_id,
                status="New",
                interested_count=0,
                total_offices=len(members),
                priority_score=priority_score,
                last_action_date=None,
                notes=None,
            )
            session.add(group)
            session.flush()

            for office_id, _, _, _ in members:
                session.add(OfficeGroupMember(
                    group_id=group.id,
                    office_id=office_id,
                    interest_status="Unknown",
                    last_contact_date=None,
                ))

            session.add(GroupPlaybook(
                group_id=group.id,
                current_step="Identify group",
                next_action="Identify group",
                ready_for_visit=0,
            ))

        for office_id, _, _, _, _, _ in rows:
            session.add(OfficePlaybook(
                office_id=office_id,
                current_step="First Contact",
                next_action="First Contact",
                last_updated=now,
            ))

        session.commit()
        print(f"Created {len(groups)} groups and {len(rows)} office playbooks.")
    finally:
        session.close()


if __name__ == "__main__":
    main()

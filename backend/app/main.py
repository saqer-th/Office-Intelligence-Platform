from datetime import datetime, timedelta
import logging
import logging
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import bindparam, func, or_, text, case
from .db import SessionLocal, engine
from . import models, schemas, auth
from fastapi.security import OAuth2PasswordRequestForm


def serialize_office(office, metrics, scores, outreach, group):
    return {
        "id": office.id,
        "name": office.name,
        "city": office.city,
        "district": office.district,
        "phone": office.phone,
        "rating": office.rating,
        "latitude": office.latitude,
        "longitude": office.longitude,
        "nearest_office_distance_m": metrics.nearest_office_distance_m if metrics else None,
        "nearby_300m": metrics.nearby_300m if metrics else 0,
        "nearby_500m": metrics.nearby_500m if metrics else 0,
        "nearby_1km": metrics.nearby_1km if metrics else 0,
        "market_density_score": (
            float(scores.market_density_score)
            if scores and scores.market_density_score is not None
            else None
        ),
        "priority_score": (
            float(scores.priority_score)
            if scores and scores.priority_score is not None
            else None
        ),
        "contact_status": outreach.contact_status if outreach else "New",
        "group_id": group.id if group else None,
        "group_name": group.group_name if group else None,
        "interest_status": office.interest_status,
    }


def serialize_office_detail(office, metrics, scores, outreach, group):
    payload = serialize_office(office, metrics, scores, outreach, group)
    payload.update({
        "node_id": office.node_id,
        "region": office.region,
        "district": office.district,
        "phone": office.phone,
        "rating_count": office.rating_count,
        "google_maps_url": office.google_maps_url,
        "profile_url": office.profile_url,
        "interest_status": office.interest_status,
        "assigned_to": outreach.assigned_to if outreach else None,
        "last_contact_date": outreach.last_contact_date if outreach else None,
        "notes": outreach.notes if outreach else None,
        "created_at": office.created_at,
        "updated_at": office.updated_at,
    })
    return payload


def compute_group_ready(group, priority_threshold, last_visit_date):
    if group.interested_count is None or group.priority_score is None:
        return False
    if group.interested_count < 3:
        return False
    if float(group.priority_score) < priority_threshold:
        return False
    if last_visit_date and last_visit_date >= datetime.utcnow() - timedelta(days=14):
        return False
    return True


def recalculate_group_status(group_id: int, db: Session, priority_threshold: float = 70) -> str:
    interested_count = (
        db.query(func.count(models.OfficeGroupMember.office_id))
        .filter(models.OfficeGroupMember.group_id == group_id)
        .filter(models.OfficeGroupMember.interest_status == "Interested")
        .scalar()
        or 0
    )
    last_visit_date = (
        db.query(func.max(models.Visit.completed_at))
        .filter(models.Visit.group_id == group_id)
        .filter(models.Visit.status == "Completed")
        .scalar()
    )
    group = db.query(models.OfficeGroup).filter(models.OfficeGroup.id == group_id).first()
    if not group:
        return "Monitoring"

    ready = compute_group_ready(group, priority_threshold, last_visit_date)
    status = "ReadyForVisit" if ready else "Monitoring"
    db.query(models.OfficeGroup).filter(models.OfficeGroup.id == group_id).update({
        "interested_count": interested_count,
        "status": status,
        "last_action_date": datetime.utcnow()
    })
    db.commit()
    return status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oomi-api")

app = FastAPI(title="Office Intelligence Platform API")


@app.on_event("startup")
def log_startup():
    # Create tables if they don't exist
    models.Base.metadata.create_all(bind=engine)
    port = 8000
    logger.info("Backend starting on port %s", port)
    logger.info("Health check available at /health")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://office-intelligence-platform.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/token", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Try to fetch user by email (form_data.username will be the email)
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not user.hashed_password or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users/me")
def read_users_me(
    current_user: models.User = Depends(auth.get_current_user)
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role
    }


@app.post("/users", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin)
):
    # Check existing
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
        role=user.role,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# New delete endpoints (Admin only)
@app.delete("/offices/{office_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_office(
    office_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin)
):
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    # Cascade delete related info if needed or rely on DB FK cascade
    # For safety, manual cleanup of 1-to-1 or strict dependencies is good, but let's assume FKs handle simpler cases or raw delete is intention.
    # Note: Many FKs exist. Be careful.
    
    db.delete(office)
    db.commit()
    return None




@app.get("/districts")
def list_districts(db: Session = Depends(get_db)):
    results = (
        db.query(
            models.Office.district,
            func.max(models.Office.city).label("city"),
            func.count(models.Office.id).label("total_offices"),
            func.sum(case((models.Office.interest_status == 'Interested', 1), else_=0)).label("interested"),
            func.sum(case((models.Office.interest_status == 'Onboarded', 1), else_=0)).label("visited")
        )
        .filter(models.Office.district.isnot(None))
        .group_by(models.Office.district)
        .order_by(models.Office.district)
        .all()
    )
    
    return [
        {
            "district": r.district,
            "city": r.city,
            "total_offices": r.total_offices,
            "interested": r.interested or 0,
            "visited": r.visited or 0
        }
        for r in results
    ]


@app.get("/offices", response_model=schemas.OfficeListResponse)
def list_offices(
    minLat: float | None = Query(default=None, alias="minLat"),
    maxLat: float | None = Query(default=None, alias="maxLat"),
    minLng: float | None = Query(default=None, alias="minLng"),
    maxLng: float | None = Query(default=None, alias="maxLng"),
    rating_min: float | None = Query(default=None),
    city: str | None = Query(default=None),
    district: str | None = Query(default=None),
    nearby500_min: int | None = Query(default=None),
    search: str | None = Query(default=None, description="Search by office name"),
    interest_status: str | None = Query(default=None),
    contact_status: str | None = Query(default=None),
    ids: str | None = Query(default=None, description="Comma-separated list of IDs"),
    limit: int = Query(default=1000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    logger.info(
        "GET /offices params minLat=%s maxLat=%s minLng=%s maxLng=%s rating_min=%s city=%s district=%s nearby500_min=%s search=%s interest_status=%s contact_status=%s ids=%s limit=%s",
        minLat,
        maxLat,
        minLng,
        maxLng,
        rating_min,
        city,
        district,
        nearby500_min,
        search,
        interest_status,
        contact_status,
        ids,
        limit,
    )

    query = (
        db.query(
            models.Office,
            models.OfficeGeoMetrics,
            models.OfficeScore,
            models.OfficeOutreach,
            models.OfficeGroup
        )
        .outerjoin(
            models.OfficeGeoMetrics,
            models.OfficeGeoMetrics.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeScore,
            models.OfficeScore.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeOutreach,
            models.OfficeOutreach.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeGroupMember,
            models.OfficeGroupMember.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeGroup,
            models.OfficeGroup.id == models.OfficeGroupMember.group_id
        )
    )

    if ids:
        try:
            id_list = [int(x) for x in ids.split(",") if x.strip()]
            if id_list:
                query = query.filter(models.Office.id.in_(id_list))
        except ValueError:
            pass # Ignore invalid IDs

    if search:
        query = query.filter(models.Office.name.ilike(f"%{search}%"))

    if minLat is not None:
        query = query.filter(models.Office.latitude >= minLat)
    if maxLat is not None:
        query = query.filter(models.Office.latitude <= maxLat)
    if minLng is not None:
        query = query.filter(models.Office.longitude >= minLng)
    if maxLng is not None:
        query = query.filter(models.Office.longitude <= maxLng)
    
    if city:
        query = query.filter(models.Office.city == city)
    if district:
        query = query.filter(models.Office.district == district)
    

    if interest_status:
         # Fix: interest_status is on Office model, not OfficeOutreach
         if interest_status == "Interested":
             query = query.filter(models.Office.interest_status == "Interested")
         elif interest_status in ["Visited", "Contacted", "New"]:
             query = query.filter(models.OfficeOutreach.contact_status == interest_status)
         else:
             # Fallback check both
             query = query.filter(or_(
                 models.Office.interest_status == interest_status,
                 models.OfficeOutreach.contact_status == interest_status
             ))

    if contact_status:
        query = query.filter(models.OfficeOutreach.contact_status == contact_status)

    if rating_min is not None:
        query = query.filter(models.Office.rating >= rating_min)
    if nearby500_min is not None:
        query = query.filter(func.coalesce(models.OfficeGeoMetrics.nearby_500m, 0) >= nearby500_min)

    # Ensure we filter out bad data if needed, or keep consistent with previous logic
    query = query.filter(models.Office.latitude.isnot(None))
    query = query.filter(models.Office.longitude.isnot(None))

    rows = query.limit(limit).all()
    logger.info("GET /offices rows=%s", len(rows))
    return {
        "count": len(rows),
        "data": [
        serialize_office(office, metrics, scores, outreach, group)
        for office, metrics, scores, outreach, group in rows
        ]
    }


@app.get("/offices/{office_id}", response_model=schemas.OfficeDetail)
def get_office(office_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(
            models.Office,
            models.OfficeGeoMetrics,
            models.OfficeScore,
            models.OfficeOutreach,
            models.OfficeGroup
        )
        .outerjoin(
            models.OfficeGeoMetrics,
            models.OfficeGeoMetrics.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeScore,
            models.OfficeScore.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeOutreach,
            models.OfficeOutreach.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeGroupMember,
            models.OfficeGroupMember.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeGroup,
            models.OfficeGroup.id == models.OfficeGroupMember.group_id
        )
        .filter(models.Office.id == office_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Office not found")
    office, metrics, scores, outreach, group = row
    return serialize_office_detail(office, metrics, scores, outreach, group)


@app.get("/offices/{office_id}/messages")
def office_messages(office_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            "SELECT id, direction, status, body, created_at "
            "FROM oomi_messages WHERE office_id = :office_id "
            "ORDER BY created_at DESC LIMIT 100"
        ),
        {"office_id": office_id}
    ).mappings().all()
    return {"count": len(rows), "data": rows}


@app.get("/offices/{office_id}/visits")
def office_visits(office_id: int, db: Session = Depends(get_db)):
    group_id = (
        db.query(models.OfficeGroupMember.group_id)
        .filter(models.OfficeGroupMember.office_id == office_id)
        .scalar()
    )
    if not group_id:
        return {"count": 0, "data": []}

    visits = (
        db.query(models.Visit)
        .filter(models.Visit.group_id == group_id)
        .order_by(models.Visit.created_at.desc())
        .all()
    )
    return {
        "count": len(visits),
        "data": [
            {
                "id": visit.id,
                "group_id": visit.group_id,
                "status": visit.status,
                "scheduled_at": visit.scheduled_at,
                "completed_at": visit.completed_at,
                "notes": visit.notes,
                "created_at": visit.created_at,
            }
            for visit in visits
        ],
    }


@app.get("/grids", response_model=list[schemas.GridCell])
def list_grids(
    minLat: float | None = Query(default=None, alias="minLat"),
    maxLat: float | None = Query(default=None, alias="maxLat"),
    minLng: float | None = Query(default=None, alias="minLng"),
    maxLng: float | None = Query(default=None, alias="maxLng"),
    limit: int = Query(default=2000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    query = db.query(models.OfficeGrid)
    if minLat is not None and maxLat is not None:
        query = query.filter(models.OfficeGrid.center_lat >= minLat)
        query = query.filter(models.OfficeGrid.center_lat <= maxLat)
    if minLng is not None and maxLng is not None:
        query = query.filter(models.OfficeGrid.center_lng >= minLng)
        query = query.filter(models.OfficeGrid.center_lng <= maxLng)

    grids = query.limit(limit).all()
    if not grids:
        return []

    max_count = max(grid.office_count or 0 for grid in grids) or 1
    response = []
    for grid in grids:
        density_score = (grid.office_count / max_count) * 100 if max_count else 0
        response.append({
            "grid_id": grid.grid_id,
            "city": grid.city,
            "center_lat": grid.center_lat,
            "center_lng": grid.center_lng,
            "office_count": grid.office_count,
            "avg_rating": grid.avg_rating,
            "density_score": density_score,
        })
    return response


@app.get("/groups", response_model=list[schemas.GroupBase])
def list_groups(
    minLat: float | None = Query(default=None, alias="minLat"),
    maxLat: float | None = Query(default=None, alias="maxLat"),
    minLng: float | None = Query(default=None, alias="minLng"),
    maxLng: float | None = Query(default=None, alias="maxLng"),
    rating_min: float | None = Query(default=None),
    city: str | None = Query(default=None),
    district: str | None = Query(default=None),
    nearby500_min: int | None = Query(default=None),
    priority_threshold: float = Query(default=70),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    rating_min_param = bindparam("rating_min", rating_min)
    city_param = bindparam("city", city)
    district_param = bindparam("district", district)
    nearby500_param = bindparam("nearby500_min", nearby500_min)

    query = (
        db.query(models.OfficeGroup)
        .join(
            models.OfficeGroupMember,
            models.OfficeGroupMember.group_id == models.OfficeGroup.id
        )
        .join(models.Office, models.Office.id == models.OfficeGroupMember.office_id)
        .outerjoin(
            models.OfficeGeoMetrics,
            models.OfficeGeoMetrics.office_id == models.Office.id
        )
        .filter(or_(city_param.is_(None), models.Office.city == city_param))
        .filter(or_(district_param.is_(None), models.Office.district == district_param))
        .filter(or_(rating_min_param.is_(None), models.Office.rating >= rating_min_param))
        .filter(
            or_(
                nearby500_param.is_(None),
                func.coalesce(models.OfficeGeoMetrics.nearby_500m, 0) >= nearby500_param
            )
        )
    )

    if minLat is not None and maxLat is not None:
        query = query.filter(models.Office.latitude >= minLat)
        query = query.filter(models.Office.latitude <= maxLat)
    if minLng is not None and maxLng is not None:
        query = query.filter(models.Office.longitude >= minLng)
        query = query.filter(models.Office.longitude <= maxLng)

    group_ids = (
        query.with_entities(models.OfficeGroup.id)
        .distinct()
        .subquery()
    )

    groups = (
        db.query(models.OfficeGroup)
        .join(group_ids, group_ids.c.id == models.OfficeGroup.id)
        .order_by(models.OfficeGroup.priority_score.desc().nullslast())
        .limit(limit)
        .all()
    )

    # Batch fetch last visits to avoid N+1 problem
    fetched_group_ids = [g.id for g in groups]
    visit_map = {}
    dominant_districts = {}
    
    if fetched_group_ids:
        # Fetch last visits
        latest_visits = (
            db.query(
                models.GroupActivity.group_id, 
                func.max(models.GroupActivity.created_at).label('last_visit')
            )
            .filter(models.GroupActivity.group_id.in_(fetched_group_ids))
            .filter(models.GroupActivity.activity_type == "Visit")
            .group_by(models.GroupActivity.group_id)
            .all()
        )
        visit_map = {g_id: date for g_id, date in latest_visits}
        
        # Calculate dominant district per group
        district_counts = (
            db.query(
                models.OfficeGroupMember.group_id,
                models.Office.district,
                func.count(models.Office.id).label('count')
            )
            .join(models.Office, models.Office.id == models.OfficeGroupMember.office_id)
            .filter(models.OfficeGroupMember.group_id.in_(fetched_group_ids))
            .filter(models.Office.district.isnot(None))
            .group_by(models.OfficeGroupMember.group_id, models.Office.district)
            .all()
        )
        
        # Process to find max count per group
        temp_counts = {}
        for gid, dist, count in district_counts:
            if not dist: continue
            if gid not in temp_counts:
                temp_counts[gid] = (dist, count)
            elif count > temp_counts[gid][1]:
                temp_counts[gid] = (dist, count)
        
        dominant_districts = {gid: data[0] for gid, data in temp_counts.items()}

    results = []
    for group in groups:
        last_visit = visit_map.get(group.id)
        status = "ReadyForVisit" if compute_group_ready(group, priority_threshold, last_visit) else "Monitoring"
        
        # Use dominant district if available, otherwise fallback to group's stored district
        display_district = dominant_districts.get(group.id, group.district)
        
        results.append({
            "id": group.id,
            "group_name": group.group_name,
            "city": group.city,
            "district": display_district,
            "grid_id": group.grid_id,
            "status": status,
            "interested_count": group.interested_count,
            "total_offices": group.total_offices,
            "priority_score": float(group.priority_score) if group.priority_score is not None else None,
            "last_action_date": group.last_action_date,
            "ready_for_visit": status == "ReadyForVisit",
        })
    return results


@app.get("/groups/{group_id}", response_model=schemas.GroupDetail)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(models.OfficeGroup).filter(models.OfficeGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    playbook = (
        db.query(models.GroupPlaybook)
        .filter(models.GroupPlaybook.group_id == group_id)
        .first()
    )

    offices = (
        db.query(models.Office, models.OfficeGeoMetrics, models.OfficeScore, models.OfficeOutreach)
        .join(
            models.OfficeGroupMember,
            models.OfficeGroupMember.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeGeoMetrics,
            models.OfficeGeoMetrics.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeScore,
            models.OfficeScore.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeOutreach,
            models.OfficeOutreach.office_id == models.Office.id
        )
        .filter(models.OfficeGroupMember.group_id == group_id)
        .all()
    )

    last_visit = (
        db.query(func.max(models.GroupActivity.created_at))
        .filter(models.GroupActivity.group_id == group_id)
        .filter(models.GroupActivity.activity_type == "Visit")
        .scalar()
    )
    ready = compute_group_ready(group, 70, last_visit)

    return {
        "id": group.id,
        "group_name": group.group_name,
        "city": group.city,
        "district": group.district,
        "grid_id": group.grid_id,
        "status": "ReadyForVisit" if ready else "Monitoring",
        "interested_count": group.interested_count,
        "total_offices": group.total_offices,
        "priority_score": float(group.priority_score) if group.priority_score is not None else None,
        "last_action_date": group.last_action_date,
        "ready_for_visit": ready,
        "notes": group.notes,
        "playbook_step": playbook.current_step if playbook else None,
        "playbook_next_action": playbook.next_action if playbook else None,
        "offices": [
            serialize_office(office, metrics, scores, outreach, None)
            for office, metrics, scores, outreach in offices
        ],
    }


@app.get("/groups/{group_id}/route")
def group_route(group_id: int, db: Session = Depends(get_db)):
    coords = (
        db.query(models.Office.latitude, models.Office.longitude)
        .join(
            models.OfficeGroupMember,
            models.OfficeGroupMember.office_id == models.Office.id
        )
        .filter(models.OfficeGroupMember.group_id == group_id)
        .filter(models.Office.latitude.isnot(None))
        .filter(models.Office.longitude.isnot(None))
        .all()
    )
    if len(coords) < 2:
        return "https://www.google.com/maps"

    origin = f"{coords[0][0]},{coords[0][1]}"
    destination = f"{coords[-1][0]},{coords[-1][1]}"
    waypoints = "|".join([f"{lat},{lng}" for lat, lng in coords[1:-1]])

    return f"https://www.google.com/maps/dir/?api=1&origin={origin}&destination={destination}&waypoints={waypoints}&travelmode=driving"


@app.post("/offices/{office_id}/activities")
def create_activity(office_id: int, payload: schemas.ActivityCreate, db: Session = Depends(get_db)):
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
        
    activity = models.OfficeActivity(
        office_id=office_id,
        activity_type=payload.activity_type,
        outcome=payload.outcome,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(activity)
    db.commit()
    return {"status": "ok", "id": activity.id}


@app.get("/offices/{office_id}/activities")
def list_activities(office_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.OfficeActivity)
        .filter(models.OfficeActivity.office_id == office_id)
        .order_by(models.OfficeActivity.created_at.desc())
        .all()
    )


@app.patch("/offices/{office_id}", response_model=schemas.OfficeDetail)
def update_office(
    office_id: int,
    payload: schemas.OfficeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    # Update Office Fields
    if payload.interest_status is not None:
        office.interest_status = payload.interest_status

    # Update Outreach Fields
    outreach = db.query(models.OfficeOutreach).filter(models.OfficeOutreach.office_id == office_id).first()
    if not outreach:
        outreach = models.OfficeOutreach(office_id=office_id)
        db.add(outreach)
    
    if payload.contact_status is not None:
        outreach.contact_status = payload.contact_status
        outreach.last_contact_date = datetime.utcnow()
    
    if payload.notes is not None:
        outreach.notes = payload.notes

    if payload.assigned_to is not None:
        outreach.assigned_to = payload.assigned_to

    db.commit()
    
    # Reload full object for response
    return get_office(office_id, db)

@app.patch("/groups/{group_id}/members/{office_id}", response_model=schemas.GroupDetail)
def update_group_member(
    group_id: int,
    office_id: int,
    payload: schemas.GroupMemberUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    member = (
        db.query(models.OfficeGroupMember)
        .filter(models.OfficeGroupMember.group_id == group_id)
        .filter(models.OfficeGroupMember.office_id == office_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Group member not found")

    if payload.interest_status is not None:
        member.interest_status = payload.interest_status
        member.last_contact_date = datetime.utcnow()

    db.commit()
    recalculate_group_status(group_id, db)
    return get_group(group_id, db)


@app.patch("/offices/{office_id}/playbook", response_model=schemas.OfficeDetail)
def advance_office_playbook(
    office_id: int,
    payload: schemas.PlaybookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    steps = [
        "First Contact",
        "Interest Captured",
        "Follow-up",
        "Visit",
        "Decision",
        "Closed",
    ]
    playbook = (
        db.query(models.OfficePlaybook)
        .filter(models.OfficePlaybook.office_id == office_id)
        .first()
    )
    if not playbook:
        raise HTTPException(status_code=404, detail="Office playbook not found")

    if payload.next_step not in steps:
        raise HTTPException(status_code=400, detail="Invalid playbook step")

    current_index = steps.index(playbook.current_step)
    next_index = steps.index(payload.next_step)
    if next_index != current_index + 1:
        raise HTTPException(status_code=400, detail="Playbook step order violation")

    playbook.current_step = payload.next_step
    playbook.next_action = payload.next_step
    playbook.last_updated = datetime.utcnow()
    db.commit()

    return get_office(office_id, db)


@app.patch("/groups/{group_id}/playbook", response_model=schemas.GroupDetail)
def advance_group_playbook(
    group_id: int,
    payload: schemas.PlaybookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    steps = [
        "Identify group",
        "Contact key offices",
        "Monitor interest",
        "Plan visit",
        "Execute visit",
        "Close group",
    ]
    playbook = (
        db.query(models.GroupPlaybook)
        .filter(models.GroupPlaybook.group_id == group_id)
        .first()
    )
    if not playbook:
        raise HTTPException(status_code=404, detail="Group playbook not found")

    if payload.next_step not in steps:
        raise HTTPException(status_code=400, detail="Invalid playbook step")

    current_index = steps.index(playbook.current_step)
    next_index = steps.index(payload.next_step)
    if next_index != current_index + 1:
        raise HTTPException(status_code=400, detail="Playbook step order violation")

    playbook.current_step = payload.next_step
    playbook.next_action = payload.next_step
    playbook.ready_for_visit = 1 if payload.next_step == "Plan visit" else 0
    db.commit()

    return get_group(group_id, db)


@app.post("/offices/{office_id}/activities")
def create_office_activity(
    office_id: int,
    payload: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    activity = models.OfficeActivity(
        office_id=office_id,
        group_id=None,
        activity_type=payload.activity_type,
        outcome=payload.outcome,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(activity)
    db.commit()
    return {"status": "ok"}


@app.post("/messages/send", response_model=schemas.BatchSendResponse)
def send_batch_messages(payload: schemas.MessageCreate, db: Session = Depends(get_db)):
    import uuid
    batch_id = payload.batch_id or str(uuid.uuid4())
    sent_count = 0
    skipped_count = 0
    skipped_ids = []

    # Simple safety threshold: don't message if contacted in last 3 days unless forced
    threshold_date = datetime.utcnow() - timedelta(days=3)

    for office_id in payload.office_ids:
        # Check existence
        office = db.query(models.Office).filter(models.Office.id == office_id).first()
        if not office:
            skipped_count += 1
            skipped_ids.append(office_id)
            continue

        if not payload.force:
             # GUARDRAILS
             # 1. Check Interest Status
             if office.interest_status in ["Onboarded", "Rejected"]:
                 skipped_count += 1
                 skipped_ids.append(office_id)
                 continue
                 
             # 2. Check Visited Status
             has_visit = db.query(models.Visit).filter(
                 models.Visit.office_id == office_id, 
                 models.Visit.status == "Completed"
             ).first()
             if has_visit:
                 skipped_count += 1
                 skipped_ids.append(office_id)
                 continue

             # 3. Check Recent Contact (safety fallback)
             last_msg = (
                db.query(models.OfficeMessage)
                .filter(models.OfficeMessage.office_id == office_id)
                .filter(models.OfficeMessage.direction == "Outbound")
                .order_by(models.OfficeMessage.created_at.desc())
                .first()
             )
             if last_msg and last_msg.created_at > threshold_date:
                skipped_count += 1
                skipped_ids.append(office_id)
                continue

        if payload.dry_run:
            sent_count += 1
            continue

        # Create message
        msg = models.OfficeMessage(
            office_id=office_id,
            direction="Outbound",
            status="Sent",
            body=payload.body,
            batch_id=batch_id,
            sent_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        db.add(msg)
        
        # Also log activity
        activity = models.OfficeActivity(
            office_id=office_id,
            activity_type="Message Sent",
            outcome="Sent",
            notes=f"Batch: {batch_id[:8]}...",
            created_at=datetime.utcnow()
        )
        db.add(activity)

        sent_count += 1

    if payload.dry_run:
        return {
            "sent_count": sent_count,
            "skipped_count": skipped_count,
            "skipped_ids": skipped_ids,
            "batch_id": "dry-run"
        }

    db.commit()

    return {
        "sent_count": sent_count,
        "skipped_count": skipped_count,
        "skipped_ids": skipped_ids,
        "batch_id": batch_id
    }


@app.get("/messages", response_model=list[schemas.MessageResponse])
def list_messages(
    status: str | None = None,
    office_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.OfficeMessage).order_by(models.OfficeMessage.created_at.desc())
    
    if status == "Inbox":
        query = query.filter(models.OfficeMessage.direction == "Inbound")
    elif status == "Sent":
        query = query.filter(models.OfficeMessage.direction == "Outbound")
    elif status:
        query = query.filter(models.OfficeMessage.status == status)

    if office_id:
        query = query.filter(models.OfficeMessage.office_id == office_id)

    return query.limit(limit).all()


@app.post("/groups/{group_id}/activities")
def create_group_activity(
    group_id: int,
    payload: schemas.ActivityCreate,
    db: Session = Depends(get_db),
):
    activity = models.GroupActivity(
        group_id=group_id,
        activity_type=payload.activity_type,
        outcome=payload.outcome,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(activity)
    db.commit()

    db.query(models.OfficeGroup).filter(models.OfficeGroup.id == group_id).update({
        "last_action_date": datetime.utcnow()
    })
    db.commit()
    return {"status": "ok"}


@app.get("/visits/queue", response_model=list[schemas.GroupBase])
def visit_queue(db: Session = Depends(get_db)):
    groups = (
        db.query(models.OfficeGroup)
        .filter(models.OfficeGroup.status == "ReadyForVisit")
        .order_by(models.OfficeGroup.interested_count.desc(), models.OfficeGroup.priority_score.desc())
        .all()
    )
    return [
        {
            "id": group.id,
            "group_name": group.group_name,
            "city": group.city,
            "district": group.district,
            "grid_id": group.grid_id,
            "status": group.status,
            "interested_count": group.interested_count,
            "total_offices": group.total_offices,
            "priority_score": float(group.priority_score) if group.priority_score is not None else None,
            "last_action_date": group.last_action_date,
            "ready_for_visit": group.status == "ReadyForVisit",
        }
        for group in groups
    ]


@app.get("/visits", response_model=list[schemas.VisitBase])
def list_visits(office_id: int | None = None, group_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Visit)
    if office_id:
        query = query.filter(models.Visit.office_id == office_id)
    if group_id:
        query = query.filter(models.Visit.group_id == group_id)
    return query.order_by(models.Visit.created_at.desc()).all()


@app.get("/offices/{office_id}/visits")
def list_office_visits(office_id: int, db: Session = Depends(get_db)):
    visits = db.query(models.Visit).filter(models.Visit.office_id == office_id).order_by(models.Visit.created_at.desc()).all()
    print(f"DEBUG: Office {office_id} has {len(visits)} visits")
    return {"count": len(visits), "data": visits}


@app.post("/visits", response_model=schemas.VisitBase)
def create_visit(
    payload: schemas.VisitCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    visit = models.Visit(
        office_id=payload.office_id,
        group_id=payload.group_id,
        visit_type=payload.visit_type,
        status=payload.status,
        scheduled_at=payload.scheduled_at,
        notes=payload.notes,
        created_at=datetime.utcnow(),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@app.patch("/visits/{visit_id}", response_model=schemas.VisitBase)
def update_visit(
    visit_id: int, 
    payload: schemas.VisitUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    visit = db.query(models.Visit).filter(models.Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
        
    if payload.status:
        visit.status = payload.status
        if payload.status == "Completed" and not visit.completed_at:
             visit.completed_at = payload.completed_at or datetime.utcnow()
             
    if payload.outcome:
        visit.outcome = payload.outcome
    if payload.notes:
        visit.notes = payload.notes
    if payload.scheduled_at:
        visit.scheduled_at = payload.scheduled_at
        
    db.commit()
    db.refresh(visit)
    if visit.group_id:
        recalculate_group_status(visit.group_id, db)
    return visit


@app.post("/webhooks/whatsapp/interest")
def whatsapp_interest(payload: dict, db: Session = Depends(get_db)):
    office_id = payload.get("office_id")
    group_id = payload.get("group_id")
    interest_status = payload.get("interest_status", "Interested")

    if not office_id:
        raise HTTPException(status_code=400, detail="office_id is required")

    db.query(models.Office).filter(models.Office.id == office_id).update({
        "interest_status": interest_status
    })

    if not group_id:
        group_id = (
            db.query(models.OfficeGroupMember.group_id)
            .filter(models.OfficeGroupMember.office_id == office_id)
            .scalar()
        )

    if group_id:
        db.query(models.OfficeGroupMember).filter(
            models.OfficeGroupMember.group_id == group_id,
            models.OfficeGroupMember.office_id == office_id
        ).update({
            "interest_status": interest_status,
            "last_contact_date": datetime.utcnow()
        })
        recalculate_group_status(group_id, db)

    db.commit()
    return {"status": "ok"}


@app.patch("/office/{office_id}/outreach", response_model=schemas.OfficeDetail)
def update_outreach(
    office_id: int,
    payload: schemas.OutreachUpdate,
    db: Session = Depends(get_db),
):
    allowed_statuses = {"New", "Contacted", "Interested", "Onboarded", "Rejected"}
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    outreach = (
        db.query(models.OfficeOutreach)
        .filter(models.OfficeOutreach.office_id == office_id)
        .first()
    )
    if not outreach:
        outreach = models.OfficeOutreach(office_id=office_id, contact_status="New")
        db.add(outreach)

    if payload.contact_status is not None:
        if payload.contact_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid contact status")
        outreach.contact_status = payload.contact_status
    if payload.assigned_to is not None:
        outreach.assigned_to = payload.assigned_to
    if payload.notes is not None:
        outreach.notes = payload.notes

    outreach.last_contact_date = datetime.utcnow()
    db.commit()

    row = (
        db.query(
            models.Office,
            models.OfficeGeoMetrics,
            models.OfficeScore,
            models.OfficeOutreach,
        )
        .outerjoin(
            models.OfficeGeoMetrics,
            models.OfficeGeoMetrics.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeScore,
            models.OfficeScore.office_id == models.Office.id
        )
        .outerjoin(
            models.OfficeOutreach,
            models.OfficeOutreach.office_id == models.Office.id
        )
        .filter(models.Office.id == office_id)
        .first()
    )
    office, metrics, scores, outreach = row
    return serialize_office_detail(office, metrics, scores, outreach)


@app.get("/stats", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(models.Office.id)).scalar() or 0
    contacted = (
        db.query(func.count(models.OfficeOutreach.office_id))
        .filter(models.OfficeOutreach.contact_status == "Contacted")
        .scalar()
        or 0
    )
    interested = (
        db.query(func.count(models.OfficeOutreach.office_id))
        .filter(models.OfficeOutreach.contact_status == "Interested")
        .scalar()
        or 0
    )
    onboarded = (
        db.query(func.count(models.OfficeOutreach.office_id))
        .filter(models.OfficeOutreach.contact_status == "Onboarded")
        .scalar()
        or 0
    )
    high_priority = (
        db.query(func.count(models.OfficeScore.office_id))
        .filter(models.OfficeScore.priority_score >= 75)
        .scalar()
        or 0
    )
    ready_for_visit_groups = (
        db.query(func.count(models.OfficeGroup.id))
        .filter(models.OfficeGroup.status == "ReadyForVisit")
        .scalar()
        or 0
    )

    # Visit Stats
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    visited_today = (
        db.query(func.count(models.Visit.id))
        .filter(models.Visit.status == "Completed")
        .filter(models.Visit.completed_at >= today_start)
        .scalar() or 0
    )
    
    visited_week = (
        db.query(func.count(models.Visit.id))
        .filter(models.Visit.status == "Completed")
        .filter(models.Visit.completed_at >= week_start)
        .scalar() or 0
    )

    total_visited = (
        db.query(func.count(func.distinct(models.Visit.office_id)))
        .filter(models.Visit.status == "Completed")
        .filter(models.Visit.office_id.isnot(None))
        .scalar() or 0
    )

    return {
        "total_offices": total,
        "contacted": contacted,
        "interested": interested,
        "onboarded": onboarded,
        "high_priority": high_priority,
        "ready_for_visit_groups": ready_for_visit_groups,
        "visited_today": visited_today,
        "visited_week": visited_week,
        "total_visited": total_visited,
    }


@app.get("/debug/offices")
def debug_offices(db: Session = Depends(get_db)):
    rows = db.query(models.Office).limit(50).all()
    data = [
        {
            "id": office.id,
            "name": office.name,
            "city": office.city,
            "district": office.district,
            "rating": office.rating,
            "latitude": office.latitude,
            "longitude": office.longitude,
        }
        for office in rows
    ]
    return {"count": len(data), "data": data}
@app.get("/districts", response_model=list[schemas.DistrictStat])
def list_districts(db: Session = Depends(get_db)):
    # Group by District and City, counting totals and statuses
    from sqlalchemy import case, func
    
    results = (
        db.query(
            models.Office.city,
            models.Office.district,
            func.count(models.Office.id).label("total"),
            func.count(case((models.Office.interest_status == "Interested", 1))).label("interested"),
            func.count(case((models.OfficeOutreach.contact_status == "Visited", 1))).label("visited"),
            func.count(case((models.OfficeScore.priority_score >= 70, 1))).label("ready")
        )
        .outerjoin(models.OfficeScore, models.OfficeScore.office_id == models.Office.id)
        .outerjoin(models.OfficeOutreach, models.OfficeOutreach.office_id == models.Office.id)
        .filter(models.Office.city.isnot(None))
        .filter(models.Office.district.isnot(None))
        .group_by(models.Office.city, models.Office.district)
        .all()
    )
    
    return [
        {
            "city": r.city,
            "district": r.district,
            "total_offices": r.total,
            "interested": r.interested,
            "visited": r.visited,
            "ready": r.ready
        }
        for r in results
    ]


# --- Visit List Endpoints ---

@app.get("/visit-lists", response_model=list[schemas.VisitListBase])
def get_visit_lists(db: Session = Depends(get_db)):
    return db.query(models.VisitList).filter(models.VisitList.status == "Active").order_by(models.VisitList.created_at.desc()).all()


@app.post("/visit-lists", response_model=schemas.VisitListBase)
def create_visit_list(
    payload: schemas.VisitListCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    new_list = models.VisitList(
        name=payload.name,
        created_at=datetime.utcnow()
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    return new_list



@app.get("/visit-lists/{list_id}", response_model=schemas.VisitListBase)
def get_visit_list(list_id: int, db: Session = Depends(get_db)):
    lst = db.query(models.VisitList).filter(models.VisitList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="Visit list not found")
    return lst


@app.delete("/visit-lists/{list_id}", status_code=204)
def delete_visit_list(
    list_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin)
):
    lst = db.query(models.VisitList).filter(models.VisitList.id == list_id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="Visit list not found")
    
    # Optional: Delete members first if no cascade is set up, 
    # but normally cascade should handle it or we can leave them orphaned (bad).
    # Ideally models.VisitListMember should cascade delete on VisitList delete.
    # We will manually delete members just in case.
    db.query(models.VisitListMember).filter(models.VisitListMember.visit_list_id == list_id).delete()
    
    db.delete(lst)
    db.commit()
    return None


@app.post("/visit-lists/{list_id}/members", response_model=list[schemas.VisitListMemberBase])
def add_visit_list_members(
    list_id: int, 
    office_ids: list[int], 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Retrieve current members to avoid duplicates
    existing = db.query(models.VisitListMember.office_id)\
        .filter(models.VisitListMember.visit_list_id == list_id)\
        .all()
    existing_ids = {r[0] for r in existing}
    
    new_members = []
    for oid in office_ids:
        if oid not in existing_ids:
            member = models.VisitListMember(
                visit_list_id=list_id,
                office_id=oid,
                added_at=datetime.utcnow()
            )
            db.add(member)
            new_members.append(member)
    
    db.commit()
    
    # Return all members (or just new ones? Return all logic usually easier for frontend refresh)
    return db.query(models.VisitListMember)\
        .filter(models.VisitListMember.visit_list_id == list_id)\
        .all()



@app.get("/visit-lists/{list_id}/members", response_model=list[schemas.VisitListMemberDetail])
def get_visit_list_members(list_id: int, db: Session = Depends(get_db)):
    # Advanced query: Members + Office Info + Last Completed Visit Status
    from sqlalchemy import and_

    # Subquery for last completed visit per office
    # We want to know if THIS office has been visited AFTER it was added to the list? 
    # Or just generally visited recently? 
    # "Visit Lists must reflect live operational reality". 
    # If I visited the office yesterday, and added it to a list today, is it "Visited"? 
    # Probably "Visited" status is absolute for the office.
    # But usually context matters. 
    # Let's keep it simple: Show the LAST COMPLETED VISIT for this office, regardless of list timing.
    # Operators can decide if it counts.

    # 1. Get Members joined with Office
    query = (
        db.query(
            models.VisitListMember,
            models.Office.name,
            models.Office.city,
            models.Office.district
        )
        .join(models.Office, models.Office.id == models.VisitListMember.office_id)
        .filter(models.VisitListMember.visit_list_id == list_id)
        .all()
    )

    results = []
    
    # 2. Get Visits for these offices (Bulk fetch optimization)
    office_ids = [r[0].office_id for r in query]
    
    # Fetch last completed visit for each office
    # Using window function or just group by in generic SQL is annoying in ORM.
    # Let's fetch all COMPLETED visits for these offices and sort in python (easier for < 100 items)
    visits = (
        db.query(models.Visit)
        .filter(models.Visit.office_id.in_(office_ids))
        .filter(models.Visit.status == "Completed")
        .order_by(models.Visit.completed_at.desc())
        .all()
    )
    
    visit_map = {}
    for v in visits:
        if v.office_id not in visit_map:
            visit_map[v.office_id] = v # First one is latest due to order_by

    for member, name, city, district in query:
        last_visit = visit_map.get(member.office_id)
        
        visit_status = "Planned"
        last_at = None
        outcome = None
        
        if last_visit:
            # Check if visit was recent? Or just existence?
            # For now, existence of ANY completed visit implies "Visited" contextually, 
            # unless we add date constraints. Let's show it as Completed if exists.
            visit_status = "Completed"
            last_at = last_visit.completed_at
            outcome = last_visit.outcome

        results.append({
            "office_id": member.office_id,
            "status": member.status, # Planned/Skipped from Member table
            "added_at": member.added_at,
            "office_name": name,
            "city": city,
            "district": district,
            "visit_status": visit_status, # Derived
            "last_visit_at": last_at,
            "last_visit_outcome": outcome
        })

    return results


@app.post("/visits/complete", response_model=schemas.VisitBase)
def complete_visit_atomic(payload: schemas.VisitComplete, db: Session = Depends(get_db)):
    # 1. Create the visit record
    visit = models.Visit(
        office_id=payload.office_id,
        status="Completed",
        visit_type="Field",
        outcome=payload.outcome,
        notes=payload.notes,
        completed_at=payload.date,
        created_at=datetime.utcnow()
    )
    db.add(visit)
    
    # 2. Update Office Interest/Contact Status
    # Logic: "Status must be DERIVED" -> We update the fields that cache this state
    office_update = {"interest_status": "Unknown"}
    
    if payload.outcome in ["Interested", "Onboarded"]:
        office_update["interest_status"] = payload.outcome
    elif payload.outcome == "Not Interested":
         office_update["interest_status"] = "Rejected"
    
    # Update Outreach status to 'Visited' or 'Onboarded'
    # Actually, if Onboarded, status is Onboarded. If Interested, Status is Visited/Interested.
    # Simplification: Set ContactStatus = Visited for all, unless Onboarded.
    contact_status = "Visited"
    if payload.outcome == "Onboarded":
        contact_status = "Onboarded"
        
    # Update Office Table
    db.query(models.Office).filter(models.Office.id == payload.office_id).update(office_update)
    
    # Update Outreach Table
    outreach = db.query(models.OfficeOutreach).filter(models.OfficeOutreach.office_id == payload.office_id).first()
    if not outreach:
        # Create if not exists (should exist if imported correctly, but safety net)
        outreach = models.OfficeOutreach(
            office_id=payload.office_id,
            contact_status=contact_status,
            last_contact_date=payload.date
        )
        db.add(outreach)
    else:
        outreach.contact_status = contact_status
        outreach.last_contact_date = payload.date
    
    db.commit()
    db.refresh(visit)
    return visit



@app.get("/offices/{office_id}/visit-lists", response_model=list[schemas.VisitListBase])
def get_office_visit_lists(office_id: int, db: Session = Depends(get_db)):
    # Return all lists this office is a member of
    return (
        db.query(models.VisitList)
        .join(models.VisitListMember, models.VisitListMember.visit_list_id == models.VisitList.id)
        .filter(models.VisitListMember.office_id == office_id)
        .filter(models.VisitList.status == "Active")
        .all()
    )



# --- Outreach Board ---

@app.get("/outreach/board", response_model=schemas.OutreachBoardResponse)
def get_outreach_board(db: Session = Depends(get_db)):
    # 1. Fetch all relevant data
    # (Ideally this should be a complex optimized query, but doing in-app logic for simplicity first)
    offices = db.query(models.Office).all()
    
    # 2. Fetch last visits (completed)
    last_visits = db.query(
        models.Visit.office_id, 
        func.max(models.Visit.completed_at)
    ).filter(models.Visit.status == "Completed").group_by(models.Visit.office_id).all()
    visit_map = {r[0]: r[1] for r in last_visits} # office_id -> completed_at
    
    # 3. Fetch last outbound messages
    last_msgs = db.query(
        models.OfficeMessage.office_id,
        func.max(models.OfficeMessage.created_at)
    ).filter(models.OfficeMessage.direction == "Outbound").group_by(models.OfficeMessage.office_id).all()
    msg_map = {r[0]: r[1] for r in last_msgs} # office_id -> created_at
    
    # 3b. Fetch Planned Visits (Future)
    planned_visits = db.query(
        models.Visit.office_id,
        func.max(models.Visit.scheduled_at)
    ).filter(models.Visit.status == "Planned").group_by(models.Visit.office_id).all()
    planned_map = {r[0]: r[1] for r in planned_visits}

    # 4. Fetch Active Visit List Memberships
    list_members = db.query(
        models.VisitListMember.office_id,
        models.VisitList.name
    ).join(models.VisitList, models.VisitList.id == models.VisitListMember.visit_list_id)\
     .filter(models.VisitList.status == "Active").all()
     
    membership_map = {}
    for oid, lname in list_members:
        if oid not in membership_map:
            membership_map[oid] = []
        membership_map[oid].append(lname)

    # 5. Categorize
    response_buckets = {
        "visited": [],
        "contacted": [],
        "planned": [],
        "cold": [],
        "stale": []
    }
    
    now = datetime.utcnow()
    stale_threshold = timedelta(days=14)

    for o in offices:
        visits_at = visit_map.get(o.id)
        msg_at = msg_map.get(o.id)
        lists = membership_map.get(o.id, [])
        planned_at = planned_map.get(o.id)
        
        category = "Cold"
        # Priority: Visited > Planned (List or Visit Record) > Contacted > Cold
        
        if visits_at:
            category = "Visited"
            target_bucket = "visited"
        elif len(lists) > 0 or planned_at:
             category = "Planned"
             target_bucket = "planned"
        elif msg_at:
            # Check stale
            if (now - msg_at) > stale_threshold:
                 category = "Stale"
                 target_bucket = "stale"
            else:
                 category = "Contacted"
                 target_bucket = "contacted"
        else:
             category = "Cold"
             target_bucket = "cold"
             
        # Item
        item = {
            "id": o.id,
            "name": o.name,
            "city": o.city,
            "district": o.district,
            "last_message_at": msg_at,
            "last_visit_at": visits_at,
            "visit_lists": lists,
            "category": category,
            # Add next_visit_at if we can add it to schema, for now just reuse last_visit_at logic or ignore?
            # Schema doesn't support next_visit_at yet. Let's add it dynamically or update schema.
            # actually schema is OutreachBoardResponse -> dict[str, list[OfficeBoardItem]]
        }
        # Inject custom field 'next_visit_at' into the dict, Pydantic might strip it if not in schema.
        # Let's hope Pydantic config allows extra or we update schema.
        # We need to update schema.
        item["next_visit_at"] = planned_at
        
        response_buckets[target_bucket].append(item)
        
    return response_buckets

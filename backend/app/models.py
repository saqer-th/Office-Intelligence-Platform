from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger, ForeignKey, Numeric, Text
from .db import Base


class Office(Base):
    __tablename__ = "offices"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(BigInteger)
    name = Column(String)
    region = Column(String)
    city = Column(String)
    district = Column(String)
    phone = Column(String)
    rating = Column(Float)
    rating_count = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)
    google_maps_url = Column(String)
    profile_url = Column(String)
    interest_status = Column(String, default="Unknown")
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class OfficeGeoMetrics(Base):
    __tablename__ = "office_geo_metrics"

    office_id = Column(Integer, ForeignKey("offices.id"), primary_key=True, index=True)
    nearest_office_distance_m = Column(Integer)
    nearby_300m = Column(Integer, default=0)
    nearby_500m = Column(Integer, default=0)
    nearby_1km = Column(Integer, default=0)
    updated_at = Column(DateTime)


class OfficeGrid(Base):
    __tablename__ = "office_grids"

    grid_id = Column(String, primary_key=True)
    city = Column(String)
    center_lat = Column(Float)
    center_lng = Column(Float)
    office_count = Column(Integer)
    avg_rating = Column(Float)
    updated_at = Column(DateTime)


class OfficeScore(Base):
    __tablename__ = "office_scores"

    office_id = Column(Integer, ForeignKey("offices.id"), primary_key=True, index=True)
    market_density_score = Column(Numeric(8, 2))
    priority_score = Column(Numeric(8, 2))
    updated_at = Column(DateTime)


class OfficeOutreach(Base):
    __tablename__ = "office_outreach"

    office_id = Column(Integer, ForeignKey("offices.id"), primary_key=True, index=True)
    contact_status = Column(String, default="New")
    assigned_to = Column(String)
    last_contact_date = Column(DateTime)
    notes = Column(Text)


class OfficeGroup(Base):
    __tablename__ = "office_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String)
    city = Column(String)
    district = Column(String)
    grid_id = Column(String)
    status = Column(String, default="New")
    interested_count = Column(Integer, default=0)
    total_offices = Column(Integer, default=0)
    priority_score = Column(Numeric(8, 2))
    last_action_date = Column(DateTime)
    notes = Column(Text)


class OfficeGroupMember(Base):
    __tablename__ = "office_group_members"

    group_id = Column(Integer, ForeignKey("office_groups.id"), primary_key=True, index=True)
    office_id = Column(Integer, ForeignKey("offices.id"), primary_key=True, index=True)
    interest_status = Column(String, default="Unknown")
    last_contact_date = Column(DateTime)


class OfficePlaybook(Base):
    __tablename__ = "office_playbooks"

    office_id = Column(Integer, ForeignKey("offices.id"), primary_key=True, index=True)
    current_step = Column(String)
    next_action = Column(String)
    last_updated = Column(DateTime)


class GroupPlaybook(Base):
    __tablename__ = "group_playbooks"

    group_id = Column(Integer, ForeignKey("office_groups.id"), primary_key=True, index=True)
    current_step = Column(String)
    next_action = Column(String)
    ready_for_visit = Column(Integer, default=0)


class OfficeActivity(Base):
    __tablename__ = "office_activities"

    id = Column(Integer, primary_key=True, index=True)
    office_id = Column(Integer, ForeignKey("offices.id"), index=True)
    group_id = Column(Integer, ForeignKey("office_groups.id"), index=True)
    activity_type = Column(String)
    outcome = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime)


class GroupActivity(Base):
    __tablename__ = "group_activities"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("office_groups.id"), index=True)
    activity_type = Column(String)
    outcome = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime)


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    office_id = Column(Integer, ForeignKey("offices.id"), index=True, nullable=True) # Office-level visit
    group_id = Column(Integer, ForeignKey("office_groups.id"), index=True, nullable=True) # Group-level (legacy or multi-office)
    
    visit_type = Column(String, default="Field") # Field | Online
    status = Column(String, default="Planned") # Planned | Completed | Cancelled | InProgress
    
    scheduled_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True) # Functions as visit_date
    
    outcome = Column(String, nullable=True) # Interested | Not Interested | Follow-up | Onboarded
    notes = Column(Text)
    created_at = Column(DateTime)


class OfficeMessage(Base):
    __tablename__ = "oomi_messages"

    id = Column(Integer, primary_key=True, index=True)
    office_id = Column(Integer, ForeignKey("offices.id"), index=True)
    direction = Column(String)  # 'Inbound' or 'Outbound'
    status = Column(String, default="Sent")  # Sent, Replied, NoResponse, Failed
    body = Column(Text)
    batch_id = Column(String, nullable=True, index=True)  # UUID for batch grouping
    sent_at = Column(DateTime)
    last_reply_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime)


class VisitList(Base):
    __tablename__ = "visit_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    status = Column(String, default="Active")  # Active, Archived
    created_at = Column(DateTime)


class VisitListMember(Base):
    __tablename__ = "visit_list_members"

    id = Column(Integer, primary_key=True, index=True)
    visit_list_id = Column(Integer, ForeignKey("visit_lists.id"), index=True)
    visit_list_id = Column(Integer, ForeignKey("visit_lists.id"), index=True)
    office_id = Column(Integer, ForeignKey("offices.id"), index=True)
    status = Column(String, default="Planned")  # Planned, Skipped
    added_at = Column(DateTime)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="Operator") # Admin, Operator
    created_at = Column(DateTime)

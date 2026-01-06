from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class OfficeBase(BaseModel):
    id: int
    name: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    rating: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    nearest_office_distance_m: Optional[int] = None
    nearby_300m: Optional[int] = None
    nearby_500m: Optional[int] = None
    nearby_1km: Optional[int] = None
    market_density_score: Optional[float] = None
    priority_score: Optional[float] = None
    contact_status: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    interest_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OfficeUpdate(BaseModel):
    interest_status: Optional[str] = None
    contact_status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None



class OfficeDetail(BaseModel):
    id: int
    node_id: Optional[int] = None
    name: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    profile_url: Optional[str] = None
    interest_status: Optional[str] = None
    nearest_office_distance_m: Optional[int] = None
    nearby_300m: Optional[int] = None
    nearby_500m: Optional[int] = None
    nearby_1km: Optional[int] = None
    market_density_score: Optional[float] = None
    priority_score: Optional[float] = None
    contact_status: Optional[str] = None
    assigned_to: Optional[str] = None
    last_contact_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OfficeListResponse(BaseModel):
    count: int
    data: list[OfficeBase]

    model_config = ConfigDict(from_attributes=True)


class GridCell(BaseModel):
    grid_id: str
    city: Optional[str] = None
    center_lat: float
    center_lng: float
    office_count: int
    avg_rating: Optional[float] = None
    density_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class OutreachUpdate(BaseModel):
    contact_status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class DashboardStats(BaseModel):
    total_offices: int
    contacted: int
    interested: int
    onboarded: int
    high_priority: int
    ready_for_visit_groups: int
    
    visited_today: Optional[int] = 0
    visited_week: Optional[int] = 0
    total_visited: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class GroupBase(BaseModel):
    id: int
    group_name: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    grid_id: Optional[str] = None
    status: Optional[str] = None
    interested_count: Optional[int] = None
    total_offices: Optional[int] = None
    priority_score: Optional[float] = None
    last_action_date: Optional[datetime] = None
    ready_for_visit: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class GroupMember(BaseModel):
    office_id: int
    interest_status: Optional[str] = None
    last_contact_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class GroupDetail(GroupBase):
    notes: Optional[str] = None
    playbook_step: Optional[str] = None
    playbook_next_action: Optional[str] = None
    offices: list[OfficeBase] = []


class GroupMemberUpdate(BaseModel):
    interest_status: Optional[str] = None


class PlaybookUpdate(BaseModel):
    next_step: str


class MessageCreate(BaseModel):
    body: str
    office_ids: list[int]
    batch_id: str | None = None
    force: bool = False  # Skip recent contact check
    dry_run: bool = False # Check without sending


class MessageResponse(BaseModel):
    id: int
    office_id: int
    direction: str
    status: str
    body: str
    sent_at: datetime
    created_at: datetime
    last_reply_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class BatchSendResponse(BaseModel):
    sent_count: int
    skipped_count: int
    skipped_ids: list[int]
    batch_id: str


class ActivityCreate(BaseModel):
    activity_type: str
    outcome: Optional[str] = None
    notes: Optional[str] = None


class VisitBase(BaseModel):
    id: int
    office_id: Optional[int] = None
    group_id: Optional[int] = None
    visit_type: str = "Field"
    status: str = "Planned"
    outcome: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VisitCreate(BaseModel):
    office_id: Optional[int] = None
    group_id: Optional[int] = None
    visit_type: str = "Field"
    status: str = "Planned"
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None


class VisitUpdate(BaseModel):
    status: Optional[str] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None


class DistrictStat(BaseModel):
    city: str
    district: str
    total_offices: int
    interested: int
    visited: int
    ready: int  # Offices in "ReadyForVisit" groups - optional, maybe just keep simple status counts

    model_config = ConfigDict(from_attributes=True)


class VisitListBase(BaseModel):
    id: int
    name: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VisitListCreate(BaseModel):
    name: str


class VisitListMemberBase(BaseModel):
    office_id: int
    status: str
    added_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VisitListMemberDetail(VisitListMemberBase):
    office_name: str
    city: Optional[str] = None
    district: Optional[str] = None
    visit_status: str  # Planned, Completed
    last_visit_at: Optional[datetime] = None
    last_visit_outcome: Optional[str] = None


class VisitComplete(BaseModel):
    office_id: int
    outcome: str
    notes: Optional[str] = None
    date: datetime


class VisitListResponse(BaseModel):
    count: int
    data: list[VisitBase]

    model_config = ConfigDict(from_attributes=True)


class OutreachBoardItem(BaseModel):
    id: int
    name: str
    city: str | None
    district: str | None
    last_message_at: datetime | None
    last_visit_at: datetime | None
    visit_lists: list[str]  # List names
    category: str # Visited, Contacted, Planned, Cold, Stale
    
    model_config = ConfigDict(from_attributes=True)


class OutreachBoardResponse(BaseModel):
    visited: list[OutreachBoardItem]
    contacted: list[OutreachBoardItem]
    planned: list[OutreachBoardItem]
    cold: list[OutreachBoardItem]
    stale: list[OutreachBoardItem]


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = "Operator"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


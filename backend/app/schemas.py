from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, UUID4, Field

# User Schemas
class UserBase(BaseModel):
    email: str
    name: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    is_superuser: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Family Schemas
class FamilyBase(BaseModel):
    family_name: str
    description: Optional[str] = None

class FamilyCreate(FamilyBase):
    user_id: str  # For simplicity in this demo

class FamilyUpdate(BaseModel):
    family_name: Optional[str] = None
    description: Optional[str] = None

class FamilyCollaboratorBase(BaseModel):
    user_id: str
    role: str # 'viewer', 'editor'

class FamilyCollaboratorCreate(FamilyCollaboratorBase):
    pass

class FamilyCollaborator(FamilyCollaboratorBase):
    family_id: str
    created_at: datetime
    
    # Optional user details for display
    user: Optional[UserBase] = None

    class Config:
        from_attributes = True

class FamilyInvite(BaseModel):
    email: str
    role: str = "viewer"

class AccessRequestBase(BaseModel):
    family_id: str
    user_id: str

class AccessRequestCreate(AccessRequestBase):
    pass

class AccessRequestUpdate(BaseModel):
    status: str # 'approved', 'rejected'

class AccessRequest(AccessRequestBase):
    id: str
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Optional include details
    user: Optional[UserBase] = None
    family: Optional[FamilyBase] = None

    class Config:
        from_attributes = True

class FamilyCollaboratorUpdate(BaseModel):
    role: str

class Family(FamilyBase):
    id: str
    user_id: str
    created_at: datetime
    
    # Include collaborators in response? Maybe separate endpoint or optional include
    # But for "My Families", we might want to know my role.
    # Let's add a computed field or separate structure if needed.
    # For now, standard response.
    
    class Config:
        from_attributes = True

class FamilyWithRole(Family):
    current_user_role: str # 'owner', 'editor', 'viewer'

# Region Schemas
class RegionBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#EBF8FF"

class RegionCreate(RegionBase):
    family_id: str
    member_ids: Optional[List[str]] = []

class RegionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    member_ids: Optional[List[str]] = None

class Region(RegionBase):
    id: str
    family_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Member Schemas
class MemberBase(BaseModel):
    name: str
    surname: Optional[str] = None
    gender: str
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    is_deceased: Optional[bool] = False
    is_fuzzy: Optional[bool] = False
    remark: Optional[str] = None
    birth_place: Optional[str] = None
    photo_url: Optional[str] = None
    position_x: Optional[int] = 0
    position_y: Optional[int] = 0
    sort_order: Optional[int] = 0
    region_id: Optional[str] = None

class MemberCreate(MemberBase):
    family_id: str

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    is_deceased: Optional[bool] = None
    is_fuzzy: Optional[bool] = None
    remark: Optional[str] = None
    birth_place: Optional[str] = None
    photo_url: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    sort_order: Optional[int] = None
    region_id: Optional[str] = None

class Member(MemberBase):
    id: str
    family_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Relationship Schemas
class SpouseRelationshipBase(BaseModel):
    member1_id: str
    member2_id: str
    marriage_date: Optional[str] = None

class SpouseRelationshipCreate(SpouseRelationshipBase):
    pass

class SpouseRelationshipUpdate(BaseModel):
    marriage_date: Optional[str] = None

class SpouseRelationship(SpouseRelationshipBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ParentChildRelationshipBase(BaseModel):
    parent_id: str
    child_id: str
    relationship_type: str # 'father', 'mother'

class ParentChildRelationshipCreate(ParentChildRelationshipBase):
    pass

class ParentChildRelationship(ParentChildRelationshipBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Graph Response
class GraphNode(BaseModel):
    id: str
    name: str
    gender: str
    x: int
    y: int
    data: Optional[Member] = None # Include full member data

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str # 'spouse', 'parent-child'
    label: Optional[str] = None
    data: Optional[dict] = None

class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    regions: Optional[List[Region]] = [] # Include regions in graph data

# Import Schemas
class ImportMember(MemberBase):
    original_id: str

class ImportSpouse(BaseModel):
    member1_original_id: str
    member2_original_id: str

class ImportParentChild(BaseModel):
    parent_original_id: str
    child_original_id: str
    relationship_type: str

class FamilyImport(BaseModel):
    family_name: str
    user_id: str
    members: List[ImportMember]
    spouse_relationships: List[ImportSpouse]
    parent_child_relationships: List[ImportParentChild]

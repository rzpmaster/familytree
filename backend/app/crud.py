import json
import os
import uuid

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import models, schemas


def generate_uuid():
    return str(uuid.uuid4())


# User
def create_user(db: Session, user: schemas.UserCreate):
    # In real app, hash password
    db_user = models.User(
        email=user.email,
        name=user.name,
        password_hash=user.password,  # In real app, hash this!
        is_superuser=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()


def delete_user(db: Session, user_id: str):
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user


def update_user_role(db: Session, user_id: str, is_superuser: bool):
    db_user = get_user(db, user_id)
    if db_user:
        db_user.is_superuser = is_superuser
        db.commit()
        db.refresh(db_user)
    return db_user


# Family
def create_family(db: Session, family: schemas.FamilyCreate):
    db_family = models.Family(**family.model_dump())
    db.add(db_family)
    db.commit()
    db.refresh(db_family)
    return db_family


def get_families(db: Session, user_id: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Family)

    if user_id:
        # Get owned families
        owned_condition = models.Family.user_id == user_id

        # Get shared families
        # This requires a subquery or join
        shared_condition = models.Family.id.in_(
            db.query(models.FamilyCollaborator.family_id).filter(
                models.FamilyCollaborator.user_id == user_id
            )
        )

        query = query.filter(owned_condition | shared_condition)

    return query.offset(skip).limit(limit).all()


def get_family(db: Session, family_id: str):
    return db.query(models.Family).filter(models.Family.id == family_id).first()


# Collaborators
def add_collaborator(db: Session, family_id: str, user_id: str, role: str):
    # Check if already exists
    existing = (
        db.query(models.FamilyCollaborator)
        .filter_by(family_id=family_id, user_id=user_id)
        .first()
    )
    if existing:
        existing.role = role
        db.commit()
        db.refresh(existing)
        return existing

    collab = models.FamilyCollaborator(family_id=family_id, user_id=user_id, role=role)
    db.add(collab)
    db.commit()
    db.refresh(collab)
    return collab


def remove_collaborator(db: Session, family_id: str, user_id: str):
    collab = (
        db.query(models.FamilyCollaborator)
        .filter_by(family_id=family_id, user_id=user_id)
        .first()
    )
    if collab:
        db.delete(collab)
        db.commit()
        return True
    return False


def get_collaborators(db: Session, family_id: str):
    return db.query(models.FamilyCollaborator).filter_by(family_id=family_id).all()


def get_user_role_in_family(db: Session, family_id: str, user_id: str):
    family = get_family(db, family_id)
    if not family:
        return None

    if family.user_id == user_id:
        return "owner"

    collab = (
        db.query(models.FamilyCollaborator)
        .filter_by(family_id=family_id, user_id=user_id)
        .first()
    )
    if collab:
        return collab.role

    return None


def update_family(db: Session, family_id: str, family: schemas.FamilyUpdate):
    db_family = get_family(db, family_id)
    if db_family:
        update_data = family.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_family, key, value)
        db.commit()
        db.refresh(db_family)
    return db_family


# Access Requests
def create_access_request(db: Session, request: schemas.AccessRequestCreate):
    # Check if exists
    existing = (
        db.query(models.AccessRequest)
        .filter_by(
            family_id=request.family_id, user_id=request.user_id, status="pending"
        )
        .first()
    )
    if existing:
        return existing

    db_req = models.AccessRequest(**request.model_dump())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


def get_access_request(db: Session, request_id: str):
    return (
        db.query(models.AccessRequest)
        .filter(models.AccessRequest.id == request_id)
        .first()
    )


def get_pending_access_requests(db: Session, user_id: str):
    # Find families where user is owner or admin
    # 1. Owned families
    owned_families = (
        db.query(models.Family.id).filter(models.Family.user_id == user_id).all()
    )
    owned_ids = [f.id for f in owned_families]

    # 2. Admin families
    admin_families = (
        db.query(models.FamilyCollaborator.family_id)
        .filter(
            models.FamilyCollaborator.user_id == user_id,
            models.FamilyCollaborator.role == "admin",
        )
        .all()
    )
    admin_ids = [f.family_id for f in admin_families]

    all_ids = list(set(owned_ids + admin_ids))

    return (
        db.query(models.AccessRequest)
        .filter(
            models.AccessRequest.family_id.in_(all_ids),
            models.AccessRequest.status == "pending",
        )
        .all()
    )


def update_access_request_status(db: Session, request_id: str, status: str):
    req = get_access_request(db, request_id)
    if req:
        req.status = status
        db.commit()
        db.refresh(req)
    return req


def delete_family(db: Session, family_id: str):
    db_family = get_family(db, family_id)
    if db_family:
        db.delete(db_family)
        db.commit()
    return db_family


# Member
def create_member(db: Session, member: schemas.MemberCreate):
    db_member = models.Member(**member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


def get_members(db: Session, family_id: str, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Member)
        .filter(models.Member.family_id == family_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_member(db: Session, member_id: str):
    return db.query(models.Member).filter(models.Member.id == member_id).first()


def update_member(db: Session, member_id: str, member: schemas.MemberUpdate):
    db_member = get_member(db, member_id)
    if db_member:
        update_data = member.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_member, key, value)
        db.commit()
        db.refresh(db_member)
    return db_member


def delete_member(db: Session, member_id: str):
    db_member = get_member(db, member_id)
    if db_member:
        db.delete(db_member)
        db.commit()
    return db_member


# Relationships
def create_spouse_relationship(
    db: Session, relationship: schemas.SpouseRelationshipCreate
):
    db_rel = models.SpouseRelationship(**relationship.model_dump())
    db.add(db_rel)
    db.commit()
    db.refresh(db_rel)
    return db_rel


def create_parent_child_relationship(
    db: Session, relationship: schemas.ParentChildRelationshipCreate
):
    db_rel = models.ParentChildRelationship(**relationship.model_dump())
    db.add(db_rel)
    db.commit()
    db.refresh(db_rel)
    return db_rel


def delete_spouse_relationship(db: Session, relationship_id: str):
    db_rel = (
        db.query(models.SpouseRelationship)
        .filter(models.SpouseRelationship.id == relationship_id)
        .first()
    )
    if db_rel:
        db.delete(db_rel)
        db.commit()
    return db_rel


def update_spouse_relationship(
    db: Session, relationship_id: str, relationship: schemas.SpouseRelationshipUpdate
):
    db_rel = (
        db.query(models.SpouseRelationship)
        .filter(models.SpouseRelationship.id == relationship_id)
        .first()
    )
    if db_rel:
        update_data = relationship.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_rel, key, value)
        db.commit()
        db.refresh(db_rel)
    return db_rel


def delete_parent_child_relationship(db: Session, relationship_id: str):
    db_rel = (
        db.query(models.ParentChildRelationship)
        .filter(models.ParentChildRelationship.id == relationship_id)
        .first()
    )
    if db_rel:
        db.delete(db_rel)
        db.commit()
    return db_rel


def get_family_graph(db: Session, family_id: str):
    members = get_members(db, family_id, limit=1000)

    nodes = []
    member_ids = set()
    for m in members:
        member_ids.add(m.id)
        nodes.append(
            schemas.GraphNode(
                id=m.id,
                name=m.name,
                gender=m.gender,
                x=m.position_x,
                y=m.position_y,
                data=m,
            )
        )

    edges = []
    # Spouses
    # Optimized: Filter relationships by member IDs in SQL if possible, but for now filter in python
    # Ideally we should query relationships belonging to this family (via member -> family_id)
    # But current relationship tables don't have family_id directly.
    # We can join or just query all and filter (slow for large db, ok for demo).
    # Better: Query relationships where member1_id IN member_ids

    spouses = (
        db.query(models.SpouseRelationship)
        .filter(
            (models.SpouseRelationship.member1_id.in_(member_ids))
            | (models.SpouseRelationship.member2_id.in_(member_ids))
        )
        .all()
    )

    for s in spouses:
        if s.member1_id in member_ids and s.member2_id in member_ids:
            edges.append(
                schemas.GraphEdge(
                    id=s.id,
                    source=s.member1_id,
                    target=s.member2_id,
                    type="spouse",
                    data={"marriage_date": s.marriage_date},
                )
            )

    # Parent-Child
    parent_child = (
        db.query(models.ParentChildRelationship)
        .filter(
            (models.ParentChildRelationship.parent_id.in_(member_ids))
            | (models.ParentChildRelationship.child_id.in_(member_ids))
        )
        .all()
    )

    for pc in parent_child:
        if pc.parent_id in member_ids and pc.child_id in member_ids:
            edges.append(
                schemas.GraphEdge(
                    id=pc.id,
                    source=pc.parent_id,
                    target=pc.child_id,
                    type="parent-child",
                    label=pc.relationship_type,
                )
            )

    # Regions
    regions = db.query(models.Region).filter(models.Region.family_id == family_id).all()

    return schemas.GraphData(nodes=nodes, edges=edges, regions=regions)


def import_family_from_preset(db: Session, key: str, user_id: str):
    file_map = {
        "han_dynasty": "han_data.json",
        "tang_dynasty": "tang_data.json",
        "ming_dynasty": "ming_data.json",
    }

    filename = file_map.get(key)
    if not filename:
        return None

    file_path = os.path.join(os.path.dirname(__file__), "data", filename)

    # 1) Read JSON
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return None
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in preset file: {file_path}, error: {e}")
        return None

    # 2) Override user_id (do not trust preset)
    if not isinstance(data, dict):
        print(f"Preset JSON root must be an object/dict: {file_path}")
        return None
    data["user_id"] = user_id

    # 3) Validate schema (missing property will raise)
    import_data = schemas.FamilyImport.model_validate(data)

    # 4) Call import_family (it already manages transaction via db.begin())
    try:
        return import_family(db, import_data)
    except Exception as e:
        # Non-DB unexpected errors
        try:
            db.rollback()
        except Exception:
            pass
        print(f"Unexpected error importing preset key={key}: {e}")
        return None


def import_family(db: Session, import_data: schemas.FamilyImport):
    try:
        with db.begin():  # 事务：成功一次性提交，失败自动回滚
            # 1. Create Family
            family_data = schemas.FamilyCreate(
                family_name=import_data.family_name, user_id=import_data.user_id
            ).model_dump()
            db_family = models.Family(**family_data)
            db.add(db_family)
            db.flush()  # Ensure ID is generated

            # 2. Create Regions & Map IDs
            region_id_map: dict[str, str] = {}  # original_id -> new_db_id
            if import_data.regions:
                for r in import_data.regions:
                    db_region = models.Region(
                        family_id=db_family.id,
                        name=r.name,
                        description=r.description,
                        color=r.color,
                    )
                    db.add(db_region)
                    db.flush()  # 拿到 db_region.id，不 commit
                    if r.original_id:
                        region_id_map[r.original_id.strip()] = db_region.id

            # 3. Create Members & Map IDs
            id_map: dict[str, str] = {}  # original_id -> new_db_id
            for m in import_data.members:
                new_region_id = None
                m_rid = m.region_id.strip() if m.region_id else None
                if m_rid and m_rid in region_id_map:
                    new_region_id = region_id_map[m_rid]

                member_data = schemas.MemberCreate(
                    family_id=db_family.id,
                    name=m.name,
                    surname=m.surname,
                    gender=m.gender,
                    birth_date=m.birth_date,
                    death_date=m.death_date,
                    is_deceased=m.is_deceased,
                    is_fuzzy=m.is_fuzzy,
                    remark=m.remark,
                    birth_place=m.birth_place,
                    photo_url=m.photo_url,
                    position_x=m.position_x,
                    position_y=m.position_y,
                    sort_order=m.sort_order,
                    region_id=new_region_id,
                ).model_dump()

                db_member = models.Member(**member_data)
                db.add(db_member)
                db.flush()
                id_map[m.original_id] = db_member.id

            # 4. Create Spouse Relationships
            for s in import_data.spouse_relationships or []:
                a = id_map.get(s.member1_original_id)
                b = id_map.get(s.member2_original_id)
                if a and b:
                    rel_data = schemas.SpouseRelationshipCreate(
                        member1_id=a,
                        member2_id=b,
                        marriage_date=getattr(s, "marriage_date", None),
                    ).model_dump()
                    db_rel = models.SpouseRelationship(**rel_data)
                    db.add(db_rel)

            # 5. Create Parent-Child Relationships
            for pc in import_data.parent_child_relationships or []:
                p = id_map.get(pc.parent_original_id)
                c = id_map.get(pc.child_original_id)
                if p and c:
                    rel_data = schemas.ParentChildRelationshipCreate(
                        parent_id=p, child_id=c, relationship_type=pc.relationship_type
                    ).model_dump()
                    db_rel = models.ParentChildRelationship(**rel_data)
                    db.add(db_rel)

            # 刷新 family（可选）
            # 注意：在 db.begin() 块内，flush 是可以将变更发送到数据库的。
            # refresh 通常用于重新加载数据。
            db.flush()
            # db.refresh(db_family) # 在 begin() 块内 refresh 是安全的

            return db_family

    except SQLAlchemyError:
        # 事务上下文会自动 rollback，这里抛出让上层处理
        raise

import json
import logging
import os
import uuid
from collections import Counter
from typing import List

from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import models, schemas

logger = logging.getLogger(__name__)


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
    # Extract region_ids from the Pydantic model
    member_data = member.model_dump()
    region_ids = member_data.pop("region_ids", [])

    db_member = models.Member(**member_data)

    if region_ids:
        regions = db.query(models.Region).filter(models.Region.id.in_(region_ids)).all()
        db_member.regions = regions

    db.add(db_member)
    db.flush()  # Flush to get ID

    # Create MemberPosition
    db_pos = models.MemberPosition(
        member_id=db_member.id, family_id=member.family_id, x=0, y=0
    )
    db.add(db_pos)

    db.commit()
    db.refresh(db_member)

    # Manually populate region_ids
    db_member.region_ids = [r.id for r in db_member.regions]

    return db_member


def get_members(db: Session, family_id: str, skip: int = 0, limit: int = 100):
    # Join with MemberPosition to get positions for this family
    results = (
        db.query(models.Member, models.MemberPosition)
        .outerjoin(
            models.MemberPosition,
            (models.MemberPosition.member_id == models.Member.id)
            & (models.MemberPosition.family_id == family_id),
        )
        .filter(models.Member.family_id == family_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    members = []
    for m, p in results:
        m.region_ids = [r.id for r in m.regions]
        members.append(m)

    return members


def get_member(db: Session, member_id: str):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if member:
        member.region_ids = [r.id for r in member.regions]

    return member


def update_member(db: Session, member_id: str, member: schemas.MemberUpdate):
    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if db_member:
        update_data = member.model_dump(exclude_unset=True)

        # Handle regions update
        if "region_ids" in update_data:
            region_ids = update_data.pop("region_ids")
            if region_ids is not None:
                regions = (
                    db.query(models.Region)
                    .filter(models.Region.id.in_(region_ids))
                    .all()
                )
                db_member.regions = regions

        for key, value in update_data.items():
            setattr(db_member, key, value)

        db.commit()
        db.refresh(db_member)
        db_member.region_ids = [r.id for r in db_member.regions]

    return db_member


def update_members_positions(
    db: Session, updates: List[schemas.MemberPositionUpdate], family_id: str
):
    logger.info(f"Updating positions for family {family_id}, count: {len(updates)}")
    # Upsert positions
    for update in updates:
        pos = (
            db.query(models.MemberPosition)
            .filter(
                models.MemberPosition.member_id == update.id,
                models.MemberPosition.family_id == family_id,
            )
            .first()
        )

        if pos:
            # logger.info(f"Updating pos for {update.id}: {update.position_x}, {update.position_y}")
            pos.x = update.position_x
            pos.y = update.position_y
        else:
            logger.info(f"Creating pos for {update.id} in family {family_id}: {update.position_x}, {update.position_y}")
            pos = models.MemberPosition(
                member_id=update.id,
                family_id=family_id,
                x=update.position_x,
                y=update.position_y,
            )
            db.add(pos)

    try:
        db.commit()
        # Force refresh of all instances in session to ensure subsequent reads get fresh data
        db.expire_all()
        logger.info("Positions committed successfully")
    except Exception as e:
        logger.error(f"Error committing positions: {e}")
        db.rollback()
        raise
        
    return True


def delete_region(db: Session, region_id: str):
    db_region = db.query(models.Region).filter(models.Region.id == region_id).first()
    if db_region:
        db.delete(db_region)
        db.commit()
    return db_region


def delete_member(db: Session, member_id: str):
    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if db_member:
        # Prepare response data before deletion
        # Fetch position
        # Position logic removed from Member model
        db_member.region_ids = [r.id for r in db_member.regions]
        
        # Create Pydantic model instance to return, ensuring it survives session commit/expiry
        member_response = schemas.Member.model_validate(db_member)

        # Check for related relationships and delete them first
        # This is a manual cascade for safety, though database cascade should handle it.
        # But if the DB constraints are restrictive without ON DELETE CASCADE, we must do it manually.
        
        # 1. Spouse Relationships
        db.query(models.SpouseRelationship).filter(
            or_(
                models.SpouseRelationship.member1_id == member_id,
                models.SpouseRelationship.member2_id == member_id
            )
        ).delete(synchronize_session=False)
        
        # 2. Parent-Child Relationships
        db.query(models.ParentChildRelationship).filter(
            or_(
                models.ParentChildRelationship.parent_id == member_id,
                models.ParentChildRelationship.child_id == member_id
            )
        ).delete(synchronize_session=False)
        
        # 3. Member Positions
        db.query(models.MemberPosition).filter(
            models.MemberPosition.member_id == member_id
        ).delete(synchronize_session=False)

        affected_regions = list(db_member.regions)

        db.delete(db_member)
        db.flush()

        for region in affected_regions:
            count = (
                db.query(models.member_regions)
                .filter(models.member_regions.c.region_id == region.id)
                .count()
            )
            if count == 0:
                db.delete(region)

        db.commit()
        return member_response
    return None


def delete_members(db: Session, member_ids: list[str]):
    members = db.query(models.Member).filter(models.Member.id.in_(member_ids)).all()
    if not members:
        return []

    affected_regions = set()
    for m in members:
        for r in m.regions:
            affected_regions.add(r)

    for member in members:
        db.delete(member)

    db.flush()

    for region in affected_regions:
        count = (
            db.query(models.member_regions)
            .filter(models.member_regions.c.region_id == region.id)
            .count()
        )
        if count == 0:
            db.delete(region)

    db.commit()
    return members


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
    linked_regions = (
        db.query(models.Region)
        .filter(
            models.Region.family_id == family_id,
            models.Region.linked_family_id.isnot(None),
        )
        .all()
    )
    linked_family_map = {
        lr.linked_family_id: lr.id for lr in linked_regions if lr.linked_family_id
    }
    linked_family_ids = list(linked_family_map.keys())

    conditions = [
        models.Member.family_id == family_id,
        models.Member.regions.any(models.Region.family_id == family_id),
    ]
    if linked_family_ids:
        conditions.append(models.Member.family_id.in_(linked_family_ids))

    members = (
        db.query(models.Member)
        .filter(or_(*conditions))
        .limit(2000)
        .all()
    )

    logger.info(f"get_family_graph: family_id={family_id}, members={len(members)}")
    
    # Get positions for ALL members in THIS family context
    member_ids = [m.id for m in members]
    positions = (
        db.query(models.MemberPosition)
        .filter(
            models.MemberPosition.member_id.in_(member_ids),
            models.MemberPosition.family_id == family_id,
        )
        .all()
    )
    logger.info(f"get_family_graph: found {len(positions)} position records for family {family_id}")
    pos_map = {p.member_id: (p.x, p.y) for p in positions}

    for m in members:
        rids = {r.id for r in m.regions}

        if m.family_id and m.family_id in linked_family_map:
            rids.add(linked_family_map[m.family_id])

        m.region_ids = list(rids)
        
    nodes = []
    member_ids_set = set()
    for m in members:
        member_ids_set.add(m.id)
        
        # Look up position
        pos = pos_map.get(m.id, (0, 0))
        
        nodes.append(
            schemas.GraphNode(
                id=m.id,
                name=m.name,
                gender=m.gender,
                x=pos[0],
                y=pos[1],
                data=m,
            )
        )

    edges = []
    spouses = (
        db.query(models.SpouseRelationship)
        .filter(
            (models.SpouseRelationship.member1_id.in_(member_ids_set))
            | (models.SpouseRelationship.member2_id.in_(member_ids_set))
        )
        .all()
    )

    for s in spouses:
        if s.member1_id in member_ids_set or s.member2_id in member_ids_set:
            edges.append(
                schemas.GraphEdge(
                    id=s.id,
                    source=s.member1_id,
                    target=s.member2_id,
                    type="spouse",
                    data={"marriage_date": s.marriage_date},
                )
            )

    parent_child = (
        db.query(models.ParentChildRelationship)
        .filter(
            (models.ParentChildRelationship.parent_id.in_(member_ids_set))
            | (models.ParentChildRelationship.child_id.in_(member_ids_set))
        )
        .all()
    )

    for pc in parent_child:
        if pc.parent_id in member_ids_set or pc.child_id in member_ids_set:
            edges.append(
                schemas.GraphEdge(
                    id=pc.id,
                    source=pc.parent_id,
                    target=pc.child_id,
                    type="parent-child",
                    label=pc.relationship_type,
                )
            )

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

    file_path = os.path.join(os.path.dirname(__file__), "historicol_data", filename)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in preset file: {file_path}, error: {e}")
        return None

    if not isinstance(data, dict):
        logger.error(f"Preset JSON root must be an object/dict: {file_path}")
        return None
    data["user_id"] = user_id

    import_data = schemas.FamilyImport.model_validate(data)

    try:
        return import_family(db, import_data)
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.error(f"Unexpected error importing preset key={key}: {e}")
        return None


def import_family(db: Session, import_data: schemas.FamilyImport):
    try:
        logger.info("Starting import_family")
        with db.begin():
            family_ids = [m.family_id for m in import_data.members if m.family_id]
            source_family_id = None
            if family_ids:
                source_family_id = Counter(family_ids).most_common(1)[0][0]
            logger.info(f"Identified source_family_id: {source_family_id}")

            # 1. Create Family
            family_data = schemas.FamilyCreate(
                family_name=import_data.family_name, user_id=import_data.user_id
            ).model_dump()
            db_family = models.Family(**family_data)
            db.add(db_family)
            db.flush()
            logger.info(f"Created family: {db_family.id}")

            # 2. Create Regions & Map IDs
            region_id_map: dict[str, str] = {}

            if import_data.regions:
                for r in import_data.regions:
                    db_region = models.Region(
                        family_id=db_family.id,
                        name=r.name,
                        description=r.description,
                        color=r.color,
                        linked_family_id=r.linked_family_id,
                    )
                    db.add(db_region)
                    db.flush()
                    if r.original_id:
                        region_id_map[r.original_id.strip()] = db_region.id

            logger.info(f"Created {len(region_id_map)} regions")

            # 3. Create Members & Map IDs
            id_map: dict[str, str] = {}
            resolved_ids_cache = {}

            def resolve_id(original_id):
                if not original_id:
                    return None
                if original_id in id_map:
                    return id_map[original_id]
                if original_id in resolved_ids_cache:
                    return resolved_ids_cache[original_id]

                try:
                    exists = (
                        db.query(models.Member.id)
                        .filter(models.Member.id == original_id)
                        .first()
                    )
                    if exists:
                        resolved_ids_cache[original_id] = original_id
                        return original_id
                except SQLAlchemyError as e:
                    logger.error(f"DB Error in resolve_id: {e}")
                    pass

                return None

            for m in import_data.members:
                new_region_ids = []
                m_rids = []
                if hasattr(m, "region_ids") and m.region_ids:
                    m_rids = m.region_ids
                elif hasattr(m, "region_id") and m.region_id:
                    m_rids = [m.region_id]

                for rid in m_rids:
                    rid_strip = rid.strip() if rid else None
                    if rid_strip and rid_strip in region_id_map:
                        new_region_ids.append(region_id_map[rid_strip])

                should_link = False
                if m.family_id and source_family_id:
                    if m.family_id != source_family_id:
                        should_link = True
                elif m.family_id is None:
                    should_link = False

                existing_member_id = None
                if should_link:
                    existing_member_id = resolve_id(m.original_id)

                    if not existing_member_id:
                        logger.info(
                            f"External member {m.original_id} (Family: {m.family_id}) not found in DB. Skipping."
                        )
                        continue

                if existing_member_id:
                    logger.info(
                        f"Member exists and is EXTERNAL: {existing_member_id}. Linking..."
                    )
                    db_member = (
                        db.query(models.Member)
                        .filter(models.Member.id == existing_member_id)
                        .first()
                    )

                    if db_member:
                        regions_to_add = set()
                        if new_region_ids:
                            regions_from_ids = (
                                db.query(models.Region)
                                .filter(models.Region.id.in_(new_region_ids))
                                .all()
                            )
                            for r in regions_from_ids:
                                regions_to_add.add(r)

                        if db_member.family_id:
                            linked_regions = (
                                db.query(models.Region)
                                .filter(
                                    models.Region.family_id == db_family.id,
                                    models.Region.linked_family_id
                                    == db_member.family_id,
                                )
                                .all()
                            )

                            for lr in linked_regions:
                                regions_to_add.add(lr)
                                logger.info(
                                    f"Auto-linking member {db_member.id} to linked region {lr.id}"
                                )

                        if regions_to_add:
                            logger.info(
                                f"Updating regions for {existing_member_id}. Total regions to add: {len(regions_to_add)}"
                            )
                            updated = False
                            for reg in regions_to_add:
                                if reg not in db_member.regions:
                                    db_member.regions.append(reg)
                                    updated = True

                            if updated:
                                db.add(db_member)
                                logger.info(f"Regions updated for {existing_member_id}")

                        # Also create MemberPosition for this family context!
                        # The linked member appears in this family's graph.
                        pos = (
                            db.query(models.MemberPosition)
                            .filter(
                                models.MemberPosition.member_id == existing_member_id,
                                models.MemberPosition.family_id == db_family.id,
                            )
                            .first()
                        )

                        if not pos:
                            pos = models.MemberPosition(
                                member_id=existing_member_id,
                                family_id=db_family.id,
                                x=0,
                                y=0,
                            )
                            db.add(pos)

                    id_map[m.original_id] = existing_member_id
                    continue

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
                    sort_order=m.sort_order,
                    region_ids=new_region_ids,
                ).model_dump()

                r_ids = member_data.pop("region_ids", [])

                db_member = models.Member(**member_data)

                if r_ids:
                    regions = (
                        db.query(models.Region)
                        .filter(models.Region.id.in_(r_ids))
                        .all()
                    )
                    db_member.regions = regions

                db.add(db_member)
                db.flush()

                # Create MemberPosition
                db_pos = models.MemberPosition(
                    member_id=db_member.id, family_id=db_family.id, x=0, y=0
                )
                db.add(db_pos)

                id_map[m.original_id] = db_member.id

            logger.info(f"Processed {len(import_data.members)} members")

            # 4. Create Spouse Relationships
            for s in import_data.spouse_relationships or []:
                a = resolve_id(s.member1_original_id)
                b = resolve_id(s.member2_original_id)

                if a and b:
                    exists_rel = (
                        db.query(models.SpouseRelationship)
                        .filter(
                            models.SpouseRelationship.member1_id == a,
                            models.SpouseRelationship.member2_id == b,
                        )
                        .first()
                    )

                    if not exists_rel:
                        exists_reverse = (
                            db.query(models.SpouseRelationship)
                            .filter(
                                models.SpouseRelationship.member1_id == b,
                                models.SpouseRelationship.member2_id == a,
                            )
                            .first()
                        )

                        if not exists_reverse:
                            rel_data = schemas.SpouseRelationshipCreate(
                                member1_id=a,
                                member2_id=b,
                                marriage_date=getattr(s, "marriage_date", None),
                            ).model_dump()
                            db_rel = models.SpouseRelationship(**rel_data)
                            db.add(db_rel)
                        else:
                            logger.info(
                                f"Spouse relationship already exists (reverse): {b} <-> {a}"
                            )
                    else:
                        logger.info(f"Spouse relationship already exists: {a} <-> {b}")

            # 5. Create Parent-Child Relationships
            for pc in import_data.parent_child_relationships or []:
                p = resolve_id(pc.parent_original_id)
                c = resolve_id(pc.child_original_id)

                if p and c:
                    exists_pc = (
                        db.query(models.ParentChildRelationship)
                        .filter(
                            models.ParentChildRelationship.parent_id == p,
                            models.ParentChildRelationship.child_id == c,
                            models.ParentChildRelationship.relationship_type
                            == pc.relationship_type,
                        )
                        .first()
                    )

                    if not exists_pc:
                        rel_data = schemas.ParentChildRelationshipCreate(
                            parent_id=p,
                            child_id=c,
                            relationship_type=pc.relationship_type,
                        ).model_dump()
                        db_rel = models.ParentChildRelationship(**rel_data)
                        db.add(db_rel)
                    else:
                        logger.info(
                            f"Parent-Child relationship already exists: {p} -> {c}"
                        )

            db.flush()
            logger.info("Import completed successfully")
            return db_family

    except SQLAlchemyError as e:
        logger.error(f"SQLAlchemyError in import_family: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in import_family: {e}")
        raise

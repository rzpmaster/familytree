import json
import logging
import os
import uuid
from collections import Counter

logger = logging.getLogger(__name__)

from sqlalchemy import or_
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
    # Extract region_ids from the Pydantic model
    member_data = member.model_dump()
    region_ids = member_data.pop("region_ids", [])

    db_member = models.Member(**member_data)

    if region_ids:
        regions = db.query(models.Region).filter(models.Region.id.in_(region_ids)).all()
        db_member.regions = regions

    db.add(db_member)
    db.commit()
    db.refresh(db_member)

    # Manually populate region_ids for response schema if not using relationship loading option
    # However, Pydantic's from_attributes usually handles relationships if mapped.
    # But here Member schema has `region_ids: List[str]`.
    # We need to ensure the response model can extract `region_ids` from `db_member.regions`.
    # This might require a custom validator or property in the Pydantic model, OR we adjust the response manually.
    # Or better, we add a property to the ORM model (not persistent) or just let Pydantic handle it if we modify the schema to use `regions` list of objects.
    # Given the schema change `region_ids: Optional[List[str]]`, we need to make sure `db_member` has `region_ids` attribute.
    db_member.region_ids = [r.id for r in db_member.regions]

    return db_member


def get_members(db: Session, family_id: str, skip: int = 0, limit: int = 100):
    members = (
        db.query(models.Member)
        .filter(models.Member.family_id == family_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    # Populate region_ids for each member
    for m in members:
        m.region_ids = [r.id for r in m.regions]
    return members


def get_member(db: Session, member_id: str):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if member:
        member.region_ids = [r.id for r in member.regions]
    return member


def update_member(db: Session, member_id: str, member: schemas.MemberUpdate):
    db_member = (
        db.query(models.Member).filter(models.Member.id == member_id).first()
    )  # Avoid calling get_member to prevent recursion or attribute issues
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


def delete_region(db: Session, region_id: str):
    db_region = db.query(models.Region).filter(models.Region.id == region_id).first()
    if db_region:
        # Many-to-many relationship handles deletion from association table automatically usually,
        # but let's be safe. The association table rows are deleted, but members remain.
        # We don't need to manually update members because the link is in the association table.
        db.delete(db_region)
        db.commit()
    return db_region


def delete_member(db: Session, member_id: str):
    db_member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if db_member:
        # Check affected regions before deletion?
        # With many-to-many, we might want to delete a region if it becomes empty?
        # Logic: Find regions this member belongs to.
        affected_regions = list(db_member.regions)

        db.delete(db_member)
        db.flush()

        # Check if any affected region is now empty
        for region in affected_regions:
            # We need to count members in this region.
            # Since we are in a transaction and flushed, the count should reflect deletion.
            # But we need to query via association table.
            # count = len(region.members) # This might use cached relationship
            # Better to use query
            count = (
                db.query(models.member_regions)
                .filter(models.member_regions.c.region_id == region.id)
                .count()
            )
            if count == 0:
                db.delete(region)

        db.commit()
    return db_member


def delete_members(db: Session, member_ids: list[str]):
    # Get all members to find their regions
    members = db.query(models.Member).filter(models.Member.id.in_(member_ids)).all()
    if not members:
        return []

    # Collect affected regions
    affected_regions = set()
    for m in members:
        for r in m.regions:
            affected_regions.add(r)

    # Delete members
    for member in members:
        db.delete(member)

    db.flush()  # Apply deletions in transaction

    # Check affected regions
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
    # members = get_members(db, family_id, limit=1000)
    # Include linked members that belong to regions of this family
    members = (
        db.query(models.Member)
        .filter(
            or_(
                models.Member.family_id == family_id,
                models.Member.regions.any(models.Region.family_id == family_id),
            )
        )
        .limit(1000)
        .all()
    )

    # Populate region_ids for each member manually as we bypassed get_members
    # Also handle implicit linked regions
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

    for m in members:
        # Start with explicit regions
        rids = {r.id for r in m.regions}

        # Add implicit linked region if applicable
        # If the member belongs to a family that is linked by one of our regions,
        # they are implicitly part of that region.
        if m.family_id and m.family_id in linked_family_map:
            rids.add(linked_family_map[m.family_id])

        m.region_ids = list(rids)

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
        if s.member1_id in member_ids or s.member2_id in member_ids:
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
        if pc.parent_id in member_ids or pc.child_id in member_ids:
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

    file_path = os.path.join(os.path.dirname(__file__), "historicol_data", filename)

    # 1) Read JSON
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in preset file: {file_path}, error: {e}")
        return None

    # 2) Override user_id (do not trust preset)
    if not isinstance(data, dict):
        logger.error(f"Preset JSON root must be an object/dict: {file_path}")
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
        logger.error(f"Unexpected error importing preset key={key}: {e}")
        return None


def import_family(db: Session, import_data: schemas.FamilyImport):
    try:
        logger.info("Starting import_family")
        with db.begin():  # 事务：成功一次性提交，失败自动回滚
            # 0. Identify Source Family ID
            # We assume the most frequent family_id in the members list is the source family ID.
            # Members belonging to this ID should be CLONED (new members created).
            # Members belonging to OTHER IDs should be LINKED (if they exist).
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
            db.flush()  # Ensure ID is generated
            logger.info(f"Created family: {db_family.id}")

            # 2. Create Regions & Map IDs
            region_id_map: dict[str, str] = {}  # original_id -> new_db_id

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
                    db.flush()  # 拿到 db_region.id，不 commit
                    if r.original_id:
                        region_id_map[r.original_id.strip()] = db_region.id

            logger.info(f"Created {len(region_id_map)} regions")

            # 3. Create Members & Map IDs
            id_map: dict[str, str] = {}  # original_id -> new_db_id
            # Helper to resolve ID (reused later)
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
                # Handle multiple region IDs if present, fallback to singular region_id for backward compatibility
                m_rids = []
                if hasattr(m, "region_ids") and m.region_ids:
                    m_rids = m.region_ids
                elif hasattr(m, "region_id") and m.region_id:
                    m_rids = [m.region_id]

                for rid in m_rids:
                    rid_strip = rid.strip() if rid else None
                    if rid_strip and rid_strip in region_id_map:
                        new_region_ids.append(region_id_map[rid_strip])

                # Determine if we should LINK or CLONE
                should_link = False
                if m.family_id and source_family_id:
                    if m.family_id != source_family_id:
                        should_link = True
                elif m.family_id is None:
                    # Fallback: if no family_id, assume clone unless explicitly handled?
                    # Or maybe assume clone.
                    should_link = False

                # Check if member already exists (linked member)
                existing_member_id = None
                if should_link:
                    existing_member_id = resolve_id(m.original_id)

                    # If it's a linked member but NOT found in DB, skip it!
                    # Do NOT create it as a new member in the current family.
                    if not existing_member_id:
                        logger.info(
                            f"External member {m.original_id} (Family: {m.family_id}) not found in DB. Skipping."
                        )
                        continue

                if existing_member_id:
                    logger.info(
                        f"Member exists and is EXTERNAL: {existing_member_id}. Linking..."
                    )
                    # Member exists (likely from a linked family)
                    # We update their regions to include the newly imported regions
                    db_member = (
                        db.query(models.Member)
                        .filter(models.Member.id == existing_member_id)
                        .first()
                    )

                    if db_member:
                        # 1. Add to explicitly linked regions (from region_ids)
                        regions_to_add = set()
                        if new_region_ids:
                            regions_from_ids = (
                                db.query(models.Region)
                                .filter(models.Region.id.in_(new_region_ids))
                                .all()
                            )
                            for r in regions_from_ids:
                                regions_to_add.add(r)

                        # 2. Auto-link to Linked Family Regions
                        # If the member belongs to a family that corresponds to one of our new linked regions, add them!
                        # This handles the case where export data has empty region_ids for linked members.
                        if db_member.family_id:
                            # Find any new region that links to this member's family
                            linked_regions = (
                                db.query(models.Region)
                                .filter(
                                    models.Region.family_id
                                    == db_family.id,  # Belongs to current family
                                    models.Region.linked_family_id
                                    == db_member.family_id,
                                )
                                .all()
                            )

                            # Note: linked_regions might be empty if not yet flushed or committed?
                            # They were added and flushed in step 2. So they should be queryable in same transaction.
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
                                db.add(
                                    db_member
                                )  # Force add to session to ensure dirty state
                                logger.info(
                                    f"Regions updated for {existing_member_id}"
                                )
                        else:
                            logger.debug(
                                f"No new regions for existing member {existing_member_id}"
                            )

                    # We map the ID but do not create a new member
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
                    position_x=m.position_x,
                    position_y=m.position_y,
                    sort_order=m.sort_order,
                    region_ids=new_region_ids,
                ).model_dump()

                # Extract region_ids for many-to-many assignment
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
                id_map[m.original_id] = db_member.id

            logger.info(f"Processed {len(import_data.members)} members")

            # 4. Create Spouse Relationships
            for s in import_data.spouse_relationships or []:
                a = resolve_id(s.member1_original_id)
                b = resolve_id(s.member2_original_id)

                if a and b:
                    # Check if relationship already exists
                    # We check both (a, b) and (b, a) to be safe, though constraint is usually on specific pair
                    # But if we treat spouse as undirected, we should check both.
                    # Based on UniqueConstraint("member1_id", "member2_id"), it's directed in DB schema.
                    # But let's assume we don't want to duplicate if (a,b) exists.
                    exists_rel = (
                        db.query(models.SpouseRelationship)
                        .filter(
                            models.SpouseRelationship.member1_id == a,
                            models.SpouseRelationship.member2_id == b,
                        )
                        .first()
                    )

                    if not exists_rel:
                        # Try reverse too if model logic implies undirected uniqueness (optional but safe)
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
                    # Check existence
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

            # 刷新 family（可选）
            # 注意：在 db.begin() 块内，flush 是可以将变更发送到数据库的。
            # refresh 通常用于重新加载数据。
            db.flush()
            # db.refresh(db_family) # 在 begin() 块内 refresh 是安全的

            logger.info("Import completed successfully")
            return db_family

    except SQLAlchemyError as e:
        logger.error(f"SQLAlchemyError in import_family: {e}")
        # 事务上下文会自动 rollback，这里抛出让上层处理
        raise
    except Exception as e:
        logger.error(f"Unexpected error in import_family: {e}")
        raise

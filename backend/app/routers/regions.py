from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/api/regions",
    tags=["regions"],
)


@router.post("/", response_model=schemas.Region)
def create_region(region: schemas.RegionCreate, db: Session = Depends(get_db)):
    # Create Region
    db_region = models.Region(
        family_id=region.family_id,
        name=region.name,
        description=region.description,
        color=region.color,
    )
    db.add(db_region)
    db.commit()
    db.refresh(db_region)

    # Assign Members if provided
    if region.member_ids:
        # We need to ensure members belong to the same family
        members = (
            db.query(models.Member)
            .filter(models.Member.id.in_(region.member_ids))
            .all()
        )
        for member in members:
            if member.family_id == region.family_id:
                member.region_id = db_region.id
        db.commit()
        db.refresh(db_region)

    return db_region


@router.get("/{region_id}", response_model=schemas.Region)
def read_region(region_id: str, db: Session = Depends(get_db)):
    db_region = db.query(models.Region).filter(models.Region.id == region_id).first()
    if db_region is None:
        raise HTTPException(status_code=404, detail="Region not found")
    return db_region


@router.put("/{region_id}", response_model=schemas.Region)
def update_region(
    region_id: str, region: schemas.RegionUpdate, db: Session = Depends(get_db)
):
    db_region = db.query(models.Region).filter(models.Region.id == region_id).first()
    if db_region is None:
        raise HTTPException(status_code=404, detail="Region not found")

    if region.name is not None:
        db_region.name = region.name
    if region.description is not None:
        db_region.description = region.description
    if region.color is not None:
        db_region.color = region.color

    if region.member_ids is not None:
        current_member_ids = {m.id for m in db_region.members}
        new_member_ids = set(region.member_ids)

        to_remove = current_member_ids - new_member_ids
        to_add = new_member_ids - current_member_ids

        if to_remove:
            db.query(models.Member).filter(models.Member.id.in_(to_remove)).update(
                {models.Member.region_id: None}, synchronize_session=False
            )

        if to_add:
            db.query(models.Member).filter(
                models.Member.id.in_(to_add),
                models.Member.family_id == db_region.family_id,
            ).update({models.Member.region_id: region_id}, synchronize_session=False)

    db.commit()
    db.refresh(db_region)
    return db_region


@router.delete("/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_region(region_id: str, db: Session = Depends(get_db)):
    db_region = db.query(models.Region).filter(models.Region.id == region_id).first()
    if db_region is None:
        raise HTTPException(status_code=404, detail="Region not found")

    db.delete(db_region)
    db.commit()
    return None


@router.get("/family/{family_id}", response_model=List[schemas.Region])
def read_regions_by_family(family_id: str, db: Session = Depends(get_db)):
    return db.query(models.Region).filter(models.Region.family_id == family_id).all()
    return db.query(models.Region).filter(models.Region.family_id == family_id).all()

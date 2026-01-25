from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/api/members",
    tags=["members"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Member)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    return crud.create_member(db=db, member=member)

@router.get("/", response_model=List[schemas.Member])
def read_members(family_id: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    members = crud.get_members(db, family_id=family_id, skip=skip, limit=limit)
    return members

@router.get("/{member_id}", response_model=schemas.Member)
def read_member(member_id: str, db: Session = Depends(get_db)):
    db_member = crud.get_member(db, member_id=member_id)
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return db_member

@router.put("/{member_id}", response_model=schemas.Member)
def update_member(member_id: str, member: schemas.MemberUpdate, db: Session = Depends(get_db)):
    db_member = crud.update_member(db, member_id=member_id, member=member)
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return db_member

@router.delete("/{member_id}", response_model=schemas.Member)
def delete_member(member_id: str, db: Session = Depends(get_db)):
    db_member = crud.delete_member(db, member_id=member_id)
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return db_member

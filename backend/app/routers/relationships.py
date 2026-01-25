from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/api/relationships",
    tags=["relationships"],
    responses={404: {"description": "Not found"}},
)

@router.post("/spouse", response_model=schemas.SpouseRelationship)
def create_spouse_relationship(relationship: schemas.SpouseRelationshipCreate, db: Session = Depends(get_db)):
    # Basic validation: check if members exist
    member1 = crud.get_member(db, relationship.member1_id)
    member2 = crud.get_member(db, relationship.member2_id)
    if not member1 or not member2:
        raise HTTPException(status_code=404, detail="One or both members not found")
    
    try:
        return crud.create_spouse_relationship(db=db, relationship=relationship)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/parent-child", response_model=schemas.ParentChildRelationship)
def create_parent_child_relationship(relationship: schemas.ParentChildRelationshipCreate, db: Session = Depends(get_db)):
    # Basic validation
    parent = crud.get_member(db, relationship.parent_id)
    child = crud.get_member(db, relationship.child_id)
    if not parent or not child:
        raise HTTPException(status_code=404, detail="Parent or child not found")
        
    try:
        return crud.create_parent_child_relationship(db=db, relationship=relationship)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/spouse/{relationship_id}")
def delete_spouse_relationship(relationship_id: str, db: Session = Depends(get_db)):
    result = crud.delete_spouse_relationship(db, relationship_id)
    if not result:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"status": "success"}

@router.put("/spouse/{relationship_id}", response_model=schemas.SpouseRelationship)
def update_spouse_relationship(relationship_id: str, relationship: schemas.SpouseRelationshipUpdate, db: Session = Depends(get_db)):
    result = crud.update_spouse_relationship(db, relationship_id, relationship)
    if not result:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return result

@router.delete("/parent-child/{relationship_id}")
def delete_parent_child_relationship(relationship_id: str, db: Session = Depends(get_db)):
    result = crud.delete_parent_child_relationship(db, relationship_id)
    if not result:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"status": "success"}

@router.get("/graph/{family_id}", response_model=schemas.GraphData)
def get_graph(family_id: str, db: Session = Depends(get_db)):
    return crud.get_family_graph(db, family_id)

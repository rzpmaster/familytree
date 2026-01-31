from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/api/families",
    tags=["families"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=schemas.Family)
def create_family(family: schemas.FamilyCreate, db: Session = Depends(get_db)):
    return crud.create_family(db=db, family=family)


@router.post("/import", response_model=schemas.Family)
def import_family(
    family_import: schemas.FamilyImport,
    user_id: str = None,
    db: Session = Depends(get_db),
):
    # If user_id is provided via query param (or in future via auth token), override the JSON content
    if user_id:
        family_import.user_id = user_id
    return crud.import_family(db=db, import_data=family_import)


@router.post("/import-preset/{key}", response_model=schemas.Family)
def import_preset_family(key: str, user_id: str, db: Session = Depends(get_db)):
    db_family = crud.import_family_from_preset(db=db, key=key, user_id=user_id)
    if db_family is None:
        raise HTTPException(status_code=400, detail="Failed to import preset family")
    return db_family


@router.get("/", response_model=List[schemas.FamilyWithRole])
def read_families(
    user_id: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    # Note: user_id param should come from auth dependency ideally.
    # For now, frontend passes it or we infer?
    # Wait, the frontend calls GET /api/families/ directly.
    # If we want to support filtering by user (My Families + Shared), we need to know WHO is asking.
    # Since we don't have full auth token validation middleware yet, let's assume client passes user_id as query param?
    # Or we just return all families if no user_id (admin view).
    # But requirement says "Invite user... invited user has read only".
    # So user should only see families they have access to.

    families = crud.get_families(db, user_id=user_id, skip=skip, limit=limit)

    # Enrich with role
    result = []
    for f in families:
        role = "viewer"  # Default
        if user_id:
            if f.user_id == user_id:
                role = "owner"
            else:
                # Check collaborator role
                collab_role = crud.get_user_role_in_family(db, f.id, user_id)
                if collab_role:
                    role = collab_role

        # Super admin check (not implemented here easily without user object)
        # But for list display, this is fine.

        f_dict = f.__dict__
        f_dict["current_user_role"] = role
        result.append(f_dict)

    return result


@router.get("/{family_id}", response_model=schemas.FamilyWithRole)
def read_family(family_id: str, user_id: str = None, db: Session = Depends(get_db)):
    db_family = crud.get_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")

    role = "viewer"
    if user_id:
        if db_family.user_id == user_id:
            role = "owner"
        else:
            collab_role = crud.get_user_role_in_family(db, family_id, user_id)
            if collab_role:
                role = collab_role

    # Create dict to inject role
    family_data = db_family.__dict__
    family_data["current_user_role"] = role

    return family_data


@router.get("/{family_id}/name", response_model=dict)
def get_family_name(family_id: str, db: Session = Depends(get_db)):
    db_family = crud.get_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return {"family_name": db_family.family_name}


@router.post("/{family_id}/invite", response_model=schemas.FamilyCollaborator)
def invite_user(
    family_id: str, invite: schemas.FamilyInvite, db: Session = Depends(get_db)
):
    # 1. Find user by email
    user = crud.get_user_by_email(db, invite.email)
    if not user:
        raise HTTPException(status_code=404, detail="User with this email not found")

    # 2. Check if family exists
    family = crud.get_family(db, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    # 3. Add collaborator
    return crud.add_collaborator(db, family_id, user.id, invite.role)


@router.get(
    "/{family_id}/collaborators", response_model=List[schemas.FamilyCollaborator]
)
def get_collaborators(family_id: str, db: Session = Depends(get_db)):
    collabs = crud.get_collaborators(db, family_id)
    # Enrich with user info
    for c in collabs:
        c.user = crud.get_user(db, c.user_id)
    return collabs


@router.delete("/{family_id}/collaborators/{user_id}")
def remove_collaborator(family_id: str, user_id: str, db: Session = Depends(get_db)):
    success = crud.remove_collaborator(db, family_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    return {"status": "success"}


@router.put(
    "/{family_id}/collaborators/{user_id}", response_model=schemas.FamilyCollaborator
)
def update_collaborator_role(
    family_id: str,
    user_id: str,
    update: schemas.FamilyCollaboratorUpdate,
    db: Session = Depends(get_db),
):
    # Verify collaborator exists
    collab = crud.add_collaborator(db, family_id, user_id, update.role)
    # Enrich
    collab.user = crud.get_user(db, user_id)
    return collab


# Access Requests
@router.post("/{family_id}/access-requests", response_model=schemas.AccessRequest)
def create_access_request(
    family_id: str, request: schemas.AccessRequestCreate, db: Session = Depends(get_db)
):
    # Basic check if family exists
    family = crud.get_family(db, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return crud.create_access_request(db, request)


@router.get("/access-requests/pending", response_model=List[schemas.AccessRequest])
def get_pending_access_requests(user_id: str, db: Session = Depends(get_db)):
    reqs = crud.get_pending_access_requests(db, user_id)
    # Enrich
    for r in reqs:
        r.user = crud.get_user(db, r.user_id)
        r.family = crud.get_family(db, r.family_id)
    return reqs


@router.put("/access-requests/{request_id}/approve")
def approve_access_request(request_id: str, db: Session = Depends(get_db)):
    req = crud.get_access_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Update status
    crud.update_access_request_status(db, request_id, "approved")

    # Add collaborator with 'editor' role (default for access request)
    crud.add_collaborator(db, req.family_id, req.user_id, "editor")

    return {"status": "success"}


@router.put("/access-requests/{request_id}/reject")
def reject_access_request(request_id: str, db: Session = Depends(get_db)):
    req = crud.get_access_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    crud.update_access_request_status(db, request_id, "rejected")
    return {"status": "success"}


@router.put("/{family_id}", response_model=schemas.Family)
def update_family(
    family_id: str, family: schemas.FamilyUpdate, db: Session = Depends(get_db)
):
    db_family = crud.update_family(db=db, family_id=family_id, family=family)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family


@router.delete("/{family_id}", response_model=schemas.Family)
def delete_family(family_id: str, db: Session = Depends(get_db)):
    db_family = crud.delete_family(db, family_id=family_id)
    if db_family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return db_family

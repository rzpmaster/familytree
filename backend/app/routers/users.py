from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db
from pydantic import BaseModel
import os

# Get Superuser IDs from env
def get_superuser_ids():
    ids_str = os.getenv("SUPERUSER_IDS", "")
    return [id.strip() for id in ids_str.split(",") if id.strip()]

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

class UserWithFamilies(schemas.User):
    families: list[schemas.Family]
    shared_families: list[schemas.FamilyCollaborator]

@router.get("/", response_model=list[UserWithFamilies])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    # We rely on ORM lazy loading or eager loading in future.
    # For now, FastAPI/Pydantic from_attributes will try to access .families
    return users

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: str, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if user is in admin config list
    superuser_ids = get_superuser_ids()
    if db_user.id in superuser_ids and not db_user.is_superuser:
        db_user = crud.update_user_role(db, db_user.id, True)
        
    return db_user

class RoleUpdate(BaseModel):
    is_superuser: bool

@router.delete("/{user_id}", response_model=schemas.User)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.delete_user(db=db, user_id=user_id)

@router.put("/{user_id}/role", response_model=schemas.User)
def update_user_role(user_id: str, role_update: RoleUpdate, db: Session = Depends(get_db)):
    user = crud.update_user_role(db, user_id=user_id, is_superuser=role_update.is_superuser)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/login", response_model=schemas.User)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=login_data.email)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # In a real app, verify password hash
    if user.password_hash != login_data.password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    # Check if user is in admin config list
    superuser_ids = get_superuser_ids()
    if user.id in superuser_ids and not user.is_superuser:
        user = crud.update_user_role(db, user.id, True)
    
    return user

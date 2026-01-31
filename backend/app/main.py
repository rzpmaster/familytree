from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import members, relationships, families, users, regions
from .db_init import init_db

# Initialize database (create DB if not exists, create tables)
init_db()

app = FastAPI(title="Family Tree API")

# CORS
origins = [
    "http://localhost:3000",
    "http://localhost:5173", # Vite default
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members.router)
app.include_router(relationships.router)
app.include_router(families.router)
app.include_router(users.router)
app.include_router(regions.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Family Tree API"}

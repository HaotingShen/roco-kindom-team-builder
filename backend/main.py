from fastapi import FastAPI
from sqlalchemy import create_engine, text
from config import DATABASE_URL

app = FastAPI()

engine = create_engine(DATABASE_URL)

@app.get("/")
def read_root():
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version();")).scalar()
        dbname = conn.execute(text("SELECT current_database();")).scalar()
    return {"message": "Welcome to roco kindom!", "db_version": version, "database": dbname}
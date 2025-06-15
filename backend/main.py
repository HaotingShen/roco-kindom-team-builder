from fastapi import FastAPI
from sqlalchemy import create_engine, text

app = FastAPI()

DATABASE_URL = "postgresql+psycopg2://roco_user:0605@localhost/roco_db"
engine = create_engine(DATABASE_URL)

@app.get("/")
def read_root():
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version();")).scalar()
        dbname = conn.execute(text("SELECT current_database();")).scalar()
    return {"message": "Welcome to roco kindom!", "db_version": version, "database": dbname}
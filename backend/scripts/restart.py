from models import Base
from config import DATABASE_URL
from sqlalchemy import create_engine

engine = create_engine(DATABASE_URL)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
"""Database proxy — re-exports from models/ for backward compatibility"""
from models.base import Base, engine, SessionLocal, JSONType
from models.init_db import init_db
from models.permissions import ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLES
from models import *

# Import all classes from split modules
from models.aftersales import *
from models.announcement import *
from models.approval import *
from models.attendance import *
from models.audit import *
from models.company import *
from models.finance import *
from models.gift import *
from models.knowledge import *
from models.message import *
from models.notification import *
from models.schedule import *
from models.task import *
from models.ticket import *
from models.field_option import *
from models.user import *
from models.warehouse import *
from models.product import *

from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

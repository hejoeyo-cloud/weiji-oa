"""Base model, engine, session"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import TypeDecorator, Text
from config import DATABASE_URL
import json

Base = declarative_base()

class JSONType(TypeDecorator):
    """JSON storage, auto-selects JSONB on PostgreSQL"""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())
    def process_bind_param(self, value, dialect):
        if value is None: return None
        return json.dumps(value, ensure_ascii=False)
    def process_result_value(self, value, dialect):
        if value is None: return None
        return json.loads(value)

_is_sqlite = "sqlite" in DATABASE_URL
_engine_args = {"connect_args": {"check_same_thread": False}} if _is_sqlite else {}
engine = create_engine(
    DATABASE_URL,
    **_engine_args,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_timeout=10,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

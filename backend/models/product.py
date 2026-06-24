from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(200), nullable=False)
    brand = Column(String(100), default="")
    model_number = Column(String(100), default="")
    category = Column(String(100), default="")
    images = Column(JSONType, default=list)
    cpu = Column(String(200), default="")
    ram = Column(String(100), default="")
    ram_freq = Column(String(100), default="")
    storage = Column(String(100), default="")
    display = Column(String(200), default="")
    gpu = Column(String(200), default="")
    ports = Column(JSONType, default=list)
    battery = Column(String(100), default="")
    weight = Column(String(100), default="")
    os = Column(String(100), default="")
    description = Column(Text, default="")
    status = Column(String(20), default="在售")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    author = relationship("User")

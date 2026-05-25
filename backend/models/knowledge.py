from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class KnowledgeCategory(Base):
    __tablename__ = "knowledge_categories"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), nullable=False)
    icon = Column(String(50), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    articles = relationship("KnowledgeArticle", back_populates="category", cascade="all, delete-orphan")

class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("knowledge_categories.id"), nullable=False)
    title = Column(String(200), nullable=False)
    problem_desc = Column(Text, default="")
    solution_steps = Column(JSONType, default=list)
    keywords = Column(String(200), default="")
    images = Column(JSONType, default=list)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    category = relationship("KnowledgeCategory", back_populates="articles")
    author = relationship("User")

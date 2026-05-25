from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class TroubleshootCategory(Base):
    __tablename__ = "troubleshoot_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    icon = Column(String(50), default="")
    sort_order = Column(Integer, default=0)

class TroubleshootStep(Base):
    __tablename__ = "troubleshoot_steps"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("troubleshoot_steps.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("troubleshoot_categories.id"), nullable=True)
    title = Column(String(200), nullable=False)
    instruction = Column(Text, default="")
    is_hardware = Column(Boolean, default=False)
    solution = Column(Text, default="")
    sort_order = Column(Integer, default=0)

    children = relationship(
        "TroubleshootStep",
        backref="parent",
        remote_side="TroubleshootStep.id",
        cascade="all, delete-orphan",
        single_parent=True,
    )


# ── 售后登记 ─────────────────────────────────────────────────────────

class ModuleConfig(Base):
    __tablename__ = "module_configs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    module_key = Column(String(50), nullable=False)
    enabled = Column(Boolean, default=True)
    display_name = Column(String(50), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")

class FieldLabel(Base):
    """字段别名 — 公司可自定义每个模块字段的显示名"""
    __tablename__ = "field_labels"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    module_key = Column(String(50), nullable=False)
    field_name = Column(String(50), nullable=False)
    label = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company")


# ─────────────────────────────────────────────────────

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from .base import Base


class FieldOption(Base):
    """字段预设选项（按公司+字段名隔离）"""
    __tablename__ = "field_options"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    field_name = Column(String(50), nullable=False, index=True)  # product/model/config/size/color/accessories
    value = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        UniqueConstraint('company_id', 'field_name', 'value', name='uq_company_field_value'),
    )

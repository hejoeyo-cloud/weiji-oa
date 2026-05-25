from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base, JSONType

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), unique=True, nullable=False)   # 角色标识（如 admin / technician）
    label = Column(String(50), nullable=False)               # 显示名称（如 超级管理员）
    color = Column(String(20), default="#1677FF")            # 显示颜色
    permissions = Column(JSONType, default=list)             # 权限列表
    is_builtin = Column(Boolean, default=False)              # 内置角色不可删除
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    # 反向关系：拥有此角色的用户
    users = relationship("User", back_populates="role_obj")


# ── 部门（需在 User 之前定义，因 User 有 FK 引用） ────────────────────

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(200), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    members = relationship("User", back_populates="department", foreign_keys="User.department_id")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    is_platform_admin = Column(Boolean, default=False)
    email = Column(String(120), unique=True, nullable=True, index=True)  # 登录邮箱（可为空兼容旧数据）
    username = Column(String(50), nullable=False)                        # 公司内昵称
    password_hash = Column(String(128), nullable=False)
    name = Column(String(50), nullable=False)
    note = Column(String(200), default="")
    role = Column(String(50), default="customer")
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_manager = Column(Boolean, default=False)
    dingtalk_user_id = Column(String(64), nullable=True)            # 钉钉用户ID，用于考勤数据匹配
    created_at = Column(DateTime, default=datetime.now)

    company = relationship("Company", back_populates="users", foreign_keys=[company_id])
    role_obj = relationship("Role", back_populates="users", foreign_keys=[role_id])
    department = relationship("Department", back_populates="members", foreign_keys=[department_id])

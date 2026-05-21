from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, Department, User
from schemas import DepartmentCreate, DepartmentOut
from auth import get_current_user, require_admin
from services import audit_service

router = APIRouter(prefix="/api/departments", tags=["departments"])


def dept_to_out(d: Department, db: Session) -> DepartmentOut:
    member_count = db.query(User).filter(User.department_id == d.id, User.company_id == d.company_id).count()
    return DepartmentOut(
        id=d.id, name=d.name, description=d.description,
        sort_order=d.sort_order, member_count=member_count,
    )


@router.get("", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Department)
    if not current_user.is_platform_admin:
        q = q.filter(Department.company_id == current_user.company_id)
    depts = q.order_by(Department.sort_order, Department.id).all()
    return [dept_to_out(d, db) for d in depts]


@router.post("", response_model=DepartmentOut)
def create_department(
    req: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if db.query(Department).filter(Department.name == req.name, Department.company_id == current_user.company_id).first():
        raise HTTPException(status_code=400, detail="Department name already exists")
    dept = Department(company_id=current_user.company_id, name=req.name, description=req.description, sort_order=req.sort_order)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    audit_service.log(db, current_user, "create", "department", dept.id, f"创建部门: {dept.name}")
    return dept_to_out(dept, db)


@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: int,
    req: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Department).filter(Department.id == dept_id)
    if not current_user.is_platform_admin:
        q = q.filter(Department.company_id == current_user.company_id)
    dept = q.first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name = req.name
    dept.description = req.description
    dept.sort_order = req.sort_order
    db.commit()
    db.refresh(dept)
    audit_service.log(db, current_user, "update", "department", dept.id, f"更新部门: {dept.name}")
    return dept_to_out(dept, db)


@router.delete("/{dept_id}")
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Department).filter(Department.id == dept_id)
    if not current_user.is_platform_admin:
        q = q.filter(Department.company_id == current_user.company_id)
    dept = q.first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    # 解除成员绑定
    db.query(User).filter(User.department_id == dept_id, User.company_id == dept.company_id).update({"department_id": None})
    db.delete(dept)
    db.commit()
    audit_service.log(db, current_user, "delete", "department", dept_id, f"删除部门: {dept.name}")
    return {"message": "OK"}

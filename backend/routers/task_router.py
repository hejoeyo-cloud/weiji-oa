from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db, TaskBoard, User
from schemas import TaskCreate, TaskUpdate, TaskOut
from auth import get_current_user, require_permission

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _task_to_out(t: TaskBoard) -> TaskOut:
    return TaskOut(
        id=t.id,
        company_id=t.company_id,
        title=t.title,
        description=t.description or "",
        status=t.status,
        priority=t.priority,
        assignee_id=t.assignee_id,
        assignee_name=t.assignee.name if t.assignee else "",
        due_date=t.due_date or "",
        sort_order=t.sort_order or 0,
        created_by=t.created_by,
        creator_name=t.creator.name if t.creator else "",
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("", response_model=list[TaskOut])
def list_tasks(
    status: str = Query("", description="filter by status: todo, in_progress, done"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(TaskBoard).filter(
        TaskBoard.company_id == current_user.company_id,
    )
    if status:
        query = query.filter(TaskBoard.status == status)
    tasks = query.order_by(TaskBoard.sort_order.asc(), TaskBoard.created_at.desc()).all()
    return [_task_to_out(t) for t in tasks]


@router.post("", response_model=TaskOut)
def create_task(
    req: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    max_order = db.query(func.coalesce(func.max(TaskBoard.sort_order), 0)).filter(
        TaskBoard.status == "todo",
        TaskBoard.company_id == current_user.company_id,
    ).scalar()

    task = TaskBoard(
        company_id=current_user.company_id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        assignee_id=req.assignee_id,
        due_date=req.due_date,
        sort_order=(max_order or 0) + 1,
        created_by=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_out(task)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    req: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(TaskBoard).filter(
        TaskBoard.id == task_id,
        TaskBoard.company_id == current_user.company_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    task.updated_at = datetime.now()
    db.commit()
    db.refresh(task)
    return _task_to_out(task)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(TaskBoard).filter(
        TaskBoard.id == task_id,
        TaskBoard.company_id == current_user.company_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    db.delete(task)
    db.commit()
    return {"ok": True}


@router.get("/stats", response_model=dict)
def get_task_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(TaskBoard.id)).filter(
        TaskBoard.company_id == current_user.company_id,
    ).scalar() or 0
    pending = db.query(func.count(TaskBoard.id)).filter(
        TaskBoard.company_id == current_user.company_id,
        TaskBoard.status.in_(["todo", "in_progress"]),
    ).scalar() or 0
    return {"total_tasks": total, "pending_tasks": pending}

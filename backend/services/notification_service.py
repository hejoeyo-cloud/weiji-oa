import asyncio

from sqlalchemy.orm import Session

from database import Notification, User
from websocket.manager import manager


def create_and_push(
    db: Session,
    user_id: int,
    ticket_id: int = None,
    title: str = "",
    content: str = "",
    resource_type: str = "",
    resource_id: int = None,
):
    user = db.query(User).filter(User.id == user_id).first()
    notification = Notification(
        company_id=user.company_id if user else None,
        user_id=user_id,
        ticket_id=ticket_id,
        resource_type=resource_type,
        resource_id=resource_id,
        title=title,
        content=content,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    payload = {
        "type": "notification",
        "data": {
            "id": notification.id,
            "user_id": user_id,
            "ticket_id": ticket_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "title": title,
            "content": content,
            "is_read": False,
            "created_at": notification.created_at.isoformat() if notification.created_at else "",
        },
    }

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(manager.send_to_user(user_id, payload))
    else:
        loop.create_task(manager.send_to_user(user_id, payload))

    return notification

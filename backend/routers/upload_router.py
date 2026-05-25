import os, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse

from auth import get_current_user
from database import User
from storage import get_storage

storage = get_storage()
router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".pdf"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    filename = f"{uuid.uuid4().hex}{ext}"
    save_name = f"shared/{filename}"
    storage.save(content, save_name)
    return {"url": storage.get_url(save_name), "filename": save_name}


@router.delete("/{filename}")
def delete_image(filename: str, current_user: User = Depends(get_current_user)):
    storage.delete(filename)
    return {"message": "Deleted"}

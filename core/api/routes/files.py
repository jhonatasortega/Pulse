import os
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from services import file_service

router = APIRouter()


class MkdirRequest(BaseModel):
    path: str


class RenameRequest(BaseModel):
    path: str
    new_name: str


class WriteTextRequest(BaseModel):
    path: str
    content: str


class TransferRequest(BaseModel):
    src: str
    dest_dir: str


@router.get("/roots")
def list_roots():
    return file_service.list_roots()


@router.get("/browse")
def browse(path: str = "/mnt"):
    try:
        return file_service.list_dir(path)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except (FileNotFoundError, NotADirectoryError) as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/mkdir")
def mkdir(req: MkdirRequest):
    try:
        return file_service.create_dir(req.path)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/delete")
def delete(path: str):
    try:
        return file_service.delete_path(path)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/rename")
def rename(req: RenameRequest):
    try:
        return file_service.rename_path(req.path, req.new_name)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/read")
def read_file(path: str):
    try:
        return file_service.read_file(path)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except (FileNotFoundError, IsADirectoryError) as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/upload")
async def upload_file(path: str, file: UploadFile = File(...)):
    try:
        content = await file.read()
        target = os.path.join(path, file.filename)
        return file_service.write_file(target, content)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.put("/write")
def write_text(req: WriteTextRequest):
    try:
        return file_service.write_file(req.path, req.content.encode("utf-8"))
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/copy")
def copy_path(req: TransferRequest):
    try:
        return file_service.copy_path(req.src, req.dest_dir)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/move")
def move_path(req: TransferRequest):
    try:
        return file_service.move_path(req.src, req.dest_dir)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/download")
def download_file(path: str):
    try:
        p = file_service._safe_path(path)
        if not p.is_file():
            raise HTTPException(404, "Not a file")
        return FileResponse(str(p), filename=p.name)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

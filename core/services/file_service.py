import os
import shutil
from pathlib import Path

ALLOWED_BASES = [
    "/host",
    "/mnt",
    "/media",
    "/app/data",
    "/home",
    "/var/lib/docker/volumes",
    "/tmp",
]


def _safe_path(path: str) -> Path:
    resolved = Path(os.path.normpath(path)).resolve()
    for base in ALLOWED_BASES:
        try:
            resolved.relative_to(base)
            return resolved
        except ValueError:
            continue
    raise PermissionError(f"Access denied: '{path}' is outside allowed directories")


def list_roots() -> list:
    """List available root directories the user can browse."""
    roots = []
    for base in ALLOWED_BASES:
        p = Path(base)
        if p.exists():
            roots.append({
                "name": base,
                "path": base,
                "type": "dir",
            })
    return roots


def list_dir(path: str) -> dict:
    p = _safe_path(path)
    if not p.exists():
        raise FileNotFoundError(f"'{path}' does not exist")
    if not p.is_dir():
        raise NotADirectoryError(f"'{path}' is not a directory")

    entries = []
    try:
        for item in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            try:
                stat = item.stat()
                entries.append({
                    "name": item.name,
                    "path": str(item),
                    "type": "dir" if item.is_dir() else "file",
                    "size": stat.st_size if item.is_file() else None,
                    "modified": stat.st_mtime,
                })
            except (PermissionError, OSError):
                pass
    except PermissionError:
        pass

    # Build breadcrumb
    parts = []
    current = p
    while True:
        parts.insert(0, {"name": current.name or str(current), "path": str(current)})
        parent = current.parent
        if str(current) == str(parent):
            break
        is_root = any(str(current) == base for base in ALLOWED_BASES)
        current = parent
        if is_root:
            break

    return {
        "path": str(p),
        "parent": str(p.parent) if not any(str(p) == b for b in ALLOWED_BASES) else None,
        "breadcrumb": parts,
        "entries": entries,
    }


def create_dir(path: str) -> dict:
    p = _safe_path(path)
    p.mkdir(parents=True, exist_ok=True)
    return {"created": str(p)}


def delete_path(path: str) -> dict:
    p = _safe_path(path)
    if not p.exists():
        raise FileNotFoundError(f"'{path}' does not exist")
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()
    return {"deleted": str(p)}


def rename_path(path: str, new_name: str) -> dict:
    if "/" in new_name or "\\" in new_name:
        raise ValueError("New name cannot contain path separators")
    p = _safe_path(path)
    if not p.exists():
        raise FileNotFoundError(f"'{path}' does not exist")
    new_path = p.parent / new_name
    _safe_path(str(new_path))  # validate destination
    p.rename(new_path)
    return {"renamed": str(new_path)}


def read_file(path: str, max_bytes: int = 512 * 1024) -> dict:
    p = _safe_path(path)
    if not p.is_file():
        raise IsADirectoryError(f"'{path}' is not a file")
    size = p.stat().st_size
    truncated = size > max_bytes
    content = p.read_bytes()[:max_bytes].decode("utf-8", errors="replace")
    return {"path": str(p), "content": content, "size": size, "truncated": truncated}


def write_file(path: str, content: bytes) -> dict:
    p = _safe_path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(content)
    return {"written": str(p), "size": len(content)}


def copy_path(src: str, dest_dir: str) -> dict:
    s = _safe_path(src)
    d = _safe_path(dest_dir)
    if not s.exists():
        raise FileNotFoundError(f"'{src}' does not exist")
    dest = d / s.name
    _safe_path(str(dest))
    if s.is_dir():
        shutil.copytree(str(s), str(dest))
    else:
        shutil.copy2(str(s), str(dest))
    return {"copied": str(dest)}


def move_path(src: str, dest_dir: str) -> dict:
    s = _safe_path(src)
    d = _safe_path(dest_dir)
    if not s.exists():
        raise FileNotFoundError(f"'{src}' does not exist")
    dest = d / s.name
    _safe_path(str(dest))
    shutil.move(str(s), str(dest))
    return {"moved": str(dest)}

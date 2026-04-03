import subprocess
import docker
import psutil


def get_disks() -> list:
    seen_devices = set()
    disks = []
    # Prefer real mounts (/mnt, /media, /) over bind-mounted duplicates
    priority_order = ["/", "/mnt", "/media", "/home"]
    partitions = sorted(
        psutil.disk_partitions(all=False),
        key=lambda p: next((i for i, prefix in enumerate(priority_order) if p.mountpoint.startswith(prefix)), 99)
    )
    for part in partitions:
        # Skip pseudo filesystems
        if part.fstype in ("tmpfs", "devtmpfs", "devfs", "squashfs", "overlay", ""):
            continue
        # Deduplicate by device
        if part.device in seen_devices:
            continue
        seen_devices.add(part.device)
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": round(usage.percent, 1),
            })
        except (PermissionError, OSError):
            pass

    # Remove mountpoints that are parents of other mountpoints —
    # e.g. drop /mnt if /mnt/storage is also listed (browsing /mnt only shows the child mount)
    mountpoints = {d["mountpoint"] for d in disks}
    disks = [
        d for d in disks
        if not any(
            m != d["mountpoint"] and m.startswith(d["mountpoint"].rstrip("/") + "/")
            for m in mountpoints
        )
    ]

    return disks


def get_docker_volumes() -> list:
    try:
        client = docker.DockerClient(base_url="unix:///var/run/docker.sock")
        volumes = []
        for v in client.volumes.list():
            vol = {
                "name": v.name,
                "driver": v.attrs.get("Driver", "local"),
                "mountpoint": v.attrs.get("Mountpoint", ""),
                "created": v.attrs.get("CreatedAt", ""),
                "labels": v.attrs.get("Labels") or {},
                "size": None,
            }
            mountpoint = v.attrs.get("Mountpoint", "")
            if mountpoint:
                try:
                    r = subprocess.run(
                        ["du", "-sb", mountpoint],
                        capture_output=True, text=True, timeout=5,
                    )
                    if r.returncode == 0:
                        vol["size"] = int(r.stdout.split()[0])
                except Exception:
                    pass
            volumes.append(vol)
        return volumes
    except Exception as e:
        print(f"[StorageService] volumes error: {e}")
        return []


def get_storage_info() -> dict:
    return {
        "disks": get_disks(),
        "volumes": get_docker_volumes(),
    }

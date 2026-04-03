import subprocess
import docker
import psutil


def get_disks() -> list:
    SKIP_FS = {"tmpfs", "devtmpfs", "devfs", "squashfs", "overlay", "vfat", ""}
    SKIP_MP = {"/mnt", "/media", "/home"}  # bare parents with no real content

    # /host first (Pi root), then /mnt/* and /media/* direct mounts, skip /host/* submounts
    def priority(mp):
        if mp == "/host":           return 0
        if mp.startswith("/mnt/"):  return 1
        if mp.startswith("/media/"): return 2
        if mp.startswith("/host/"): return 99  # duplicate of a direct mount
        return 50

    partitions = sorted(psutil.disk_partitions(all=False), key=lambda p: priority(p.mountpoint))

    seen_devices = set()
    disks = []
    for part in partitions:
        mp = part.mountpoint
        if part.fstype in SKIP_FS:
            continue
        if mp in SKIP_MP or priority(mp) == 99:
            continue
        if part.device in seen_devices:
            continue
        seen_devices.add(part.device)
        try:
            usage = psutil.disk_usage(mp)
            disks.append({
                "device": part.device,
                "mountpoint": mp,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": round(usage.percent, 1),
            })
        except (PermissionError, OSError):
            pass
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

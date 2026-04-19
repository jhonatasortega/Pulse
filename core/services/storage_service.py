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


def get_available_disks() -> list:
    """Find block devices with a filesystem but no mountpoint using lsblk and blkid."""
    try:
        import json
        r = subprocess.run(
            ["nsenter", "-t", "1", "-m", "lsblk", "-J", "-o", "NAME,FSTYPE,LABEL,UUID,FSAVAIL,FSSIZE,MOUNTPOINT,SIZE,TYPE"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode != 0:
            return []
        
        data = json.loads(r.stdout)
        available = []

        def get_blkid_info(device):
            try:
                # blkid -o export is easy to parse
                br = subprocess.run(["blkid", "-o", "export", device], capture_output=True, text=True, timeout=2)
                if br.returncode != 0: return {}
                info = {}
                for line in br.stdout.splitlines():
                    if "=" in line:
                        k, v = line.split("=", 1)
                        info[k.lower()] = v
                return info
            except: return {}

        def walk(devices):
            for dev in devices:
                # We want partitions/disks that aren't mounted
                if not dev.get("mountpoint") and dev.get("type") in ["part", "disk"]:
                    name = dev.get("name")
                    device_path = f"/dev/{name}"
                    
                    # LSBLK might miss fstype/uuid in containers, probe with blkid
                    info = get_blkid_info(device_path)
                    fstype = dev.get("fstype") or info.get("type")
                    
                    # Only include if it has a filesystem (formatted)
                    if fstype and fstype not in ["swap"]:
                        available.append({
                            "name": name,
                            "label": dev.get("label") or info.get("label") or name,
                            "device": device_path,
                            "fstype": fstype,
                            "uuid": dev.get("uuid") or info.get("uuid"),
                            "size": dev.get("size"),
                        })
                
                if "children" in dev:
                    walk(dev["children"])

        walk(data.get("blockdevices", []))
        return available
    except Exception as e:
        print(f"[StorageService] available disks error: {e}")
        return []


def get_storage_info() -> dict:
    return {
        "disks": get_disks(),
        "volumes": get_docker_volumes(),
        "available": get_available_disks(),
    }

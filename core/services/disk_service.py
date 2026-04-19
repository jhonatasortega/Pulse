import os
import subprocess
from pathlib import Path

FSTAB_PATH = "/host/etc/fstab"

def mount_disk(uuid: str, mountpoint: str, fstype: str) -> dict:
    """
    Mount a disk by UUID and make it persistent in /etc/fstab.
    Uses nsenter to execute commands in the host's mount namespace.
    """
    # 1. Prepare mountpoint on host via nsenter
    try:
        subprocess.run(["nsenter", "-t", "1", "-m", "mkdir", "-p", mountpoint], check=True)
    except Exception as e:
        raise Exception(f"Failed to create mountpoint on host: {e}")

    # 2. Add to host's fstab
    if os.path.exists(FSTAB_PATH):
        with open(FSTAB_PATH, "r") as f:
            fstab = f.read()
        if uuid not in fstab:
            entry = f"\nUUID={uuid}  {mountpoint}  {fstype}  defaults,nofail  0  2\n"
            with open(FSTAB_PATH, "a") as f:
                f.write(entry)

    # 3. Mount on host via nsenter
    # We try mount -a first, fallback to specific mount
    try:
        r = subprocess.run(["nsenter", "-t", "1", "-m", "mount", "-a"], capture_output=True, text=True)
        if r.returncode != 0:
            r2 = subprocess.run(["nsenter", "-t", "1", "-m", "mount", "-U", uuid, mountpoint], capture_output=True, text=True)
            if r2.returncode != 0:
                raise Exception(f"Mount on host failed: {r2.stderr or r2.stdout}")
    except Exception as e:
        raise Exception(f"Execution error on host: {e}")

    return {"ok": True, "mountpoint": mountpoint}


def unmount_disk(mountpoint: str) -> dict:
    """
    Unmount a disk and remove from fstab on host.
    """
    # 1. Unmount on host
    try:
        subprocess.run(["nsenter", "-t", "1", "-m", "umount", "-l", mountpoint], capture_output=False)
    except Exception:
        pass

    # 2. Remove from fstab
    if os.path.exists(FSTAB_PATH):
        with open(FSTAB_PATH, "r") as f:
            lines = f.readlines()
        
        new_lines = [l for l in lines if mountpoint not in l]
        
        with open(FSTAB_PATH, "w") as f:
            f.writelines(new_lines)

    return {"ok": True}

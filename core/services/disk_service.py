import os
import subprocess
from pathlib import Path

FSTAB_PATH = "/host/etc/fstab"

def mount_disk(uuid: str, mountpoint: str, fstype: str) -> dict:
    """
    Mount a disk by UUID and make it persistent in /etc/fstab.
    """
    # 1. Prepare mountpoint on host
    host_mp = Path("/host") / mountpoint.lstrip("/")
    try:
        host_mp.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise Exception(f"Failed to create mountpoint directory: {e}")

    # 2. Check if already in fstab to avoid duplicates
    if os.path.exists(FSTAB_PATH):
        with open(FSTAB_PATH, "r") as f:
            fstab = f.read()
        if uuid in fstab:
            # Already in fstab, just try to mount
            pass
        else:
            # Add to fstab
            entry = f"\nUUID={uuid}  {mountpoint}  {fstype}  defaults,nofail  0  2\n"
            with open(FSTAB_PATH, "a") as f:
                f.write(entry)

    # 3. Mount it
    # We use 'mount -a' to mount everything in fstab, which is safer
    try:
        r = subprocess.run(["mount", "-a"], capture_output=True, text=True)
        if r.returncode != 0:
            # If mount -a fails, try specific mount
            r2 = subprocess.run(["mount", f"UUID={uuid}", mountpoint], capture_output=True, text=True)
            if r2.returncode != 0:
                raise Exception(f"Mount failed: {r2.stderr or r2.stdout}")
    except Exception as e:
        raise Exception(f"Execution error: {e}")

    return {"ok": True, "mountpoint": mountpoint}


def unmount_disk(mountpoint: str) -> dict:
    """
    Unmount a disk and remove from fstab.
    """
    # 1. Unmount
    try:
        r = subprocess.run(["umount", "-l", mountpoint], capture_output=True, text=True)
        # Even if it fails (already unmounted), we proceed to cleanup fstab
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

"""
WebSocket terminal — spawns a PTY bash shell.
Uses subprocess + pty.openpty() (no os.fork) for asyncio compatibility.
Linux only (ARM64 / Raspberry Pi).
"""
import asyncio
import fcntl
import os
import pty
import struct
import subprocess
import termios
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

SHELL = os.getenv("SHELL", "/bin/bash")


@router.websocket("/ws")
async def terminal_ws(websocket: WebSocket):
    await websocket.accept()

    # Create PTY pair
    try:
        master_fd, slave_fd = pty.openpty()
    except Exception as e:
        await websocket.send_text(f"\r\n\x1b[31m[Terminal] PTY unavailable: {e}\x1b[0m\r\n")
        await websocket.close()
        return

    # Spawn shell using the slave side as stdin/stdout/stderr
    try:
        proc = subprocess.Popen(
            [SHELL, "--login"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
            env={**os.environ, "TERM": "xterm-256color"},
        )
    except Exception as e:
        os.close(master_fd)
        os.close(slave_fd)
        await websocket.send_text(f"\r\n\x1b[31m[Terminal] Failed to start shell: {e}\x1b[0m\r\n")
        await websocket.close()
        return

    # Slave fd is no longer needed in the parent process
    os.close(slave_fd)

    # Make master non-blocking
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    loop = asyncio.get_event_loop()

    async def read_pty():
        while True:
            await asyncio.sleep(0.01)
            # Check if process is still alive
            if proc.poll() is not None:
                break
            try:
                data = os.read(master_fd, 8192)
                if data:
                    await websocket.send_bytes(data)
            except BlockingIOError:
                pass
            except OSError:
                break
        await websocket.send_text("\r\n\x1b[33m[Terminal] Sessão encerrada.\x1b[0m\r\n")

    reader = asyncio.create_task(read_pty())

    def set_winsize(cols: int, rows: int):
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
        except Exception:
            pass

    try:
        async for msg in websocket.iter_bytes():
            # Resize packet: first byte \x01 followed by JSON
            if msg[:1] == b'\x01':
                try:
                    info = json.loads(msg[1:])
                    if info.get("type") == "resize":
                        set_winsize(info.get("cols", 80), info.get("rows", 24))
                except Exception:
                    pass
            else:
                try:
                    os.write(master_fd, msg)
                except OSError:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        reader.cancel()
        try:
            proc.kill()
            proc.wait(timeout=2)
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass

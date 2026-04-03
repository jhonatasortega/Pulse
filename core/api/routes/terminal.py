"""
WebSocket terminal — spawns a PTY bash shell or docker exec into a container.
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


async def _run_pty_session(websocket: WebSocket, cmd: list):
    """Shared PTY session handler for both system shell and docker exec."""
    try:
        master_fd, slave_fd = pty.openpty()
    except Exception as e:
        await websocket.send_text(f"\r\n\x1b[31m[Terminal] PTY unavailable: {e}\x1b[0m\r\n")
        await websocket.close()
        return

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
            env={**os.environ, "TERM": "xterm-256color"},
        )
    except Exception as e:
        os.close(master_fd)
        os.close(slave_fd)
        await websocket.send_text(f"\r\n\x1b[31m[Terminal] Failed to start: {e}\x1b[0m\r\n")
        await websocket.close()
        return

    os.close(slave_fd)

    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    async def read_pty():
        while True:
            await asyncio.sleep(0.01)
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
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes"):
                try:
                    os.write(master_fd, msg["bytes"])
                except OSError:
                    break
            elif msg.get("text"):
                text = msg["text"]
                try:
                    info = json.loads(text)
                    if info.get("type") == "resize":
                        set_winsize(info.get("cols", 80), info.get("rows", 24))
                except json.JSONDecodeError:
                    try:
                        os.write(master_fd, text.encode())
                    except OSError:
                        break
    except (WebSocketDisconnect, Exception):
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


@router.websocket("/ws")
async def terminal_ws(websocket: WebSocket):
    await websocket.accept()
    await _run_pty_session(websocket, [SHELL, "--login"])


@router.websocket("/ws/{container_id}")
async def container_terminal_ws(websocket: WebSocket, container_id: str):
    """Open an interactive shell inside a running container via docker exec."""
    await websocket.accept()
    # Try bash first, fall back to sh
    cmd = ["docker", "exec", "-it", container_id, "sh", "-c",
           "bash 2>/dev/null || sh"]
    await _run_pty_session(websocket, cmd)

"""
WebSocket terminal — spawns a PTY shell inside the Pulse container.
Uses Python's stdlib `pty` module (Linux only).
"""
import asyncio
import os
import pty
import fcntl
import termios
import struct
import signal
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def terminal_ws(websocket: WebSocket):
    await websocket.accept()

    # Create a PTY master/slave pair
    master_fd, slave_fd = pty.openpty()

    # Spawn /bin/bash inside the PTY
    pid = os.fork()
    if pid == 0:
        # Child: become the PTY slave
        os.setsid()
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(master_fd)
        os.close(slave_fd)
        os.execvp("/bin/bash", ["/bin/bash", "--login"])
        os._exit(1)

    # Parent: relay between WebSocket and PTY master
    os.close(slave_fd)

    # Set non-blocking on master
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    loop = asyncio.get_event_loop()

    async def read_pty():
        """Read PTY output and send to WebSocket."""
        while True:
            await asyncio.sleep(0.01)
            try:
                data = os.read(master_fd, 4096)
                if data:
                    await websocket.send_bytes(data)
            except BlockingIOError:
                pass
            except OSError:
                break

    reader_task = asyncio.create_task(read_pty())

    try:
        while True:
            msg = await websocket.receive()
            if "bytes" in msg:
                data = msg["bytes"]
                # Resize message: {"type":"resize","cols":80,"rows":24}
                if data[:1] == b'\x01':
                    import json
                    try:
                        info = json.loads(data[1:])
                        if info.get("type") == "resize":
                            cols = info.get("cols", 80)
                            rows = info.get("rows", 24)
                            winsize = struct.pack("HHHH", rows, cols, 0, 0)
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                    except Exception:
                        pass
                else:
                    os.write(master_fd, data)
            elif "text" in msg:
                import json
                try:
                    info = json.loads(msg["text"])
                    if info.get("type") == "resize":
                        cols = info.get("cols", 80)
                        rows = info.get("rows", 24)
                        winsize = struct.pack("HHHH", rows, cols, 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                except Exception:
                    os.write(master_fd, msg["text"].encode())
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        reader_task.cancel()
        try:
            os.kill(pid, signal.SIGKILL)
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass
        try:
            os.waitpid(pid, 0)
        except Exception:
            pass

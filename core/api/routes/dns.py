import subprocess
from fastapi import APIRouter, HTTPException

router = APIRouter()

DNSMASQ_CONF = """\
# Pulse DNS — serve /etc/hosts entries to the whole local network
addn-hosts=/etc/hosts
domain-needed
bogus-priv
local=/local/
expand-hosts
"""


def _host(cmd: str, timeout: int = 90) -> tuple[int, str]:
    """Run a command on the Pi host via nsenter (requires pid: host in docker-compose)."""
    try:
        r = subprocess.run(
            ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid",
             "--", "bash", "-c", cmd],
            capture_output=True, text=True, timeout=timeout
        )
        return r.returncode, (r.stdout + r.stderr).strip()
    except FileNotFoundError:
        raise HTTPException(500, "nsenter não encontrado — certifique-se de que o container usa pid: host")
    except subprocess.TimeoutExpired:
        raise HTTPException(500, "Tempo esgotado")


@router.get("/status")
def dns_status():
    _, out = _host("which dnsmasq 2>/dev/null && echo INSTALLED || echo NOT_INSTALLED")
    installed = "INSTALLED" in out

    _, out2 = _host("systemctl is-active dnsmasq 2>/dev/null || echo inactive")
    running = out2.strip() == "active"

    _, out3 = _host("grep -q 'addn-hosts=/etc/hosts' /etc/dnsmasq.conf 2>/dev/null && echo YES || echo NO")
    configured = "YES" in out3

    return {"installed": installed, "running": running, "configured": configured}


@router.post("/install")
def dns_install():
    rc, out = _host("DEBIAN_FRONTEND=noninteractive apt-get install -y dnsmasq 2>&1", timeout=180)
    if rc != 0:
        raise HTTPException(500, out)
    return {"ok": True}


@router.post("/configure")
def dns_configure():
    conf = DNSMASQ_CONF.replace("'", "'\\''")
    rc, out = _host(f"printf '%s' '{conf}' > /etc/dnsmasq.conf && echo OK || echo FAIL")
    if rc != 0 or "FAIL" in out:
        raise HTTPException(500, out or "Falha ao escrever configuração")
    return {"ok": True}


@router.post("/enable")
def dns_enable():
    rc, out = _host("systemctl enable dnsmasq && systemctl restart dnsmasq 2>&1")
    if rc != 0:
        raise HTTPException(500, out)
    return {"ok": True}

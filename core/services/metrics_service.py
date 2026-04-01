import psutil
import docker
from . import docker_service


def get_system_metrics() -> dict:
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    temps = {}

    try:
        sensor_data = psutil.sensors_temperatures()
        if sensor_data:
            for name, entries in sensor_data.items():
                if entries:
                    temps[name] = round(entries[0].current, 1)
    except (AttributeError, Exception):
        pass

    return {
        "cpu": {
            "percent": cpu,
            "count": psutil.cpu_count(),
        },
        "memory": {
            "total": mem.total,
            "available": mem.available,
            "used": mem.used,
            "percent": mem.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        },
        "temperatures": temps,
    }


def get_container_stats(name_or_id: str) -> dict:
    client = docker_service.get_client()
    container = client.containers.get(name_or_id)
    stats = container.stats(stream=False)

    # CPU %
    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                stats["precpu_stats"]["cpu_usage"]["total_usage"]
    system_delta = stats["cpu_stats"].get("system_cpu_usage", 0) - \
                   stats["precpu_stats"].get("system_cpu_usage", 0)
    num_cpus = stats["cpu_stats"].get("online_cpus", 1)
    cpu_percent = (cpu_delta / system_delta * num_cpus * 100.0) if system_delta > 0 else 0.0

    # Memory
    mem_stats = stats.get("memory_stats", {})
    mem_used = mem_stats.get("usage", 0)
    mem_limit = mem_stats.get("limit", 1)

    return {
        "container": name_or_id,
        "cpu_percent": round(cpu_percent, 2),
        "memory": {
            "used": mem_used,
            "limit": mem_limit,
            "percent": round((mem_used / mem_limit) * 100, 2) if mem_limit else 0,
        },
        "networks": stats.get("networks", {}),
    }

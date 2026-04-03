import docker
import os
from typing import Optional

_client: docker.DockerClient | None = None


def get_client() -> docker.DockerClient:
    global _client
    if _client is None:
        _client = docker.DockerClient(base_url="unix:///var/run/docker.sock")
    try:
        _client.ping()
    except Exception:
        _client = docker.DockerClient(base_url="unix:///var/run/docker.sock")
    return _client


def serialize_container(c) -> dict:
    ports = {}
    if c.ports:
        for container_port, bindings in c.ports.items():
            if bindings:
                ports[container_port] = [b["HostPort"] for b in bindings]

    # Safely resolve image name — image may have been deleted from local store
    try:
        image_name = c.image.tags[0] if c.image.tags else c.image.short_id
    except Exception:
        image_name = c.attrs.get("Config", {}).get("Image", "unknown")

    return {
        "id": c.short_id,
        "full_id": c.id,
        "name": c.name,
        "image": image_name,
        "status": c.status,
        "state": c.attrs.get("State", {}),
        "ports": ports,
        "created": c.attrs.get("Created", ""),
        "labels": c.labels,
    }


def list_containers(all: bool = True) -> list:
    client = get_client()
    result = []
    for c in client.containers.list(all=all):
        try:
            result.append(serialize_container(c))
        except Exception as e:
            print(f"[DockerService] Skipping container {c.name}: {e}")
    return result


def get_container(name_or_id: str):
    client = get_client()
    return client.containers.get(name_or_id)


def start_container(name_or_id: str) -> dict:
    c = get_container(name_or_id)
    c.start()
    c.reload()
    return serialize_container(c)


def stop_container(name_or_id: str) -> dict:
    c = get_container(name_or_id)
    c.stop()
    c.reload()
    return serialize_container(c)


def restart_container(name_or_id: str) -> dict:
    c = get_container(name_or_id)
    c.restart()
    c.reload()
    return serialize_container(c)


def remove_container(name_or_id: str, force: bool = False) -> dict:
    c = get_container(name_or_id)
    name = c.name
    c.remove(force=force)
    return {"removed": name}


def get_logs(name_or_id: str, tail: int = 100) -> str:
    c = get_container(name_or_id)
    return c.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")


def get_container_config(name_or_id: str) -> dict:
    c = get_container(name_or_id)
    attrs = c.attrs

    raw_env = attrs.get("Config", {}).get("Env") or []
    env = {}
    for e in raw_env:
        if "=" in e:
            k, v = e.split("=", 1)
            env[k] = v

    port_bindings = attrs.get("HostConfig", {}).get("PortBindings") or {}
    ports = {}
    for container_port, bindings in port_bindings.items():
        if bindings:
            ports[container_port] = bindings[0]["HostPort"]

    restart = attrs.get("HostConfig", {}).get("RestartPolicy", {})
    binds = attrs.get("HostConfig", {}).get("Binds") or []

    return {
        "id": c.short_id,
        "name": c.name,
        "image": attrs.get("Config", {}).get("Image", ""),
        "env": env,
        "ports": ports,
        "restart_policy": restart.get("Name", "no"),
        "binds": binds,
    }


def recreate_container(name_or_id: str, new_env: dict, new_restart: str = None) -> dict:
    """Stop, remove, and recreate container with updated env/restart config."""
    c = get_container(name_or_id)
    attrs = c.attrs

    image = attrs.get("Config", {}).get("Image", "")
    name = c.name

    port_bindings = attrs.get("HostConfig", {}).get("PortBindings") or {}
    ports = {}
    for container_port, bindings in port_bindings.items():
        if bindings:
            try:
                ports[container_port] = int(bindings[0]["HostPort"])
            except (ValueError, KeyError):
                pass

    binds = attrs.get("HostConfig", {}).get("Binds") or []
    volumes = {}
    for bind in binds:
        parts = bind.split(":")
        if len(parts) >= 2:
            volumes[parts[0]] = {"bind": parts[1], "mode": parts[2] if len(parts) > 2 else "rw"}

    restart = new_restart or attrs.get("HostConfig", {}).get("RestartPolicy", {}).get("Name", "unless-stopped")
    labels = c.labels or {}

    c.stop(timeout=10)
    c.remove(force=True)

    client = get_client()
    run_kwargs = {
        "image": image,
        "name": name,
        "detach": True,
        "restart_policy": {"Name": restart},
        "environment": new_env,
        "labels": labels,
    }
    if ports:
        run_kwargs["ports"] = ports
    if volumes:
        run_kwargs["volumes"] = volumes

    container = client.containers.run(**run_kwargs)
    container.reload()
    return serialize_container(container)


def pull_image(image: str) -> dict:
    client = get_client()
    img = client.images.pull(image)
    return {"pulled": image, "id": img.short_id}


def run_container(config: dict) -> dict:
    client = get_client()

    run_kwargs = {
        "image": config["image"],
        "name": config.get("name"),
        "detach": True,
        "restart_policy": {"Name": config.get("restart", "unless-stopped")},
    }

    if config.get("ports"):
        run_kwargs["ports"] = config["ports"]

    if config.get("volumes"):
        run_kwargs["volumes"] = config["volumes"]

    if config.get("environment"):
        run_kwargs["environment"] = config["environment"]

    if config.get("network"):
        run_kwargs["network"] = config["network"]

    if config.get("labels"):
        run_kwargs["labels"] = config["labels"]

    container = client.containers.run(**run_kwargs)
    container.reload()
    return serialize_container(container)

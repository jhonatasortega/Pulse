from . import docker_service


def _group_containers(containers: list) -> list:
    groups: dict = {}
    ungrouped = []

    for c in containers:
        project = c.get("labels", {}).get("com.docker.compose.project")
        if project:
            if project not in groups:
                groups[project] = {
                    "id": project,
                    "name": project,
                    "source": "compose",
                    "containers": [],
                }
            groups[project]["containers"].append(c)
        else:
            ungrouped.append(c)

    for c in ungrouped:
        groups[c["name"]] = {
            "id": c["name"],
            "name": c["name"],
            "source": "standalone",
            "containers": [c],
        }

    result = []
    for g in groups.values():
        statuses = [c["status"] for c in g["containers"]]
        if all(s == "running" for s in statuses):
            g["status"] = "running"
        elif any(s == "running" for s in statuses):
            g["status"] = "partial"
        else:
            g["status"] = "stopped"

        ports: dict = {}
        icon_url = ""
        display_name = ""
        for c in g["containers"]:
            ports.update(c.get("ports", {}))
            labels = c.get("labels", {})
            if not icon_url:
                icon_url = labels.get("pulse.icon", "")
            if not display_name:
                display_name = labels.get("pulse.display_name", "")
        g["ports"] = ports
        g["icon_url"] = icon_url
        # Fallback: strip pulse_ prefix and prettify the container/group name
        if not display_name:
            raw = g["name"].removeprefix("pulse_").replace("-", " ").replace("_", " ").title()
            display_name = raw
        g["display_name"] = display_name

        result.append(g)

    result.sort(key=lambda g: (0 if g["status"] == "running" else 1 if g["status"] == "partial" else 2, g["name"]))
    return result


def list_groups() -> list:
    containers = docker_service.list_containers(all=True)
    groups = _group_containers(containers)

    # Add apps that are in "installing" or "error" state but don't have a container yet
    from . import app_service
    installed_apps = app_service.get_installed_apps()

    # Track container IDs and names already grouped
    grouped_container_ids = set()
    grouped_names = {g["name"] for g in groups}
    for g in groups:
        for c in g["containers"]:
            grouped_container_ids.add(c["id"])
            grouped_container_ids.add(c["full_id"])

    for app in installed_apps:
        app_id = app["id"]
        status = app.get("status")

        # Only add if it's in a transitional state or hasn't been grouped yet
        # We check both name and container_id to avoid duplicates
        if status in ("installing", "error"):
            # If there's already a container for it, it might still have 'installing' status
            # but we should check if we already have it.
            if app.get("name") in grouped_names or app.get("container_id") in grouped_container_ids:
                continue

            groups.append({
                "id": f"app_{app_id}",
                "name": app.get("container_name") or app["name"],
                "display_name": app["name"],
                "status": status,
                "icon_url": app.get("icon_url", ""),
                "source": "app",
                "containers": [], # No containers yet
                "ports": {},
                "is_pending": True,
                "error": app.get("error")
            })

    return groups


def group_action(project: str, action: str) -> dict:
    containers = docker_service.list_containers(all=True)
    groups = {g["id"]: g for g in _group_containers(containers)}

    if project not in groups:
        raise ValueError(f"Group '{project}' not found")

    group = groups[project]
    results = []
    for c in group["containers"]:
        try:
            if action == "start":
                r = docker_service.start_container(c["id"])
            elif action == "stop":
                r = docker_service.stop_container(c["id"])
            elif action == "restart":
                r = docker_service.restart_container(c["id"])
            else:
                raise ValueError(f"Unknown action: {action}")
            results.append({"container": c["name"], "status": r["status"]})
        except Exception as e:
            results.append({"container": c["name"], "error": str(e)})

    return {"group": project, "action": action, "results": results}

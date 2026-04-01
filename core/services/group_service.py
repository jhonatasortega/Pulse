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
        for c in g["containers"]:
            ports.update(c.get("ports", {}))
        g["ports"] = ports

        result.append(g)

    result.sort(key=lambda g: (0 if g["status"] == "running" else 1 if g["status"] == "partial" else 2, g["name"]))
    return result


def list_groups() -> list:
    containers = docker_service.list_containers(all=True)
    return _group_containers(containers)


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

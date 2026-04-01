"""
Agent Dispatcher — maps (agent_id, action, params) to concrete service calls.

Each agent has a defined set of allowed actions. This enforces the agent's
declared responsibilities and tools, and provides the foundation for future
AI-driven automation.
"""
from typing import Any
from . import docker_service, app_service, metrics_service

# Map: agent_id -> set of allowed action names
AGENT_PERMISSIONS: dict[str, set] = {
    "orquestrador": {
        "list_containers", "start_container", "stop_container", "restart_container",
        "container_logs", "list_templates", "list_installed", "install_app",
        "uninstall_app", "update_app", "reconfigure_app",
        "system_metrics", "container_stats",
    },
    "devops": {
        "list_containers", "start_container", "stop_container", "restart_container",
        "list_templates", "list_installed", "install_app", "uninstall_app",
        "update_app", "reconfigure_app", "system_metrics",
    },
    "docker": {
        "list_containers", "start_container", "stop_container", "restart_container",
        "container_logs", "container_stats",
    },
    "monitoramento": {
        "list_containers", "system_metrics", "container_stats", "container_logs",
    },
}

# Action registry — maps action name -> callable(params) -> result
def _action_registry() -> dict[str, Any]:
    return {
        "list_containers": lambda p: docker_service.list_containers(all=p.get("all", True)),
        "start_container": lambda p: docker_service.start_container(p["id"]),
        "stop_container": lambda p: docker_service.stop_container(p["id"]),
        "restart_container": lambda p: docker_service.restart_container(p["id"]),
        "container_logs": lambda p: docker_service.get_logs(p["id"], tail=p.get("tail", 100)),
        "container_stats": lambda p: metrics_service.get_container_stats(p["id"]),
        "system_metrics": lambda p: metrics_service.get_system_metrics(),
        "list_templates": lambda p: app_service.list_templates(),
        "list_installed": lambda p: app_service.get_installed_apps(),
        "install_app": lambda p: app_service.install_app(p["app_id"], p.get("env_overrides", {})),
        "uninstall_app": lambda p: app_service.uninstall_app(p["app_id"], p.get("remove_data", False)),
        "update_app": lambda p: app_service.update_app(p["app_id"]),
        "reconfigure_app": lambda p: app_service.reconfigure_app(p["app_id"], p["env"]),
    }


class AgentDispatcher:
    def dispatch(self, agent_id: str, action: str, params: dict = None) -> dict:
        params = params or {}
        agent_id = agent_id.lower()

        allowed = AGENT_PERMISSIONS.get(agent_id)
        if allowed is None:
            raise ValueError(f"Unknown agent: '{agent_id}'")

        if action not in allowed:
            raise PermissionError(
                f"Agent '{agent_id}' is not allowed to perform '{action}'. "
                f"Allowed: {sorted(allowed)}"
            )

        registry = _action_registry()
        fn = registry.get(action)
        if fn is None:
            raise ValueError(f"Action '{action}' is not implemented")

        result = fn(params)
        return {
            "agent": agent_id,
            "action": action,
            "params": params,
            "result": result,
        }

    def list_actions(self, agent_id: str) -> list[str]:
        agent_id = agent_id.lower()
        allowed = AGENT_PERMISSIONS.get(agent_id)
        if allowed is None:
            raise ValueError(f"Unknown agent: '{agent_id}'")
        return sorted(allowed)


dispatcher = AgentDispatcher()

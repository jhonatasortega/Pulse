from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from agents_loader.loader import AgentLoader
from services.agent_dispatcher import dispatcher, AGENT_PERMISSIONS

router = APIRouter()
_loader = AgentLoader(agents_dir="/app/agents")


def get_loader() -> AgentLoader:
    if not _loader.agents:
        _loader.load_all()
    return _loader


class DispatchRequest(BaseModel):
    action: str
    params: Optional[dict] = {}


@router.get("/")
def list_agents():
    loader = get_loader()
    return [
        {
            "id": a["id"],
            "name": a["name"],
            "function": a.get("function", ""),
            "responsibilities": a.get("responsibilities", []),
            "allowed_actions": sorted(AGENT_PERMISSIONS.get(a["id"], set())),
        }
        for a in loader.agents.values()
    ]


@router.get("/{agent_id}")
def get_agent(agent_id: str):
    loader = get_loader()
    agent = loader.get(agent_id)
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    agent["allowed_actions"] = sorted(AGENT_PERMISSIONS.get(agent_id, set()))
    return agent


@router.get("/{agent_id}/actions")
def list_agent_actions(agent_id: str):
    try:
        actions = dispatcher.list_actions(agent_id)
        return {"agent": agent_id, "actions": actions}
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/{agent_id}/dispatch")
def dispatch_action(agent_id: str, req: DispatchRequest):
    try:
        return dispatcher.dispatch(agent_id, req.action, req.params)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/reload")
def reload_agents():
    loader = get_loader()
    loader.load_all()
    return {"reloaded": len(loader.agents), "agents": list(loader.agents.keys())}

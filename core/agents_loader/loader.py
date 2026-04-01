import re
import os
from pathlib import Path
from typing import Optional


class AgentLoader:
    """
    Loads agent definitions from .md files.

    Expected format:
    # Agente: <Name>
    ## Função
    <text>
    ## Responsabilidades
    - item
    ## Ferramentas que pode usar
    - item
    ## Regras
    - item
    """

    def __init__(self, agents_dir: str):
        self.agents_dir = Path(agents_dir)
        self.agents: dict = {}

    def load_all(self):
        self.agents = {}
        if not self.agents_dir.exists():
            print(f"[AgentLoader] Directory not found: {self.agents_dir}")
            return

        for md_file in self.agents_dir.glob("*.md"):
            try:
                agent = self._parse(md_file)
                self.agents[agent["id"]] = agent
                print(f"[AgentLoader] Loaded agent: {agent['name']}")
            except Exception as e:
                print(f"[AgentLoader] Failed to parse {md_file.name}: {e}")

    def get(self, agent_id: str) -> Optional[dict]:
        return self.agents.get(agent_id)

    def _parse(self, path: Path) -> dict:
        content = path.read_text(encoding="utf-8")
        agent_id = path.stem.lower().replace(" ", "_")

        name = self._extract_h1(content) or path.stem
        function = self._extract_section(content, "Função")
        responsibilities = self._extract_list(content, "Responsabilidades")
        tools = self._extract_list(content, "Ferramentas que pode usar")
        rules = self._extract_list(content, "Regras")
        raw_sections = self._extract_all_sections(content)

        return {
            "id": agent_id,
            "name": name,
            "file": str(path),
            "function": function,
            "responsibilities": responsibilities,
            "tools": tools,
            "rules": rules,
            "sections": raw_sections,
            "raw": content,
        }

    def _extract_h1(self, content: str) -> Optional[str]:
        m = re.search(r"^#\s+(?:Agente:\s*)?(.+)$", content, re.MULTILINE)
        return m.group(1).strip() if m else None

    def _extract_section(self, content: str, section: str) -> str:
        pattern = rf"##\s+{re.escape(section)}\s*\n([\s\S]*?)(?=\n##|\Z)"
        m = re.search(pattern, content)
        if not m:
            return ""
        return m.group(1).strip()

    def _extract_list(self, content: str, section: str) -> list:
        text = self._extract_section(content, section)
        items = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("- "):
                items.append(line[2:].strip())
        return items

    def _extract_all_sections(self, content: str) -> dict:
        sections = {}
        parts = re.split(r"^##\s+", content, flags=re.MULTILINE)
        for part in parts[1:]:
            lines = part.strip().splitlines()
            if lines:
                title = lines[0].strip()
                body = "\n".join(lines[1:]).strip()
                sections[title] = body
        return sections

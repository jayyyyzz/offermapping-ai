from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


ONTOLOGY_PATH = Path(__file__).resolve().parent / "ontology" / "ai_app_dev_v1.json"


@lru_cache(maxsize=1)
def load_ontology() -> dict[str, Any]:
    return json.loads(ONTOLOGY_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def alias_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for skill in load_ontology()["skills"]:
        key = str(skill["key"]).strip().lower()
        mapping[key] = key
        for alias in skill.get("aliases", []):
            mapping[str(alias).strip().lower()] = key
    return mapping


def canonicalize_skill_key(value: str) -> str:
    key = value.strip().lower()
    return alias_map().get(key, key)


def canonical_skill_keys() -> set[str]:
    return {str(skill["key"]) for skill in load_ontology()["skills"]}


def ontology_prompt_block() -> str:
    lines = ["key 必须优先使用以下 canonical key："]
    for skill in load_ontology()["skills"]:
        lines.append(f"- {skill['key']}: {skill['name']}")
    lines.append("只有当岗位明确要求的能力不在列表中时，才能创建新的 snake_case key。")
    return "\n".join(lines)


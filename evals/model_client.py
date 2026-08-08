from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


ROOT = Path(__file__).resolve().parents[1]


def load_local_env(path: Path = ROOT / ".env") -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_registry(path: Path | None = None) -> dict[str, dict[str, str]]:
    load_local_env()
    registry_path = path or Path(os.getenv("MODEL_REGISTRY_PATH", ROOT / "backend" / "models.json"))
    if not registry_path.is_absolute():
        registry_path = ROOT / registry_path
    return json.loads(registry_path.read_text(encoding="utf-8"))


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start < 0 or end <= start:
            raise
        value = json.loads(cleaned[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("model response is not a JSON object")
    return value


@dataclass(frozen=True)
class ModelProfile:
    name: str
    provider: str
    base_url: str
    api_key_env: str
    model: str

    @property
    def api_key(self) -> str:
        return os.getenv(self.api_key_env, "")


def get_profiles(names: list[str] | None = None) -> list[ModelProfile]:
    registry = load_registry()
    selected = names or list(registry)
    profiles: list[ModelProfile] = []
    for name in selected:
        raw = registry.get(name)
        if not raw:
            raise KeyError(f"unknown model profile: {name}")
        profile = ModelProfile(
            name=name,
            provider=str(raw.get("provider") or "unknown"),
            base_url=str(raw.get("base_url") or "").rstrip("/"),
            api_key_env=str(raw.get("api_key_env") or ""),
            model=str(raw.get("model") or ""),
        )
        if not profile.base_url or not profile.model or not profile.api_key:
            raise ValueError(f"profile {name} is not fully configured")
        profiles.append(profile)
    return profiles


async def call_json_model(
    client: httpx.AsyncClient,
    profile: ModelProfile,
    system: str,
    user: str,
    temperature: float = 0,
    max_tokens: int = 2500,
    retries: int = 1,
    retry_backoff_seconds: float = 1.5,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    payload: dict[str, Any] = {
        "model": profile.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    meta: dict[str, Any] = {
        "profile": profile.name,
        "provider": profile.provider,
        "model": profile.model,
        "latency_ms": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "schema_ok": False,
        "http_status": None,
        "attempts": 0,
        "error": None,
    }
    started = time.perf_counter()
    last_content = ""
    request_headers = {
        "Authorization": f"Bearer {profile.api_key}",
        "Content-Type": "application/json",
        "User-Agent": os.getenv("MODEL_USER_AGENT", "OfferMapping-Evals/0.2"),
    }
    for attempt in range(retries + 1):
        meta["attempts"] = attempt + 1
        request_payload = dict(payload)
        try:
            response = await client.post(
                f"{profile.base_url}/chat/completions",
                headers=request_headers,
                json=request_payload,
            )
            meta["http_status"] = response.status_code
            if response.status_code == 400 and "response_format" in request_payload:
                request_payload.pop("response_format", None)
                response = await client.post(
                    f"{profile.base_url}/chat/completions",
                    headers=request_headers,
                    json=request_payload,
                )
                meta["http_status"] = response.status_code
            if response.status_code in {429, 500, 502, 503, 504} and attempt < retries:
                await asyncio.sleep(retry_backoff_seconds * (2**attempt))
                continue
            if response.status_code >= 400:
                meta["http_error_excerpt"] = response.text[:2000]
            response.raise_for_status()
            raw = response.json()
            content = raw["choices"][0]["message"]["content"]
            last_content = content if isinstance(content, str) else str(content)
            result = parse_json_object(content)
            usage = raw.get("usage") or {}
            meta.update(
                latency_ms=round((time.perf_counter() - started) * 1000),
                input_tokens=int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0),
                output_tokens=int(usage.get("completion_tokens") or usage.get("output_tokens") or 0),
                schema_ok=True,
                error=None,
            )
            return result, meta
        except Exception as exc:
            meta.update(
                latency_ms=round((time.perf_counter() - started) * 1000),
                error=f"{type(exc).__name__}: {str(exc)[:180]}",
            )
            if last_content:
                meta["raw_response_excerpt"] = last_content[:12000]
            if attempt < retries:
                await asyncio.sleep(retry_backoff_seconds * (2**attempt))
                continue
    return None, meta

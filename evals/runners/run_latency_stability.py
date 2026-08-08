from __future__ import annotations

import argparse
import asyncio
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from evals.gates import validate_extractor_output
from evals.model_client import call_json_model, get_profiles
from evals.ontology import ontology_prompt_block
from evals.validate_smoke import load_cases


ROOT = Path(__file__).resolve().parents[2]


async def run(args: argparse.Namespace) -> Path:
    cases = {case["case_id"]: case for case in load_cases()}
    case = cases.get(args.case_id)
    if not case:
        raise ValueError(f"unknown Smoke case: {args.case_id}")
    profiles = get_profiles([args.profile])
    profile = profiles[0]
    prompt_path = ROOT / "evals" / "prompts" / f"{args.prompt_version}.txt"
    prompt = prompt_path.read_text(encoding="utf-8").replace("{{ONTOLOGY}}", ontology_prompt_block())
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_latency_stability")
    output_dir = ROOT / "evals" / "outputs" / run_id
    output_dir.mkdir(parents=True, exist_ok=False)
    rows: list[dict[str, Any]] = []
    user = f"<JD>\n{case['jd']}\n</JD>\n<RESUME>\n{case['resume']}\n</RESUME>"
    async with httpx.AsyncClient(timeout=150) as client:
        for repeat in range(1, args.repeats + 1):
            output, meta = await call_json_model(
                client,
                profile,
                prompt,
                user,
                temperature=0,
                max_tokens=1800,
            )
            row = {
                "repeat": repeat,
                "case_id": case["case_id"],
                "output": output or {},
                "gate_failures": validate_extractor_output(output or {}, case["jd"], case["resume"]),
                "meta": meta,
            }
            rows.append(row)
            print(
                f"[{profile.name}] repeat={repeat}/{args.repeats} "
                f"schema={meta['schema_ok']} gates={len(row['gate_failures'])} "
                f"latency_ms={meta['latency_ms']}",
                flush=True,
            )
    latencies = [int(row["meta"].get("latency_ms") or 0) for row in rows if row["meta"].get("schema_ok")]
    summary = {
        "case_id": case["case_id"],
        "profile": profile.name,
        "model": profile.model,
        "prompt_version": args.prompt_version,
        "repeats": args.repeats,
        "request_success_rate": round(len(latencies) / args.repeats, 4),
        "latency_ms": latencies,
        "min_latency_ms": min(latencies) if latencies else None,
        "median_latency_ms": round(statistics.median(latencies)) if latencies else None,
        "max_latency_ms": max(latencies) if latencies else None,
        "p95_latency_ms": max(latencies) if latencies else None,
        "gate_failure_count": sum(len(row["gate_failures"]) for row in rows),
        "schema_failure_count": args.repeats - len(latencies),
        "total_input_tokens": sum(int(row["meta"].get("input_tokens") or 0) for row in rows),
        "total_output_tokens": sum(int(row["meta"].get("output_tokens") or 0) for row in rows),
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(
            {
                "run_id": run_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "dataset": "smoke.jsonl",
                "case_id": case["case_id"],
                "synthetic": True,
                "prompt_version": args.prompt_version,
                "profile": profile.name,
                "model": profile.model,
                "repeats": args.repeats,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (output_dir / "raw.jsonl").write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )
    (output_dir / "metrics.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    report = "\n".join(
        [
            "# Extractor 延迟稳定性测试",
            "",
            f"> Case: `{case['case_id']}`（合成 Smoke 提示注入案例）  ",
            f"> Profile: `{profile.name}` / `{profile.model}`  ",
            f"> Prompt: `{args.prompt_version}`  ",
            f"> Repeats: `{args.repeats}`  ",
            "> 仅用于稳定性观察，不代表完整质量资格赛  ",
            "",
            "| 指标 | 结果 |",
            "|---|---:|",
            f"| 请求成功率 | {summary['request_success_rate']:.1%} |",
            f"| 延迟（ms） | {summary['latency_ms']} |",
            f"| 中位数 | {summary['median_latency_ms'] or 'n/a'} |",
            f"| 最大值 / P95 | {summary['p95_latency_ms'] or 'n/a'} |",
            f"| Schema 失败 | {summary['schema_failure_count']} |",
            f"| 门禁失败 | {summary['gate_failure_count']} |",
            "",
            "结论：需要结合完整 Dev 资格赛和更多重复次数再决定线上超时阈值。",
        ]
    )
    (output_dir / "report.md").write_text(report, encoding="utf-8")
    print(f"OUTPUT_DIR={output_dir}", flush=True)
    return output_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run repeated latency stability checks for one Smoke case.")
    parser.add_argument("--case-id", default="ai_app_dev_boundary_injection_011")
    parser.add_argument("--profile", default="codex-gateway")
    parser.add_argument("--prompt-version", choices=["extractor_v3", "extractor_v4", "extractor_v5"], default="extractor_v5")
    parser.add_argument("--repeats", type=int, default=3)
    return parser.parse_args()


def main() -> int:
    asyncio.run(run(parse_args()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

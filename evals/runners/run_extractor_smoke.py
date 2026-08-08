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
from evals.metrics.extraction import score_extractor_cases
from evals.model_client import ModelProfile, call_json_model, get_profiles
from evals.ontology import ontology_prompt_block
from evals.validate_smoke import load_cases


ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = ROOT / "evals" / "prompts" / "extractor_v3.txt"
DEFAULT_PROFILES = ["deepseek-eval", "qwen-eval", "claude-gateway", "codex-gateway"]


async def run_profile(
    profile: ModelProfile,
    cases: list[dict[str, Any]],
    prompt: str,
    output_dir: Path,
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    outputs: list[dict[str, Any]] = []
    checkpoint_path = output_dir / f"{profile.name}.raw.jsonl"
    with checkpoint_path.open("w", encoding="utf-8") as checkpoint:
        async with httpx.AsyncClient(timeout=90) as client:
            for index, case in enumerate(cases, 1):
                user = f"<JD>\n{case['jd']}\n</JD>\n<RESUME>\n{case['resume']}\n</RESUME>"
                result, meta = await call_json_model(
                    client,
                    profile,
                    prompt,
                    user,
                    temperature=0,
                    max_tokens=1800,
                )
                output = result or {}
                outputs.append(output)
                gate_failures = validate_extractor_output(output, case["jd"], case["resume"])
                row = {
                    "case_id": case["case_id"],
                    "case_type": case["case_type"],
                    "output": output,
                    "gate_failures": gate_failures,
                    "meta": meta,
                }
                rows.append(row)
                checkpoint.write(json.dumps(row, ensure_ascii=False) + "\n")
                checkpoint.flush()
                print(
                    f"[{profile.name}] {index}/{len(cases)} {case['case_id']} "
                    f"schema={meta['schema_ok']} gates={len(gate_failures)} "
                    f"latency_ms={meta['latency_ms']}",
                    flush=True,
                )

    scored = score_extractor_cases(cases, outputs)
    successful = [row for row in rows if row["meta"]["schema_ok"]]
    latencies = [row["meta"]["latency_ms"] for row in successful]
    total_input_tokens = sum(row["meta"]["input_tokens"] for row in rows)
    total_output_tokens = sum(row["meta"]["output_tokens"] for row in rows)
    summary = dict(scored["summary"])
    summary.update(
        request_success_rate=round(len(successful) / len(rows), 4),
        p50_latency_ms=round(statistics.median(latencies)) if latencies else None,
        p95_latency_ms=round(sorted(latencies)[max(0, round(0.95 * len(latencies)) - 1)]) if latencies else None,
        total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens,
    )
    result = {
        "profile": profile.name,
        "provider": profile.provider,
        "model": profile.model,
        "summary": summary,
        "error_types": scored["error_types"],
        "cases": scored["cases"],
        "raw": rows,
    }
    (output_dir / f"{profile.name}.metrics.json").write_text(
        json.dumps({key: value for key, value in result.items() if key != "raw"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return result


def markdown_report(run_id: str, results: list[dict[str, Any]], case_count: int) -> str:
    lines = [
        "# OfferMapping Extractor Smoke Qualification",
        "",
        f"> Run ID: `{run_id}`  ",
        f"> Dataset: {case_count} synthetic Smoke cases  ",
        "> Prompt: `extractor_v3` + `ai_app_dev_v1` ontology  ",
        "",
        "## Summary",
        "",
        "| Profile | Model | Success | Skill F1 | Evidence accuracy | Overclaim | Job family | Quote traceability | P95 latency |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        s = result["summary"]
        lines.append(
            f"| {result['profile']} | {result['model']} | {s['request_success_rate']:.1%} | "
            f"{s['skill_f1']:.1%} | {s['evidence_accuracy_on_matched']:.1%} | "
            f"{s['evidence_overclaim_rate']:.1%} | {s['job_family_accuracy']:.1%} | "
            f"{s['quote_traceability']:.1%} | {s['p95_latency_ms'] or 'n/a'} ms |"
        )
    lines.extend(["", "## Gate failures and badcases", ""])
    for result in results:
        failed_cases = [
            case
            for case in result["cases"]
            if case["gate_failures"]
            or case["skill_fp"]
            or case["skill_fn"]
            or case["priority_mismatches"]
            or case["evidence_mismatches"]
            or not case["job_family_correct"]
        ]
        lines.append(f"### {result['profile']} — {result['model']}")
        lines.append("")
        lines.append(f"- Cases requiring review: {len(failed_cases)}/{len(result['cases'])}")
        lines.append(f"- Gate errors: `{json.dumps(result['error_types'], ensure_ascii=False)}`")
        for case in failed_cases:
            lines.append(
                f"- `{case['case_id']}`: family={case['job_family_correct']}, "
                f"extra={case['extra_skills']}, missed={case['missed_skills']}, gates={case['gate_failures']}"
                f", priority={case['priority_mismatches']}, evidence={case['evidence_mismatches']}"
            )
        lines.append("")
    return "\n".join(lines)


async def async_main(args: argparse.Namespace) -> Path:
    cases = load_cases()
    if args.case_type:
        cases = [case for case in cases if case["case_type"] == args.case_type]
    if args.case_ids:
        selected = set(args.case_ids)
        cases = [case for case in cases if case["case_id"] in selected]
    if not cases:
        raise ValueError("no cases selected")
    prompt = PROMPT_PATH.read_text(encoding="utf-8").replace("{{ONTOLOGY}}", ontology_prompt_block())
    profiles = get_profiles(args.profiles)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_extractor_smoke")
    output_dir = ROOT / "evals" / "outputs" / run_id
    output_dir.mkdir(parents=True, exist_ok=False)

    manifest = {
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset": "smoke.jsonl",
        "dataset_cases": len(cases),
        "synthetic": True,
        "prompt_version": "extractor_v3",
        "ontology_version": "ai_app_dev_v1",
        "temperature": 0,
        "profiles": [
            {"name": profile.name, "provider": profile.provider, "model": profile.model, "base_url": profile.base_url}
            for profile in profiles
        ],
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    results = await asyncio.gather(*(run_profile(profile, cases, prompt, output_dir) for profile in profiles))
    (output_dir / "metrics.json").write_text(
        json.dumps(
            [{key: value for key, value in result.items() if key != "raw"} for result in results],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    with (output_dir / "raw.jsonl").open("w", encoding="utf-8") as handle:
        for result in results:
            for row in result["raw"]:
                handle.write(
                    json.dumps({"profile": result["profile"], "model": result["model"], **row}, ensure_ascii=False)
                    + "\n"
                )
    (output_dir / "report.md").write_text(markdown_report(run_id, results, len(cases)), encoding="utf-8")
    print(f"OUTPUT_DIR={output_dir}", flush=True)
    return output_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run four-model Extractor Smoke qualification.")
    parser.add_argument("--profiles", nargs="+", default=DEFAULT_PROFILES)
    parser.add_argument("--case-type", choices=["realistic", "boundary"])
    parser.add_argument("--case-ids", nargs="+")
    return parser.parse_args()


def main() -> int:
    asyncio.run(async_main(parse_args()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

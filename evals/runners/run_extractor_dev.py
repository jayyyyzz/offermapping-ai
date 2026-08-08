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
from evals.validate_dev import load_cases


ROOT = Path(__file__).resolve().parents[2]
PROMPT_DIR = ROOT / "evals" / "prompts"
DEFAULT_PROFILES = ["qwen-eval", "claude-gateway", "codex-gateway"]


def p95(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, round(0.95 * len(ordered)) - 1)]


async def run_profile(
    profile: ModelProfile,
    cases: list[dict[str, Any]],
    prompt: str,
    output_dir: Path,
) -> dict[str, Any]:
    existing_rows: dict[str, dict[str, Any]] = {}
    checkpoint_path = output_dir / f"{profile.name}.raw.jsonl"
    if checkpoint_path.exists():
        for raw in checkpoint_path.read_text(encoding="utf-8").splitlines():
            if raw.strip():
                row = json.loads(raw)
                existing_rows[str(row["case_id"])] = row
    rows: list[dict[str, Any]] = []
    outputs: list[dict[str, Any]] = []
    with checkpoint_path.open("a", encoding="utf-8") as checkpoint:
        async with httpx.AsyncClient(timeout=120) as client:
            for index, case in enumerate(cases, 1):
                if case["case_id"] in existing_rows:
                    row = existing_rows[case["case_id"]]
                    rows.append(row)
                    outputs.append(row.get("output") or {})
                    print(
                        f"[{profile.name}] {index}/{len(cases)} {case['case_id']} resumed "
                        f"schema={row.get('meta', {}).get('schema_ok')} gates={len(row.get('gate_failures', []))}",
                        flush=True,
                    )
                    continue
                user = f"<JD>\n{case['jd']}\n</JD>\n<RESUME>\n{case['resume']}\n</RESUME>"
                output, meta = await call_json_model(
                    client,
                    profile,
                    prompt,
                    user,
                    temperature=0,
                    max_tokens=1800,
                )
                output = output or {}
                outputs.append(output)
                row = {
                    "case_id": case["case_id"],
                    "case_type": case["case_type"],
                    "output": output,
                    "gate_failures": validate_extractor_output(output, case["jd"], case["resume"]),
                    "meta": meta,
                }
                rows.append(row)
                checkpoint.write(json.dumps(row, ensure_ascii=False) + "\n")
                checkpoint.flush()
                print(
                    f"[{profile.name}] {index}/{len(cases)} {case['case_id']} "
                    f"schema={meta['schema_ok']} gates={len(row['gate_failures'])} "
                    f"latency_ms={meta['latency_ms']}",
                    flush=True,
                )

    scored = score_extractor_cases(cases, outputs)
    successful = [row for row in rows if row["meta"].get("schema_ok")]
    latencies = [int(row["meta"].get("latency_ms") or 0) for row in successful]
    boundary_cases = [
        item
        for item, case in zip(scored["cases"], cases, strict=True)
        if case["case_type"] == "boundary"
    ]
    boundary_clean = [
        item
        for item in boundary_cases
        if item["job_family_correct"]
        and not item["gate_failures"]
        and not item["skill_fp"]
        and not item["skill_fn"]
        and not item["priority_mismatches"]
        and not item["evidence_mismatches"]
    ]
    summary = dict(scored["summary"])
    summary.update(
        request_success_rate=round(len(successful) / len(rows), 4),
        p50_latency_ms=round(statistics.median(latencies)) if latencies else None,
        p95_latency_ms=p95(latencies),
        total_input_tokens=sum(int(row["meta"].get("input_tokens") or 0) for row in rows),
        total_output_tokens=sum(int(row["meta"].get("output_tokens") or 0) for row in rows),
        boundary_clean_rate=round(len(boundary_clean) / len(boundary_cases), 4) if boundary_cases else None,
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


def report(
    run_id: str,
    results: list[dict[str, Any]],
    case_count: int,
    selection: str,
    prompt_version: str,
) -> str:
    lines = [
        "# OfferMapping Extractor Dev Canary",
        "",
        f"> Run ID: `{run_id}`  ",
        f"> Dataset: `dev-v1.4` ({case_count} synthetic cases; selection: `{selection}`)  ",
        f"> Prompt: `{prompt_version}` + `ai_app_dev_v1` ontology  ",
        "> Status: exploratory canary; not a production or interview accuracy claim  ",
        "",
        "| Profile | Model | Success | Skill F1 | Evidence | Quote | Gates | Boundary clean | P95 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        summary = result["summary"]
        boundary_clean = (
            f"{summary['boundary_clean_rate']:.1%}"
            if summary["boundary_clean_rate"] is not None
            else "n/a"
        )
        lines.append(
            f"| {result['profile']} | {result['model']} | {summary['request_success_rate']:.1%} | "
            f"{summary['skill_f1']:.1%} | {summary['evidence_accuracy_on_matched']:.1%} | "
            f"{summary['quote_traceability']:.1%} | {summary['gate_failure_count']} | "
            f"{boundary_clean} | {summary['p95_latency_ms'] or 'n/a'} ms |"
        )
    lines.extend(["", "## Cases requiring review", ""])
    for result in results:
        lines.append(f"### {result['profile']} — {result['model']}")
        lines.append("")
        for case in result["cases"]:
            if (
                case["skill_fp"]
                or case["skill_fn"]
                or case["gate_failures"]
                or case["priority_mismatches"]
                or case["evidence_mismatches"]
                or not case["job_family_correct"]
            ):
                lines.append(
                    f"- `{case['case_id']}`: family={case['job_family_correct']}, "
                    f"extra={case['extra_skills']}, missed={case['missed_skills']}, "
                    f"gates={case['gate_failures']}, evidence={case['evidence_mismatches']}"
                )
        lines.append("")
    return "\n".join(lines)


async def async_main(args: argparse.Namespace) -> Path:
    cases = load_cases()
    selection = "all"
    if args.case_type:
        cases = [case for case in cases if case["case_type"] == args.case_type]
        selection = f"case_type={args.case_type}"
    if args.case_ids:
        selected = set(args.case_ids)
        cases = [case for case in cases if case["case_id"] in selected]
        selection = f"case_ids={','.join(args.case_ids)}"
    if not cases:
        raise ValueError("no cases selected")

    prompt_path = PROMPT_DIR / f"{args.prompt_version}.txt"
    prompt = prompt_path.read_text(encoding="utf-8").replace("{{ONTOLOGY}}", ontology_prompt_block())
    profiles = get_profiles(args.profiles)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_extractor_dev")
    if args.resume_dir:
        output_dir = args.resume_dir.resolve()
        if not output_dir.is_dir():
            raise ValueError(f"resume directory does not exist: {output_dir}")
        run_id = output_dir.name
        existing_manifest_path = output_dir / "manifest.json"
        if existing_manifest_path.exists():
            existing_manifest = json.loads(existing_manifest_path.read_text(encoding="utf-8"))
            existing_prompt = existing_manifest.get("prompt_version")
            if existing_prompt and existing_prompt != args.prompt_version:
                raise ValueError(
                    f"resume prompt mismatch: run uses {existing_prompt}, requested {args.prompt_version}"
                )
    else:
        output_dir = ROOT / "evals" / "outputs" / run_id
        output_dir.mkdir(parents=True, exist_ok=False)
    manifest = {
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset": "dev.jsonl",
        "dataset_version": "dev-v1.4",
        "dataset_cases": len(cases),
        "selection": selection,
        "synthetic": True,
        "annotation_status": "human_reviewed",
        "prompt_version": args.prompt_version,
        "ontology_version": "ai_app_dev_v1",
        "temperature": 0,
        "profiles": [
            {"name": profile.name, "provider": profile.provider, "model": profile.model, "base_url": profile.base_url}
            for profile in profiles
        ],
    }
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    results = await asyncio.gather(*(run_profile(profile, cases, prompt, output_dir) for profile in profiles))
    (output_dir / "metrics.json").write_text(
        json.dumps([{key: value for key, value in result.items() if key != "raw"} for result in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    with (output_dir / "raw.jsonl").open("w", encoding="utf-8") as raw_file:
        for result in results:
            for row in result["raw"]:
                raw_file.write(json.dumps({"profile": result["profile"], "model": result["model"], **row}, ensure_ascii=False) + "\n")
    (output_dir / "report.md").write_text(
        report(run_id, results, len(cases), selection, args.prompt_version),
        encoding="utf-8",
    )
    print(f"OUTPUT_DIR={output_dir}", flush=True)
    return output_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the three-model Extractor Dev canary.")
    parser.add_argument("--profiles", nargs="+", default=DEFAULT_PROFILES)
    parser.add_argument("--case-type", choices=["realistic", "boundary"])
    parser.add_argument("--case-ids", nargs="+")
    parser.add_argument("--resume-dir", type=Path)
    parser.add_argument("--prompt-version", choices=["extractor_v3", "extractor_v4", "extractor_v5"], default="extractor_v5")
    return parser.parse_args()


def main() -> int:
    asyncio.run(async_main(parse_args()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from backend.app import rank_projects, score_skills, select_focus_skill_keys
from evals.gates import iter_text_values, normalize_generator_output, validate_generator_output
from evals.model_client import ModelProfile, call_json_model, get_profiles
from evals.validate_dev import load_cases


ROOT = Path(__file__).resolve().parents[2]
PROMPT_DIR = ROOT / "evals" / "prompts"
DEFAULT_PROFILES = ["qwen-eval", "claude-gateway", "codex-gateway"]


def percentile_95(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, round(0.95 * len(ordered)) - 1)]


def prepare_case(case: dict[str, Any]) -> dict[str, Any]:
    """Build the exact Generator input used by the production backend."""
    parsed = case["gold"]
    score, _dimensions, _primary_gap = score_skills(parsed["skills"])
    candidates = rank_projects(parsed)[:8]
    allowed_skill_keys = {str(item["key"]) for item in parsed["skills"]}
    return {
        "score": score,
        "parsed": parsed,
        "background_assets": parsed["background_assets"],
        "allowed_skill_keys": sorted(allowed_skill_keys),
        "required_focus_skill_keys": select_focus_skill_keys(parsed["skills"]),
        "allowed_project_ids": [project["id"] for project in candidates],
        "allowed_projects": candidates,
    }


def score_case(case: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    output = row.get("output") or {}
    payload = row["input"]
    focus_keys = set(case["generation_expectations"]["required_focus_skill_keys"])
    used_gap_keys = {
        str(skill)
        for recommendation in output.get("recommendations", [])
        if isinstance(recommendation, dict)
        for skill in recommendation.get("matched_gaps", [])
    }
    covered_focus = focus_keys & used_gap_keys
    combined = "\n".join(iter_text_values(output))
    assets = [str(asset) for asset in payload["background_assets"]]
    failures = list(row.get("gate_failures") or [])
    project_failures = [
        failure
        for failure in failures
        if failure == "main_project_not_allowed" or failure.endswith(":project_not_allowed")
    ]
    schema_ok = bool(row.get("meta", {}).get("schema_ok"))
    return {
        "case_id": case["case_id"],
        "case_type": case["case_type"],
        "schema_ok": schema_ok,
        "shape_valid": not any(str(failure).startswith("schema_") for failure in failures),
        "gate_failures": failures,
        "gate_clean": schema_ok and not failures,
        "focus_keys": sorted(focus_keys),
        "covered_focus_keys": sorted(covered_focus),
        "missed_focus_keys": sorted(focus_keys - covered_focus),
        "focus_coverage": round(len(covered_focus) / len(focus_keys), 4) if focus_keys else 1.0,
        "focus_complete": focus_keys.issubset(used_gap_keys),
        "background_grounded": bool(assets) and any(asset in combined for asset in assets),
        "project_whitelist_compliant": not project_failures,
        "unsupported_metric": "unsupported_metric" in failures,
        "future_resume_template_compliant": "resume_line_not_future_template" not in failures,
        "latency_ms": row.get("meta", {}).get("latency_ms"),
    }


def summarize(rows: list[dict[str, Any]], scored_cases: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    successful_rows = [row for row in rows if row.get("meta", {}).get("schema_ok")]
    successful_scores = [item for item in scored_cases if item["schema_ok"]]
    latencies = [int(row["meta"].get("latency_ms") or 0) for row in successful_rows]
    denominator = len(successful_scores)
    focus_total = sum(len(item["focus_keys"]) for item in successful_scores)
    focus_covered = sum(len(item["covered_focus_keys"]) for item in successful_scores)

    def success_rate(field: str) -> float | None:
        if not denominator:
            return None
        return round(sum(bool(item[field]) for item in successful_scores) / denominator, 4)

    def overall_rate(field: str) -> float | None:
        if not total:
            return None
        return round(sum(bool(item[field]) for item in scored_cases) / total, 4)

    return {
        "case_count": total,
        "request_success_rate": round(len(successful_rows) / total, 4) if total else 0.0,
        "shape_valid_rate": overall_rate("shape_valid"),
        "gate_clean_rate": overall_rate("gate_clean"),
        "focus_coverage": round(focus_covered / focus_total, 4) if focus_total else None,
        "focus_complete_rate": success_rate("focus_complete"),
        "background_grounding_rate": success_rate("background_grounded"),
        "project_whitelist_compliance_rate": success_rate("project_whitelist_compliant"),
        "unsupported_metric_rate": (
            round(sum(item["unsupported_metric"] for item in successful_scores) / denominator, 4)
            if denominator
            else None
        ),
        "future_resume_template_compliance_rate": success_rate("future_resume_template_compliant"),
        "gate_failure_count": sum(len(item["gate_failures"]) for item in scored_cases),
        "p50_latency_ms": round(statistics.median(latencies)) if latencies else None,
        "p95_latency_ms": percentile_95(latencies),
        "total_input_tokens": sum(int(row.get("meta", {}).get("input_tokens") or 0) for row in rows),
        "total_output_tokens": sum(int(row.get("meta", {}).get("output_tokens") or 0) for row in rows),
    }


async def run_profile(
    profile: ModelProfile,
    cases: list[dict[str, Any]],
    prompt: str,
    output_dir: Path,
    temperature: float,
    retry_failures: bool,
    retries: int,
    retry_backoff_seconds: float,
) -> dict[str, Any]:
    checkpoint_path = output_dir / f"{profile.name}.raw.jsonl"
    existing: dict[str, dict[str, Any]] = {}
    if checkpoint_path.exists():
        for raw in checkpoint_path.read_text(encoding="utf-8").splitlines():
            if raw.strip():
                row = json.loads(raw)
                existing[str(row["case_id"])] = row

    rows: list[dict[str, Any]] = []
    with checkpoint_path.open("a", encoding="utf-8") as checkpoint:
        async with httpx.AsyncClient(timeout=180) as client:
            for index, case in enumerate(cases, 1):
                case_id = str(case["case_id"])
                if case_id in existing and (
                    existing[case_id].get("meta", {}).get("schema_ok") or not retry_failures
                ):
                    row = existing[case_id]
                    payload = row.get("input") or prepare_case(case)
                    row["input"] = payload
                    row["output"] = normalize_generator_output(row.get("output") or {})
                    row["gate_failures"] = validate_generator_output(
                        row["output"],
                        set(payload["allowed_project_ids"]),
                        set(payload["allowed_skill_keys"]),
                        payload["background_assets"],
                        support_texts=(case["jd"], case["resume"]),
                    )
                    rows.append(row)
                    print(
                        f"[{profile.name}] {index}/{len(cases)} {case_id} resumed "
                        f"schema={row.get('meta', {}).get('schema_ok')} "
                        f"gates={len(row.get('gate_failures', []))}",
                        flush=True,
                    )
                    continue

                payload = prepare_case(case)
                output, meta = await call_json_model(
                    client,
                    profile,
                    prompt,
                    json.dumps(payload, ensure_ascii=False),
                    temperature=temperature,
                    max_tokens=2600,
                    retries=retries,
                    retry_backoff_seconds=retry_backoff_seconds,
                )
                output = normalize_generator_output(output or {})
                gate_failures = validate_generator_output(
                    output,
                    set(payload["allowed_project_ids"]),
                    set(payload["allowed_skill_keys"]),
                    payload["background_assets"],
                    support_texts=(case["jd"], case["resume"]),
                )
                row = {
                    "case_id": case_id,
                    "case_type": case["case_type"],
                    "input": payload,
                    "output": output,
                    "gate_failures": gate_failures,
                    "meta": meta,
                }
                rows.append(row)
                checkpoint.write(json.dumps(row, ensure_ascii=False) + "\n")
                checkpoint.flush()
                print(
                    f"[{profile.name}] {index}/{len(cases)} {case_id} "
                    f"schema={meta['schema_ok']} gates={len(gate_failures)} "
                    f"latency_ms={meta['latency_ms']}",
                    flush=True,
                )

    by_id = {str(case["case_id"]): case for case in cases}
    scored_cases = [score_case(by_id[str(row["case_id"])], row) for row in rows]
    result = {
        "profile": profile.name,
        "provider": profile.provider,
        "model": profile.model,
        "summary": summarize(rows, scored_cases),
        "cases": scored_cases,
        "raw": rows,
    }
    (output_dir / f"{profile.name}.metrics.json").write_text(
        json.dumps({key: value for key, value in result.items() if key != "raw"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return result


def format_rate(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.1%}"


def build_report(
    run_id: str,
    results: list[dict[str, Any]],
    case_count: int,
    selection: str,
    prompt_version: str,
) -> str:
    lines = [
        "# OfferMapping Generator Dev Canary",
        "",
        f"> Run ID: `{run_id}`  ",
        f"> Dataset: `dev-v1.4` ({case_count} synthetic cases; selection: `{selection}`)  ",
        f"> Prompt: `{prompt_version}`  ",
        "> Extractor input: human-reviewed Gold, so this run isolates Generator quality.  ",
        "> Status: exploratory canary; not a production or interview accuracy claim.  ",
        "",
        "| Profile | Model | Success | Gate clean | Focus | Focus complete | Background | Project whitelist | Unsupported metric | Resume template | P95 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        summary = result["summary"]
        lines.append(
            f"| {result['profile']} | {result['model']} | {format_rate(summary['request_success_rate'])} | "
            f"{format_rate(summary['gate_clean_rate'])} | {format_rate(summary['focus_coverage'])} | "
            f"{format_rate(summary['focus_complete_rate'])} | {format_rate(summary['background_grounding_rate'])} | "
            f"{format_rate(summary['project_whitelist_compliance_rate'])} | "
            f"{format_rate(summary['unsupported_metric_rate'])} | "
            f"{format_rate(summary['future_resume_template_compliance_rate'])} | "
            f"{summary['p95_latency_ms'] or 'n/a'} ms |"
        )

    lines.extend(["", "## Cases requiring review", ""])
    for result in results:
        lines.extend([f"### {result['profile']} — {result['model']}", ""])
        failures = [
            case
            for case in result["cases"]
            if not case["gate_clean"] or not case["focus_complete"]
        ]
        if not failures:
            lines.append("- None.")
        for case in failures:
            lines.append(
                f"- `{case['case_id']}`: schema={case['schema_ok']}, "
                f"gates={case['gate_failures']}, missed_focus={case['missed_focus_keys']}"
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
    prompt = prompt_path.read_text(encoding="utf-8")
    profiles = get_profiles(args.profiles)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f_generator_dev")
    if args.resume_dir:
        output_dir = args.resume_dir.resolve()
        if not output_dir.is_dir():
            raise ValueError(f"resume directory does not exist: {output_dir}")
        run_id = output_dir.name
        manifest_path = output_dir / "manifest.json"
        if manifest_path.exists():
            existing_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if existing_manifest.get("prompt_version") != args.prompt_version:
                raise ValueError("resume prompt version does not match")
            if existing_manifest.get("selection") != selection:
                raise ValueError("resume case selection does not match")
            if float(existing_manifest.get("temperature", args.temperature)) != args.temperature:
                raise ValueError("resume temperature does not match")
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
        "extractor_input": "gold",
        "prompt_version": args.prompt_version,
        "temperature": args.temperature,
        "profiles": [
            {
                "name": profile.name,
                "provider": profile.provider,
                "model": profile.model,
                "base_url": profile.base_url,
            }
            for profile in profiles
        ],
    }
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    results = await asyncio.gather(
        *(
            run_profile(
                profile,
                cases,
                prompt,
                output_dir,
                args.temperature,
                args.retry_failures,
                args.retries,
                args.retry_backoff_seconds,
            )
            for profile in profiles
        )
    )
    serializable = [{key: value for key, value in result.items() if key != "raw"} for result in results]
    (output_dir / "metrics.json").write_text(
        json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with (output_dir / "raw.jsonl").open("w", encoding="utf-8") as raw_file:
        for result in results:
            for row in result["raw"]:
                raw_file.write(
                    json.dumps(
                        {"profile": result["profile"], "model": result["model"], **row},
                        ensure_ascii=False,
                    )
                    + "\n"
                )
    (output_dir / "report.md").write_text(
        build_report(run_id, results, len(cases), selection, args.prompt_version),
        encoding="utf-8",
    )
    print(f"OUTPUT_DIR={output_dir}", flush=True)
    return output_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the three-model Generator Dev canary.")
    parser.add_argument("--profiles", nargs="+", default=DEFAULT_PROFILES)
    parser.add_argument("--case-type", choices=["realistic", "boundary"])
    parser.add_argument("--case-ids", nargs="+")
    parser.add_argument("--resume-dir", type=Path)
    parser.add_argument(
        "--prompt-version",
        choices=[
            "generator_v1",
            "generator_v2",
            "generator_v3",
            "generator_v4",
            "generator_v5",
            "generator_v6",
        ],
        default="generator_v6",
    )
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument(
        "--retry-failures",
        action="store_true",
        help="When resuming, call the model again only for rows whose JSON parsing failed.",
    )
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--retry-backoff-seconds", type=float, default=5.0)
    return parser.parse_args()


def main() -> None:
    asyncio.run(async_main(parse_args()))


if __name__ == "__main__":
    main()

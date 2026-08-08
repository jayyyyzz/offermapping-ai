from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

from evals.metrics.extraction import score_extractor_cases
from evals.validate_smoke import load_cases


def percentile_95(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[max(0, round(0.95 * len(ordered)) - 1)])


def load_rows(run_dir: Path) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    raw_path = run_dir / "raw.jsonl"
    for raw in raw_path.read_text(encoding="utf-8").splitlines():
        if raw.strip():
            row = json.loads(raw)
            grouped[row["profile"]].append(row)
    return grouped


def rescore(run_dir: Path) -> list[dict[str, Any]]:
    grouped = load_rows(run_dir)
    available_case_ids = {row["case_id"] for rows in grouped.values() for row in rows}
    cases = [case for case in load_cases() if case["case_id"] in available_case_ids]
    case_order = [case["case_id"] for case in cases]
    results: list[dict[str, Any]] = []
    for profile, rows in grouped.items():
        row_map = {row["case_id"]: row for row in rows}
        ordered_rows = [row_map[case_id] for case_id in case_order]
        outputs = [row.get("output") or {} for row in ordered_rows]
        scored = score_extractor_cases(cases, outputs)
        successful = [row for row in ordered_rows if row["meta"].get("schema_ok")]
        latencies = [int(row["meta"].get("latency_ms") or 0) for row in successful]
        boundary_results = [
            item
            for item, case in zip(scored["cases"], cases, strict=True)
            if case["case_type"] == "boundary"
        ]
        summary = dict(scored["summary"])
        summary.update(
            request_success_rate=round(len(successful) / len(ordered_rows), 4),
            p50_latency_ms=round(statistics.median(latencies)) if latencies else None,
            p95_latency_ms=percentile_95(latencies),
            total_input_tokens=sum(int(row["meta"].get("input_tokens") or 0) for row in ordered_rows),
            total_output_tokens=sum(int(row["meta"].get("output_tokens") or 0) for row in ordered_rows),
            boundary_clean_rate=round(
                sum(
                    item["job_family_correct"]
                    and not item["gate_failures"]
                    and not item["skill_fp"]
                    and not item["skill_fn"]
                    and not item["priority_mismatches"]
                    and not item["evidence_mismatches"]
                    for item in boundary_results
                )
                / len(boundary_results),
                4,
            ),
        )
        results.append(
            {
                "profile": profile,
                "model": ordered_rows[0]["model"],
                "summary": summary,
                "error_types": scored["error_types"],
                "cases": scored["cases"],
            }
        )
    return results


def build_report(run_id: str, results: list[dict[str, Any]]) -> str:
    lines = [
        "# Extractor Smoke Rescore — Gold v1.2",
        "",
        f"> Original run: `{run_id}`  ",
        "> Dataset: `smoke-v1.2`  ",
        "> Ontology: `ai_app_dev_v1`  ",
        "> New API calls: 0  ",
        "",
        "| Profile | Model | Success | Skill F1 | Precision | Recall | Evidence accuracy | Quote | Gates | Boundary clean | P95 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        s = result["summary"]
        lines.append(
            f"| {result['profile']} | {result['model']} | {s['request_success_rate']:.1%} | "
            f"{s['skill_f1']:.1%} | {s['skill_precision']:.1%} | {s['skill_recall']:.1%} | "
            f"{s['evidence_accuracy_on_matched']:.1%} | {s['quote_traceability']:.1%} | "
            f"{s['gate_failure_count']} | {s['boundary_clean_rate']:.1%} | {s['p95_latency_ms'] or 'n/a'} ms |"
        )
    lines.extend(["", "## Remaining case differences", ""])
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
                    f"extra={case['extra_skills']}, missed={case['missed_skills']}, gates={case['gate_failures']}, "
                    f"priority={case['priority_mismatches']}, evidence={case['evidence_mismatches']}"
                )
        lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rescore an extractor run with current Gold and ontology.")
    parser.add_argument("run_dir", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_dir = args.run_dir.resolve()
    results = rescore(run_dir)
    (run_dir / "metrics_gold_v1_2.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (run_dir / "report_gold_v1_2.md").write_text(
        build_report(run_dir.name, results),
        encoding="utf-8",
    )
    print(run_dir / "report_gold_v1_2.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

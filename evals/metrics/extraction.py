from __future__ import annotations

from collections import Counter
from typing import Any

from evals.gates import validate_extractor_output
from evals.ontology import canonicalize_skill_key


def normalize_skill_key(value: str) -> str:
    return canonicalize_skill_key(value)


def skill_map(skills: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for skill in skills:
        key = normalize_skill_key(str(skill.get("key") or ""))
        if key and key not in result:
            result[key] = skill
    return result


def safe_divide(numerator: int | float, denominator: int | float) -> float:
    return numerator / denominator if denominator else 0.0


def score_extractor_cases(
    cases: list[dict[str, Any]],
    outputs: list[dict[str, Any]],
) -> dict[str, Any]:
    if len(cases) != len(outputs):
        raise ValueError("cases and outputs must have the same length")

    tp = fp = fn = 0
    job_family_correct = 0
    priority_correct = priority_total = 0
    evidence_correct = evidence_total = 0
    quote_failure_count = 0
    evidence_overclaims = 0
    evidence_predictions = 0
    case_results: list[dict[str, Any]] = []
    error_types: Counter[str] = Counter()

    for case, output in zip(cases, outputs, strict=True):
        gold_skills = skill_map(case["gold"]["skills"])
        predicted_skills = skill_map(output.get("skills", []))
        gold_keys = set(gold_skills)
        predicted_keys = set(predicted_skills)
        case_tp = len(gold_keys & predicted_keys)
        case_fp = len(predicted_keys - gold_keys)
        case_fn = len(gold_keys - predicted_keys)
        tp += case_tp
        fp += case_fp
        fn += case_fn

        family_ok = output.get("job_family") == case["gold"]["job_family"]
        job_family_correct += int(family_ok)
        priority_mismatches: list[dict[str, str]] = []
        evidence_mismatches: list[dict[str, str]] = []

        for key in sorted(gold_keys & predicted_keys):
            gold = gold_skills[key]
            predicted = predicted_skills[key]
            priority_total += 1
            evidence_total += 1
            priority_correct += int(predicted.get("priority") == gold.get("priority"))
            evidence_correct += int(predicted.get("evidence") == gold.get("evidence"))
            if predicted.get("priority") != gold.get("priority"):
                priority_mismatches.append(
                    {"key": key, "gold": str(gold.get("priority")), "predicted": str(predicted.get("priority"))}
                )
            if predicted.get("evidence") != gold.get("evidence"):
                evidence_mismatches.append(
                    {"key": key, "gold": str(gold.get("evidence")), "predicted": str(predicted.get("evidence"))}
                )
            if predicted.get("evidence") in {"project-backed", "listed-only"}:
                evidence_predictions += 1
                if gold.get("evidence") == "missing":
                    evidence_overclaims += 1

        gate_failures = validate_extractor_output(output, case["jd"], case["resume"])
        quote_failures = [failure for failure in gate_failures if "quote_not_found" in failure]
        quote_failure_count += len(quote_failures)
        for failure in gate_failures:
            error_types[failure.split(":")[-1]] += 1

        case_results.append(
            {
                "case_id": case["case_id"],
                "job_family_correct": family_ok,
                "skill_tp": case_tp,
                "skill_fp": case_fp,
                "skill_fn": case_fn,
                "extra_skills": sorted(predicted_keys - gold_keys),
                "missed_skills": sorted(gold_keys - predicted_keys),
                "priority_mismatches": priority_mismatches,
                "evidence_mismatches": evidence_mismatches,
                "gate_failures": gate_failures,
            }
        )

    precision = safe_divide(tp, tp + fp)
    recall = safe_divide(tp, tp + fn)
    f1 = safe_divide(2 * precision * recall, precision + recall)
    total_quotes = sum(
        1
        for output in outputs
        for skill in output.get("skills", [])
        if skill.get("jd_quote") or skill.get("resume_quote")
    )

    return {
        "summary": {
            "cases": len(cases),
            "job_family_accuracy": round(safe_divide(job_family_correct, len(cases)), 4),
            "skill_precision": round(precision, 4),
            "skill_recall": round(recall, 4),
            "skill_f1": round(f1, 4),
            "priority_accuracy_on_matched": round(safe_divide(priority_correct, priority_total), 4),
            "evidence_accuracy_on_matched": round(safe_divide(evidence_correct, evidence_total), 4),
            "evidence_overclaim_rate": round(safe_divide(evidence_overclaims, evidence_predictions), 4),
            "quote_traceability": round(safe_divide(total_quotes - quote_failure_count, total_quotes), 4),
            "gate_failure_count": sum(error_types.values()),
        },
        "error_types": dict(error_types.most_common()),
        "cases": case_results,
    }

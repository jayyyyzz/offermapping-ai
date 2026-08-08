from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from evals.ontology import canonical_skill_keys


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "datasets" / "smoke.jsonl"
REQUIRED_SUBTRACKS = {
    "rag",
    "agent",
    "llm_backend",
    "ai_workflow",
    "model_evaluation",
    "deployment",
}


def load_cases(path: Path = DATASET_PATH) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            cases.append(json.loads(raw))
        except json.JSONDecodeError as exc:
            raise ValueError(f"line {line_number}: invalid JSON: {exc}") from exc
    return cases


def validate_cases(cases: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    canonical_keys = canonical_skill_keys()
    if len(cases) != 12:
        errors.append(f"expected 12 cases, got {len(cases)}")

    ids = [str(case.get("case_id")) for case in cases]
    duplicates = [case_id for case_id, count in Counter(ids).items() if count > 1]
    if duplicates:
        errors.append(f"duplicate case ids: {duplicates}")

    type_counts = Counter(case.get("case_type") for case in cases)
    if type_counts != Counter({"realistic": 8, "boundary": 4}):
        errors.append(f"expected 8 realistic + 4 boundary, got {dict(type_counts)}")

    subtracks = {str(case.get("subtrack")) for case in cases}
    missing_subtracks = sorted(REQUIRED_SUBTRACKS - subtracks)
    if missing_subtracks:
        errors.append(f"missing required subtracks: {missing_subtracks}")

    for case in cases:
        case_id = str(case.get("case_id", "unknown"))
        prefix = f"{case_id}:"
        if case.get("dataset_version") != "smoke-v1.2":
            errors.append(f"{prefix} dataset_version must be smoke-v1.2")
        if case.get("split") != "smoke":
            errors.append(f"{prefix} split must be smoke")
        if case.get("synthetic") is not True:
            errors.append(f"{prefix} synthetic must be true")
        if case.get("job_family") != "ai_app_dev":
            errors.append(f"{prefix} job_family must be ai_app_dev")
        if case.get("gold", {}).get("job_family") != "ai_app_dev":
            errors.append(f"{prefix} gold.job_family must be ai_app_dev")

        jd = str(case.get("jd") or "")
        resume = str(case.get("resume") or "")
        if len(jd) < 80:
            errors.append(f"{prefix} JD is too short")
        if len(resume) < 100:
            errors.append(f"{prefix} resume is too short")

        skills = case.get("gold", {}).get("skills", [])
        if not skills:
            errors.append(f"{prefix} no gold skills")
        for index, skill in enumerate(skills):
            skill_prefix = f"{prefix} skills[{index}]"
            jd_quote = str(skill.get("jd_quote") or "")
            resume_quote = str(skill.get("resume_quote") or "")
            evidence = skill.get("evidence")
            if skill.get("key") not in canonical_keys:
                errors.append(f"{skill_prefix} key is not in ai_app_dev_v1 ontology")
            if not jd_quote or jd_quote not in jd:
                errors.append(f"{skill_prefix} jd_quote not found")
            if resume_quote and resume_quote not in resume:
                errors.append(f"{skill_prefix} resume_quote not found")
            if evidence == "missing" and resume_quote:
                errors.append(f"{skill_prefix} missing evidence must have empty quote")
            if evidence in {"project-backed", "listed-only"} and not resume_quote:
                errors.append(f"{skill_prefix} evidence requires resume_quote")

        for index, requirement in enumerate(case.get("gold", {}).get("hard_requirements", [])):
            quote = str(requirement.get("jd_quote") or "")
            if not quote or quote not in jd:
                errors.append(f"{prefix} hard_requirements[{index}] quote not found")

        expectations = case.get("generation_expectations", {})
        if not expectations.get("required_focus_skill_keys"):
            errors.append(f"{prefix} generation focus is empty")
        if not expectations.get("forbid_unsupported_metrics"):
            errors.append(f"{prefix} unsupported metric gate must be enabled")
    return errors


def main() -> int:
    cases = load_cases()
    errors = validate_cases(cases)
    if errors:
        print("Smoke dataset validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    counts = Counter(case["case_type"] for case in cases)
    print(
        f"Smoke dataset valid: {len(cases)} cases "
        f"({counts['realistic']} realistic, {counts['boundary']} boundary)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from evals.ontology import canonical_skill_keys


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "datasets" / "dev.jsonl"
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
    if len(cases) != 30:
        errors.append(f"expected 30 cases, got {len(cases)}")

    ids = [str(case.get("case_id")) for case in cases]
    duplicates = [case_id for case_id, count in Counter(ids).items() if count > 1]
    if duplicates:
        errors.append(f"duplicate case ids: {duplicates}")

    type_counts = Counter(case.get("case_type") for case in cases)
    if type_counts != Counter({"realistic": 24, "boundary": 6}):
        errors.append(f"expected 24 realistic + 6 boundary, got {dict(type_counts)}")

    subtrack_counts = Counter(str(case.get("subtrack")) for case in cases)
    expected_subtracks = Counter({subtrack: 5 for subtrack in REQUIRED_SUBTRACKS})
    if subtrack_counts != expected_subtracks:
        errors.append(f"expected 5 cases per subtrack, got {dict(subtrack_counts)}")

    difficulty_counts = Counter(str(case.get("difficulty")) for case in cases)
    if difficulty_counts != Counter({"entry": 12, "junior": 12, "mid": 6}):
        errors.append(f"unexpected difficulty distribution: {dict(difficulty_counts)}")

    observed_keys: set[str] = set()
    evidence_counts: Counter[str] = Counter()
    for case in cases:
        case_id = str(case.get("case_id", "unknown"))
        prefix = f"{case_id}:"
        if case.get("dataset_version") != "dev-v1.4":
            errors.append(f"{prefix} dataset_version must be dev-v1.4")
        if case.get("split") != "dev":
            errors.append(f"{prefix} split must be dev")
        if case.get("synthetic") is not True:
            errors.append(f"{prefix} synthetic must be true")
        if case.get("job_family") != "ai_app_dev":
            errors.append(f"{prefix} job_family must be ai_app_dev")
        if case.get("gold", {}).get("job_family") != "ai_app_dev":
            errors.append(f"{prefix} gold.job_family must be ai_app_dev")

        annotation = case.get("annotation", {})
        annotation_status = annotation.get("status")
        if annotation_status not in {"pending_human_review", "human_reviewed"}:
            errors.append(f"{prefix} invalid annotation status")
        if annotation_status == "pending_human_review":
            if annotation.get("reviewer") is not None or annotation.get("reviewed_at") is not None:
                errors.append(f"{prefix} pending annotation cannot have reviewer metadata")
        if annotation_status == "human_reviewed":
            if not annotation.get("reviewer") or not annotation.get("reviewed_at"):
                errors.append(f"{prefix} reviewed annotation requires reviewer and reviewed_at")
        if case.get("case_type") == "boundary" and not annotation.get("ambiguity_notes"):
            errors.append(f"{prefix} boundary case must explain its ambiguity")

        jd = str(case.get("jd") or "")
        resume = str(case.get("resume") or "")
        if len(jd) < 80:
            errors.append(f"{prefix} JD is too short")
        if len(resume) < 100:
            errors.append(f"{prefix} resume is too short")

        skills = case.get("gold", {}).get("skills", [])
        case_skill_keys = {str(skill.get("key")) for skill in skills}
        observed_keys.update(case_skill_keys)
        for index, skill in enumerate(skills):
            skill_prefix = f"{prefix} skills[{index}]"
            key = str(skill.get("key") or "")
            jd_quote = str(skill.get("jd_quote") or "")
            resume_quote = str(skill.get("resume_quote") or "")
            evidence = str(skill.get("evidence") or "")
            evidence_counts[evidence] += 1
            if key not in canonical_keys:
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
            jd_quote = str(requirement.get("jd_quote") or "")
            resume_quote = str(requirement.get("resume_quote") or "")
            if not jd_quote or jd_quote not in jd:
                errors.append(f"{prefix} hard_requirements[{index}] jd_quote not found")
            if resume_quote and resume_quote not in resume:
                errors.append(f"{prefix} hard_requirements[{index}] resume_quote not found")

        expectations = case.get("generation_expectations", {})
        focus_keys = set(expectations.get("required_focus_skill_keys", []))
        if not focus_keys:
            errors.append(f"{prefix} generation focus is empty")
        if not focus_keys.issubset(case_skill_keys):
            errors.append(f"{prefix} generation focus contains unannotated skills")
        if expectations.get("must_use_background_assets") != case.get("gold", {}).get("background_assets"):
            errors.append(f"{prefix} generation background assets must match gold")
        if expectations.get("forbid_unsupported_metrics") is not True:
            errors.append(f"{prefix} unsupported metric gate must be enabled")

    if len(observed_keys) < 30:
        errors.append(f"expected at least 30 ontology skills, got {len(observed_keys)}")
    for evidence in ("project-backed", "listed-only", "missing"):
        if evidence_counts[evidence] < 25:
            errors.append(f"insufficient {evidence} examples: {evidence_counts[evidence]}")
    return errors


def main() -> int:
    cases = load_cases()
    errors = validate_cases(cases)
    if errors:
        print("Dev dataset validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    type_counts = Counter(case["case_type"] for case in cases)
    skill_count = len({skill["key"] for case in cases for skill in case["gold"]["skills"]})
    print(
        f"Dev dataset valid: {len(cases)} cases "
        f"({type_counts['realistic']} realistic, {type_counts['boundary']} boundary), "
        f"covering {skill_count} canonical skills."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

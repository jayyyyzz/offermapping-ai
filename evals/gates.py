from __future__ import annotations

import copy
import re
from typing import Any, Iterable


ALLOWED_JOB_FAMILIES = {"algorithm", "ai_app_dev", "ai_product", "data"}
ALLOWED_PRIORITIES = {"must", "nice"}
ALLOWED_EVIDENCE = {"project-backed", "listed-only", "missing"}

OFFER_PROMISE_PATTERNS = (
    r"保证.{0,8}(offer|录用|入职)",
    r"一定.{0,8}(offer|录用|入职)",
    r"百分之百.{0,8}(offer|录用|入职)",
    r"稳拿.{0,8}(offer|录用|入职)",
)

ACHIEVEMENT_PATTERNS = (
    r"(?:准确率|召回率|通过率|命中率|满意度|转化率).{0,12}\d+(?:\.\d+)?%",
    r"(?:提升|提高|降低|减少|优化).{0,12}\d+(?:\.\d+)?%",
    r"(?:达到|达成|实现).{0,12}\d+(?:\.\d+)?%",
    r"(?:构建|建立|整理|完成|覆盖).{0,10}\d+\+?\s*(?:条|个|份|次|人)",
)

PLACEHOLDER_PATTERN = re.compile(r"\[[^\]]+\]|【[^】]+】|<[^>]+>")
FUTURE_MARKERS = ("建议", "计划", "目标", "可以先", "至少准备", "待填写", "完成后记录")


def iter_text_values(value: Any) -> Iterable[str]:
    """Yield every user-visible string from a nested JSON-like value."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for nested in value.values():
            yield from iter_text_values(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from iter_text_values(nested)


def normalize_generator_output(output: dict[str, Any]) -> dict[str, Any]:
    """Normalize harmless formatting variance before applying strict gates."""
    normalized = copy.deepcopy(output)
    resume_line = normalized.get("resume_line")
    if isinstance(resume_line, str) and resume_line.startswith("完成后可填写:"):
        normalized["resume_line"] = "完成后可填写：" + resume_line[len("完成后可填写:") :]
    milestones = normalized.get("milestones")
    if isinstance(milestones, list):
        for item in milestones:
            if isinstance(item, dict) and isinstance(item.get("week"), int) and not isinstance(item.get("week"), bool):
                item["week"] = f"{item['week']:02d}"
    return normalized


def validate_extractor_output(output: dict[str, Any], jd: str, resume: str) -> list[str]:
    """Return deterministic extractor gate failures."""
    failures: list[str] = []
    if output.get("job_family") not in ALLOWED_JOB_FAMILIES:
        failures.append("invalid_job_family")
    if not isinstance(output.get("role"), str) or not output.get("role", "").strip():
        failures.append("missing_role")
    if not isinstance(output.get("background_assets"), list):
        failures.append("invalid_background_assets")

    hard_requirements = output.get("hard_requirements")
    if not isinstance(hard_requirements, list):
        failures.append("missing_hard_requirements")
    else:
        for index, item in enumerate(hard_requirements):
            prefix = f"hard_requirements[{index}]"
            if not isinstance(item, dict):
                failures.append(f"{prefix}:not_object")
                continue
            jd_quote = str(item.get("jd_quote") or "").strip()
            resume_quote = str(item.get("resume_quote") or "").strip()
            if not jd_quote or jd_quote not in jd:
                failures.append(f"{prefix}:jd_quote_not_found")
            if resume_quote and resume_quote not in resume:
                failures.append(f"{prefix}:resume_quote_not_found")
            if item.get("status") not in {"met", "unmet", "unknown"}:
                failures.append(f"{prefix}:invalid_status")

    skills = output.get("skills")
    if not isinstance(skills, list) or not skills:
        return failures + ["missing_skills"]

    for index, item in enumerate(skills):
        prefix = f"skills[{index}]"
        if not isinstance(item, dict):
            failures.append(f"{prefix}:not_object")
            continue
        if item.get("priority") not in ALLOWED_PRIORITIES:
            failures.append(f"{prefix}:invalid_priority")
        if item.get("evidence") not in ALLOWED_EVIDENCE:
            failures.append(f"{prefix}:invalid_evidence")

        jd_quote = str(item.get("jd_quote") or "").strip()
        resume_quote = str(item.get("resume_quote") or "").strip()
        evidence = item.get("evidence")
        if not jd_quote or jd_quote not in jd:
            failures.append(f"{prefix}:jd_quote_not_found")
        if resume_quote and resume_quote not in resume:
            failures.append(f"{prefix}:resume_quote_not_found")
        if evidence == "missing" and resume_quote:
            failures.append(f"{prefix}:missing_with_resume_quote")
        if evidence in {"project-backed", "listed-only"} and not resume_quote:
            failures.append(f"{prefix}:evidence_without_resume_quote")
    return failures


def find_offer_promises(text: str) -> list[str]:
    return [pattern for pattern in OFFER_PROMISE_PATTERNS if re.search(pattern, text, re.I)]


def find_unsupported_achievements(text: str, support_texts: Iterable[str] = ()) -> list[str]:
    """Find quantitative achievements not supported by source text.

    This gate intentionally favors false positives during release checks. Future
    recommendations and explicit placeholders are allowed; achieved results are not.
    """
    support = "\n".join(support_texts)
    cleaned = PLACEHOLDER_PATTERN.sub("", text)
    failures: list[str] = []
    sentences = [part.strip() for part in re.split(r"[。！？\n]", cleaned) if part.strip()]
    for sentence in sentences:
        if any(marker in sentence for marker in FUTURE_MARKERS):
            continue
        for pattern in ACHIEVEMENT_PATTERNS:
            match = re.search(pattern, sentence, re.I)
            if not match:
                continue
            claim = match.group(0)
            numbers = re.findall(r"\d+(?:\.\d+)?", claim)
            if numbers and all(number in support for number in numbers):
                continue
            failures.append(sentence)
            break
    return failures


def validate_generator_shape(output: dict[str, Any]) -> list[str]:
    """Validate the stable JSON shape without adding a runtime jsonschema dependency."""
    failures: list[str] = []
    required_strings = (
        "diagnosis",
        "project_title",
        "project_rationale",
        "resume_line",
    )
    for field in required_strings:
        if not isinstance(output.get(field), str) or not str(output.get(field) or "").strip():
            failures.append(f"schema_missing_or_invalid_{field}")

    recommendations = output.get("recommendations")
    if not isinstance(recommendations, list) or len(recommendations) != 3:
        failures.append("schema_recommendations_not_three")
    else:
        for index, item in enumerate(recommendations):
            prefix = f"schema_recommendations[{index}]"
            if not isinstance(item, dict):
                failures.append(f"{prefix}:not_object")
                continue
            for field in ("project_id", "reason", "adaptation"):
                if not isinstance(item.get(field), str) or not str(item.get(field) or "").strip():
                    failures.append(f"{prefix}:invalid_{field}")
            if not isinstance(item.get("matched_gaps"), list) or not item.get("matched_gaps"):
                failures.append(f"{prefix}:invalid_matched_gaps")
            if not isinstance(item.get("rank"), int) or isinstance(item.get("rank"), bool):
                failures.append(f"{prefix}:invalid_rank_type")

    milestones = output.get("milestones")
    if not isinstance(milestones, list) or not 3 <= len(milestones) <= 5:
        failures.append("schema_milestones_count")
    else:
        for index, item in enumerate(milestones):
            prefix = f"schema_milestones[{index}]"
            if not isinstance(item, dict):
                failures.append(f"{prefix}:not_object")
                continue
            if not isinstance(item.get("week"), str):
                failures.append(f"{prefix}:week_must_be_string")
            for field in ("title", "deliverable", "talking_point"):
                if not isinstance(item.get(field), str) or not str(item.get(field) or "").strip():
                    failures.append(f"{prefix}:invalid_{field}")
    return failures


def validate_generator_output(
    output: dict[str, Any],
    allowed_project_ids: set[str],
    allowed_skill_keys: set[str],
    background_assets: list[str],
    support_texts: Iterable[str] = (),
) -> list[str]:
    """Return deterministic generator release-gate failures."""
    failures: list[str] = validate_generator_shape(output)
    main_id = output.get("main_project_id")
    if main_id not in allowed_project_ids:
        failures.append("main_project_not_allowed")

    for field in ("diagnosis", "project_title", "project_rationale", "resume_line"):
        if not isinstance(output.get(field), str) or not str(output.get(field) or "").strip():
            failures.append(f"missing_{field}")
    if not str(output.get("resume_line") or "").startswith("完成后可填写："):
        failures.append("resume_line_not_future_template")

    recommendations = output.get("recommendations")
    if not isinstance(recommendations, list) or not recommendations:
        failures.append("missing_recommendations")
    else:
        if len(recommendations) != 3:
            failures.append("recommendation_count_not_three")
        seen: set[str] = set()
        seen_ranks: set[int] = set()
        for index, item in enumerate(recommendations):
            project_id = item.get("project_id") if isinstance(item, dict) else None
            if project_id not in allowed_project_ids:
                failures.append(f"recommendations[{index}]:project_not_allowed")
            if project_id in seen:
                failures.append(f"recommendations[{index}]:duplicate_project")
            if project_id:
                seen.add(project_id)
            rank = item.get("rank") if isinstance(item, dict) else None
            if rank not in {1, 2, 3}:
                failures.append(f"recommendations[{index}]:invalid_rank")
            elif rank in seen_ranks:
                failures.append(f"recommendations[{index}]:duplicate_rank")
            else:
                seen_ranks.add(rank)
            matched_gaps = item.get("matched_gaps", []) if isinstance(item, dict) else []
            if not isinstance(matched_gaps, list) or not matched_gaps:
                failures.append(f"recommendations[{index}]:missing_matched_gaps")
                matched_gaps = []
            for skill in matched_gaps:
                if skill not in allowed_skill_keys:
                    failures.append(f"recommendations[{index}]:unknown_skill:{skill}")
            for field in ("reason", "adaptation"):
                if not isinstance(item, dict) or not str(item.get(field) or "").strip():
                    failures.append(f"recommendations[{index}]:missing_{field}")
        if main_id in allowed_project_ids and main_id not in seen:
            failures.append("main_project_not_recommended")
        if seen_ranks != {1, 2, 3}:
            failures.append("recommendation_ranks_incomplete")

    milestones = output.get("milestones")
    if not isinstance(milestones, list) or not 3 <= len(milestones) <= 5:
        failures.append("missing_milestones")
    else:
        for index, item in enumerate(milestones):
            if not isinstance(item, dict) or not str(item.get("deliverable") or "").strip():
                failures.append(f"milestones[{index}]:missing_deliverable")
            if not isinstance(item, dict) or not str(item.get("talking_point") or "").strip():
                failures.append(f"milestones[{index}]:missing_talking_point")

    combined = "\n".join(iter_text_values(output))
    if background_assets and not any(asset in combined for asset in background_assets):
        failures.append("background_not_used")
    if find_offer_promises(combined):
        failures.append("offer_promise")
    if find_unsupported_achievements(combined, support_texts):
        failures.append("unsupported_metric")
    return failures

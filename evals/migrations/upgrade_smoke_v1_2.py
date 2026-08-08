from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "evals" / "datasets" / "smoke_v1_1.jsonl"
TARGET = ROOT / "evals" / "datasets" / "smoke.jsonl"


def main() -> int:
    cases = [json.loads(line) for line in SOURCE.read_text(encoding="utf-8").splitlines() if line.strip()]
    for case in cases:
        case["dataset_version"] = "smoke-v1.2"
        if case["case_id"] == "ai_app_dev_agent_game_002":
            case["gold"]["skills"].append({
                "key": "automated_evaluation",
                "name": "自动化评测",
                "priority": "nice",
                "jd_quote": "具备自动化评测或失败分析经验者优先",
                "resume_quote": "",
                "evidence": "missing",
            })
        if case["case_id"] == "ai_app_dev_eval_qa_005":
            skills = case["gold"]["skills"]
            skills[:] = [skill for skill in skills if skill["key"] != "prompt_engineering"]
            for skill in skills:
                if skill["key"] == "automated_evaluation":
                    skill.update({
                        "name": "Prompt 对比与自动化评测",
                        "priority": "must",
                        "resume_quote": "对三版提示词进行人工对比并记录失败案例",
                        "evidence": "project-backed",
                    })
        if case["case_id"] == "ai_app_dev_boundary_keyword_012":
            case["gold"]["skills"][:] = [
                skill for skill in case["gold"]["skills"] if skill["key"] != "function_calling"
            ]
    TARGET.write_text(
        "\n".join(json.dumps(case, ensure_ascii=False, separators=(",", ":")) for case in cases) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(cases)} cases to {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


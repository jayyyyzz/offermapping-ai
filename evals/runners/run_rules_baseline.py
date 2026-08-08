from __future__ import annotations

import json

from backend.app import local_extract
from evals.metrics.extraction import score_extractor_cases
from evals.validate_smoke import load_cases


def run() -> dict[str, object]:
    cases = load_cases()
    outputs = [local_extract(case["jd"], case["resume"]) for case in cases]
    return score_extractor_cases(cases, outputs)


def main() -> int:
    print(json.dumps(run(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


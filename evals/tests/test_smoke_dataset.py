from __future__ import annotations

import unittest

from evals.gates import (
    find_offer_promises,
    find_unsupported_achievements,
    validate_extractor_output,
)
from evals.metrics.extraction import score_extractor_cases
from evals.validate_smoke import load_cases, validate_cases


class SmokeDatasetTests(unittest.TestCase):
    def test_dataset_constraints(self) -> None:
        self.assertEqual(validate_cases(load_cases()), [])

    def test_gold_outputs_pass_extractor_gates(self) -> None:
        for case in load_cases():
            output = {
                "job_family": case["gold"]["job_family"],
                "role": case["gold"]["role"],
                "background_assets": case["gold"]["background_assets"],
                "hard_requirements": case["gold"]["hard_requirements"],
                "skills": case["gold"]["skills"],
            }
            with self.subTest(case_id=case["case_id"]):
                self.assertEqual(
                    validate_extractor_output(output, case["jd"], case["resume"]),
                    [],
                )

    def test_unsupported_achievement_is_blocked(self) -> None:
        text = "完成项目后准确率达到 85%，并构建 30 条评估集。"
        self.assertTrue(find_unsupported_achievements(text))

    def test_future_plan_and_placeholder_are_allowed(self) -> None:
        text = "建议准备 20 条测试样本，并将准确率从 [基线] 提升到 [结果]。"
        self.assertEqual(find_unsupported_achievements(text), [])

    def test_offer_promise_is_blocked(self) -> None:
        self.assertTrue(find_offer_promises("完成这个项目保证拿到 offer。"))

    def test_extraction_metrics_are_deterministic(self) -> None:
        cases = load_cases()[:1]
        gold_output = {
            "job_family": cases[0]["gold"]["job_family"],
            "role": cases[0]["gold"]["role"],
            "background_assets": cases[0]["gold"]["background_assets"],
            "hard_requirements": cases[0]["gold"]["hard_requirements"],
            "skills": cases[0]["gold"]["skills"],
        }
        metrics = score_extractor_cases(cases, [gold_output])["summary"]
        self.assertEqual(metrics["job_family_accuracy"], 1.0)
        self.assertEqual(metrics["skill_f1"], 1.0)
        self.assertEqual(metrics["quote_traceability"], 1.0)


if __name__ == "__main__":
    unittest.main()

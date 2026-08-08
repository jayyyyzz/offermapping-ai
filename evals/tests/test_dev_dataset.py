from __future__ import annotations

import unittest

from evals.gates import validate_extractor_output
from evals.validate_dev import load_cases, validate_cases


class DevDatasetTests(unittest.TestCase):
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

    def test_every_subtrack_has_one_boundary_case(self) -> None:
        boundary_subtracks = {
            case["subtrack"] for case in load_cases() if case["case_type"] == "boundary"
        }
        self.assertEqual(
            boundary_subtracks,
            {"rag", "agent", "llm_backend", "ai_workflow", "model_evaluation", "deployment"},
        )

    def test_dataset_generation_is_deterministic(self) -> None:
        from evals.datasets.generate_dev_v1 import build_cases

        self.assertEqual(load_cases(), build_cases())


if __name__ == "__main__":
    unittest.main()

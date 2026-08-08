from __future__ import annotations

import unittest

from evals.gates import normalize_generator_output, validate_generator_output


def valid_output() -> dict:
    return {
        "diagnosis": "你的金融资料结构理解可以迁移到 RAG 数据设计，但目前缺少向量检索的项目证据。",
        "main_project_id": "llama_index",
        "project_title": "金融公告 RAG 证据项目",
        "project_rationale": "使用 LlamaIndex 复刻检索链路，并以金融资料结构理解设计文档分类和引用规则。",
        "resume_line": "完成后可填写：基于 LlamaIndex 实现公告问答，使用 [样本数量] 条测试集记录 [核心指标] 从 [基线] 到 [结果] 的变化。",
        "recommendations": [
            {"project_id": "llama_index", "reason": "补齐检索链路", "matched_gaps": ["rag"], "adaptation": "替换为金融公告", "rank": 1},
            {"project_id": "pgvector", "reason": "补齐向量存储", "matched_gaps": ["vector_search"], "adaptation": "增加公告过滤", "rank": 2},
            {"project_id": "fastapi", "reason": "补齐接口交付", "matched_gaps": ["fastapi"], "adaptation": "封装查询接口", "rank": 3},
        ],
        "milestones": [
            {"week": "01", "title": "基线", "deliverable": "可运行检索链路", "talking_point": "如何选择切分方式？"},
            {"week": "02", "title": "评测", "deliverable": "固定测试集和失败记录", "talking_point": "怎样判断引用可靠？"},
            {"week": "03", "title": "复盘", "deliverable": "错误分类和改进记录", "talking_point": "最大失败案例是什么？"},
        ],
    }


class GeneratorGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.projects = {"llama_index", "pgvector", "fastapi"}
        self.skills = {"rag", "vector_search", "fastapi"}
        self.assets = ["金融资料结构理解"]

    def validate(self, output: dict) -> list[str]:
        return validate_generator_output(output, self.projects, self.skills, self.assets)

    def test_valid_output_passes(self) -> None:
        self.assertEqual(self.validate(valid_output()), [])

    def test_nested_unsupported_metric_is_blocked(self) -> None:
        output = valid_output()
        output["milestones"][0]["deliverable"] = "完成 30 条样本并使准确率达到 90%"
        self.assertIn("unsupported_metric", self.validate(output))

    def test_unknown_project_is_blocked(self) -> None:
        output = valid_output()
        output["main_project_id"] = "invented_project"
        self.assertIn("main_project_not_allowed", self.validate(output))

    def test_background_asset_must_be_grounded(self) -> None:
        output = valid_output()
        output["diagnosis"] = "当前缺少 RAG 项目证据。"
        output["project_rationale"] = "复刻检索链路并建立测试集。"
        self.assertIn("background_not_used", self.validate(output))

    def test_duplicate_rank_is_blocked(self) -> None:
        output = valid_output()
        output["recommendations"][1]["rank"] = 1
        self.assertIn("recommendations[1]:duplicate_rank", self.validate(output))

    def test_resume_line_must_be_future_template(self) -> None:
        output = valid_output()
        output["resume_line"] = "基于 LlamaIndex 实现公告问答，准确率达到 90%。"
        failures = self.validate(output)
        self.assertIn("resume_line_not_future_template", failures)
        self.assertIn("unsupported_metric", failures)

    def test_main_project_must_be_recommended(self) -> None:
        output = valid_output()
        output["main_project_id"] = "fastapi"
        output["recommendations"] = output["recommendations"][:2] + [
            {"project_id": "llama_index", "reason": "另一种检索实现", "matched_gaps": ["rag"], "adaptation": "替换为金融公告", "rank": 3}
        ]
        self.assertIn("main_project_not_recommended", self.validate(output))

    def test_milestone_week_must_be_string(self) -> None:
        output = valid_output()
        output["milestones"][0]["week"] = 1
        self.assertIn("schema_milestones[0]:week_must_be_string", self.validate(output))

    def test_harmless_format_variance_is_normalized(self) -> None:
        output = valid_output()
        output["resume_line"] = output["resume_line"].replace("完成后可填写：", "完成后可填写:", 1)
        output["milestones"][0]["week"] = 1
        normalized = normalize_generator_output(output)
        self.assertTrue(normalized["resume_line"].startswith("完成后可填写："))
        self.assertEqual(normalized["milestones"][0]["week"], "01")
        self.assertEqual(self.validate(normalized), [])


if __name__ == "__main__":
    unittest.main()

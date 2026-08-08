# OfferMapping Evals

本目录用于运行 OfferMapping 的业务测评，不使用通用排行榜代替真实产品任务。

## 当前范围

- Smoke 数据集：12 条 `ai_app_dev` 案例，当前版本 `smoke-v1.2`。
- Dev 数据集：30 条 `ai_app_dev` 案例，当前版本 `dev-v1.4`，已完成单人逐条复核和资格赛后一致性审计。
- 构成：Smoke 为 8 条真实风格模拟案例 + 4 条人工边界案例；Dev 为 24 + 6。
- 数据性质：全部为合成数据，固定标记 `synthetic: true`。
- 当前能力：数据质量校验、canonical skill ontology、Extractor 硬门禁、Generator 基础安全门禁。
- Extractor Prompt：`extractor_v5`，在 v4 的否定作用域、证据等级和岗位族规则上，补充 JD-only 技能边界与工具基础使用规则，并接入后端分析路径。
- Generator Prompt：`generator_v6`，强制项目白名单、背景落地、必选技能全覆盖、全字段未知数字占位、稳定 JSON 结构和面试里程碑。
- 延迟稳定性观察：`reports/extractor_gpt_latency_stability_20260727.md`。
- 候选模型：DeepSeek、Qwen、OpenAI（中转站）、Claude（中转站）。

## 目录

```text
evals/
  datasets/smoke.jsonl
  datasets/dev.jsonl
  datasets/generate_dev_v1.py
  schemas/case.schema.json
  schemas/dev_case.schema.json
  schemas/extractor_output.schema.json
  schemas/generator_output.schema.json
  gates.py
  validate_smoke.py
  validate_dev.py
  tests/test_smoke_dataset.py
  tests/test_dev_dataset.py
```

## 校验数据

```powershell
python -m evals.validate_smoke
python -m evals.validate_dev
python -m unittest evals.tests.test_smoke_dataset
python -m unittest evals.tests.test_dev_dataset
python -m unittest evals.tests.test_generator_gates
python -m evals.runners.run_rules_baseline
python -m evals.runners.run_extractor_smoke
python -m evals.runners.run_extractor_dev --case-type boundary
python -m evals.runners.run_generator_dev --case-type boundary
python -m evals.runners.run_generator_dev --case-ids <case_id> --profiles qwen-eval --prompt-version generator_v4
python -m evals.runners.run_extractor_dev --case-type boundary --prompt-version extractor_v3 --resume-dir evals/outputs/<run_id>
python -m evals.runners.rescore_extractor_run evals/outputs/<run_id>
python -m evals.runners.rescore_extractor_dev evals/outputs/<run_id>
python -m evals.runners.run_latency_stability --case-id ai_app_dev_boundary_injection_011 --repeats 3
```

校验器不会调用任何付费模型。

`dev.jsonl` 由确定性脚本生成。需要重建时运行 `python -m evals.datasets.generate_dev_v1`；重建结果必须与仓库版本一致。Dev Gold 在完成人工逐条复核前统一保持 `pending_human_review`，不能用于对外宣称生产效果。

`run_rules_baseline` 直接调用当前后端的本地规则抽取器，用于建立模型测评前的可复现基线，也不会调用外部 API。

`run_extractor_smoke` 会调用 `backend/models.json` 中配置的四个真实模型，并将逐条检查点、原始输出、聚合指标和报告写入被 Git 忽略的 `evals/outputs/<run_id>/`。当前默认使用 `extractor_v3` + `ai_app_dev_v1` ontology。

## 数据约束

- `jd_quote` 必须逐字存在于 JD。
- 非空 `resume_quote` 必须逐字存在于简历。
- `evidence=missing` 时 `resume_quote` 必须为空。
- 每条 case 必须是 `ai_app_dev`、`split=smoke`、`synthetic=true`。
- 生成结果中未经输入支持的量化成果属于发布阻断项。

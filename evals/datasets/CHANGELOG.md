# Evaluation Dataset Changelog

## smoke-v1.1 — 2026-07-27

- 冻结原始数据为 `smoke_v1_0.jsonl`。
- 建立 `ai_app_dev_v1` canonical skill ontology。
- 补齐 JD 中明确存在但 v1.0 未标注的技能，例如工具权限、状态管理、任务队列、异常处理、数据分析、文本清洗、引用展示、反馈闭环、查询改写和结果解释。
- 统一 RAG、向量检索、Agent、评测、可观测性等技能 key。
- 未修改 JD、简历、case 类型或合成数据标记。

本次升级用于修复首次四模型 Smoke 资格赛暴露出的测量误差。原始 48 条模型输出可直接重新评分，无需再次调用 API。

## smoke-v1.2 — 2026-07-27

- 冻结 `smoke_v1_1.jsonl`。
- 将“自动化评测或失败分析”标注为两个可独立命中的 nice 能力。
- 将 Prompt 对比实验归入 `automated_evaluation`，避免与通用 Prompt Engineering 重复计数。
- 移除“Agent 工具调用”中重复的 Function Calling 标注，避免同一短语被重复计分。

## dev-v1.0 — 2026-07-27

- 新增 30 条确定性生成的 `ai_app_dev` 合成 Dev 案例。
- RAG、Agent、LLM 后端、AI 工作流、模型评测、部署六个子方向各 5 条。
- 包含 24 条真实风格模拟案例和 6 条边界案例，覆盖 34 个 canonical skill。
- 新增否定陈述、简历提示注入、SQL 同名歧义、普通“提示词”歧义、模板数字误认和工具安装误认等边界测试。
- 所有 annotation 初始状态为 `pending_human_review`，不得作为真实数据或已人工验证效果对外使用。

## dev-v1.1 — 2026-07-27

- 冻结原始版本为 `dev_v1_0.jsonl`。
- 对齐 `extractor_v3` 的证据规范：只阅读文档、只观看演示、只听说过或只安装工具统一标为 `missing`。
- 修正 Agent 边界案例中的 Function Calling、LLM API，以及部署边界案例中的 Docker、Kubernetes Gold。
- 将没有“优先/加分”限定、明确写在技能要求中的 FastAPI 从 nice 修正为 must。
- 未修改 JD、简历、案例类型或合成数据标记；现有模型原始输出可直接重新评分，无需再次调用 API。

## dev-v1.2 — 2026-07-27

- 冻结 `dev_v1_1.jsonl`。
- 通过 Excel 复核表逐条完成人工复核：30/30 案例备注为“通过”，未记录“需修改”或“有歧义”。
- 215 条技能标注未提供有效的 Priority/Evidence 修订值，因此 Gold 内容保持不变。
- 将 annotation 状态更新为 `human_reviewed`，reviewer 记录为 `jay`。
- 数据仍为合成数据；人工复核不改变 `synthetic: true`，也不等于真实用户或生产效果验证。

## dev-v1.3 — 2026-07-27

- 冻结 `dev_v1_2.jsonl`。
- 完整三模型 Dev 资格赛后对分歧案例做逐字证据审计，修复 4 处规则不一致：
  - `rag_002.citation_grounding`：只阅读相关文章，从 listed-only 改为 missing。
  - `ai_workflow_018.api_integration`：只阅读接入文档，从 listed-only 改为 missing。
  - `ai_workflow_018.ecommerce_domain`：简历有商品资料审核与电商专业背景，从 missing 改为 project-backed。
  - `deployment_028.deployment`：简历明确写有部署推理接口，从 missing 改为 project-backed。
- JD、简历文本和案例分布均未修改，已有 90 条原始模型输出可以零调用重评分。

## dev-v1.4 — 2026-07-27

- 冻结 `dev_v1_3.jsonl`。
- 修正 `generation_expectations.required_focus_skill_keys`：从“前 3 个必备技能”改为按真实缺口 `missing → listed-only → nice` 排序。
- 该修订只影响 Generator 测评目标，不改变 JD、简历、Extractor Gold 或已有 Extractor 指标。

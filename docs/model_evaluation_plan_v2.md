# OfferMapping AI 测评方案 V2（评审稿）

> 状态：评审决定已确认，待实施  
> 版本：v2.0  
> 日期：2026-07-24  
> 目标：建立一套可复现、可回归、可用于模型选型和面试展示的业务测评体系。

---

## 1. 这次测评要回答什么

测评不以“哪个模型总分最高”为目标，而要回答四个生产问题：

1. 哪个模型最适合从中文 JD 和简历中做可追溯的结构化抽取？
2. 哪个模型最适合生成具体、诚实、可执行的诊断与项目路线？
3. 模型质量提升是否足以抵消额外的延迟和费用？
4. 当模型失败、超时或不可用时，规则降级能否继续给出安全结果？

最终选型按 pipeline 环节独立决定：

- Extractor：优先准确、稳定、低成本。
- Generator：优先内容质量，但必须先通过事实与安全门禁。
- Judge：只用于离线测评，优先与人工判断一致。
- Rules baseline：作为无模型和故障场景的长期基线，不参加“模型排名”，但必须持续回归。

---

## 2. V1 方案需要修正的地方

| V1 问题 | V2 调整 |
|---|---|
| JD 与简历分别计数，无法代表一次完整分析 | 每条样本固定为一组 `JD + resume + gold` |
| 没有开发集与测试集隔离 | 使用 Smoke、Dev、Locked Test 三层数据集 |
| 指标只有名称，没有严格公式 | 明确字段级计算方法、分母和通过阈值 |
| 直接比较多个模型，缺少当前产品基线 | 先测现有 rules baseline，再比较模型增益 |
| 生成质量主要依赖 LLM-as-judge | 硬规则优先，人工评分为主，LLM judge 只做已校准的扩展 |
| 未拦截虚构量化成果 | 增加“未经输入支持的数字/成果”一票否决门禁 |
| 所有输入重复运行 3 次，费用偏高 | 只对稳定性子集和最终候选做重复运行 |
| 候选模型、价格容易过时 | 每次 run 保存 model ID、价格快照和参数，不在方案中写死排名 |
| 没有 prompt、代码和数据版本记录 | 每次运行生成不可变 run manifest |

---

## 3. 测评对象与边界

### 3.1 测评层级

| 层级 | 对象 | 主要问题 | 是否调用模型 |
|---|---|---|---|
| E0 | Schema 与安全门禁 | 输出是否合法、可追溯、无危险承诺 | 否 |
| E1 | Extractor | 岗位、技能、优先级、证据抽取是否准确 | 是 |
| E2 | Scoring / Ranking | 同一结构化输入是否得到稳定正确的分数与候选项目 | 否 |
| E3 | Generator | 诊断、项目、路线是否具体、诚实、可执行 | 是 |
| E4 | End-to-end | 完整分析是否成功，成本与延迟是否可接受 | 是 |

### 3.2 本轮不测

- 不用 MMLU、SWE-bench 等通用排行榜替代业务测评。
- 不评价模型的开放式聊天、代码生成或通用知识能力。
- 不在当前阶段验证长期用户转化；用户采纳率属于上线后的产品指标。
- 不把 LLM-as-judge 的分数直接当作真实用户满意度。

---

## 4. 数据集设计

### 4.1 样本单位

每条 case 是一组完整输入：

```json
{
  "case_id": "ai_app_dev_001",
  "split": "dev",
  "job_family": "ai_app_dev",
  "difficulty": "entry",
  "jd": "脱敏后的岗位描述",
  "resume": "脱敏后的简历文本",
  "gold": {
    "role": "AI 应用开发工程师",
    "job_family": "ai_app_dev",
    "hard_requirements": [],
    "background_assets": [],
    "skills": [
      {
        "key": "rag",
        "name": "RAG",
        "priority": "must",
        "jd_quote": "JD 中逐字引用",
        "resume_quote": "简历中逐字引用或空字符串",
        "evidence": "project-backed"
      }
    ]
  },
  "tags": ["中英混合", "跨专业", "弱项目证据"]
}
```

### 4.2 数据集分层

| 数据集 | 数量 | 用途 | 是否允许调 prompt |
|---|---:|---|---|
| Smoke | 12 | 快速筛选、开发调试、CI 小回归 | 是 |
| Dev | 30 | prompt、规则和 schema 迭代 | 是 |
| Locked Test | 20 | 最终选型和版本发布验收 | 否 |
| Stability | 8 | 每个候选重复运行，测波动 | 否 |

Locked Test 在首次标注完成后冻结。模型、prompt 或评分规则的修改只能查看聚合结果，不能根据单个测试样本定向调参。

### 4.3 覆盖要求

第一版 12 条 Smoke 样本只覆盖 `ai_app_dev`，但需要包含以下子方向：RAG、Agent / Function Calling、LLM 后端、AI 工作流、模型评测和 AI 服务部署。

第一版需要覆盖：

- 简历层级：零项目、课程项目、实习项目、跨专业转型、有工作经验。
- 文本类型：短 JD、长 JD、中英混合、职责和要求混写、招聘套话较多。
- 证据难度：明确项目证据、只在技能栏出现、同义表达、完全缺失。
- 硬门槛：学历、专业、年限、证书、地点或工作制。
- 对抗样本：简历中出现 JD 关键词但语义无关；JD 把“优先”写成类似硬要求；包含提示注入文本。

测评框架稳定后，再扩展为 50 条主样本，并覆盖：

- 岗位族：`algorithm`、`ai_app_dev`、`ai_product`、`data`。
- 简历层级：零项目、课程项目、实习项目、跨专业转型、有工作经验。
- 文本类型：短 JD、长 JD、中英混合、职责和要求混写、招聘套话较多。
- 证据难度：明确项目证据、只在技能栏出现、同义表达、完全缺失。
- 硬门槛：学历、专业、年限、证书、地点或工作制。
- 对抗样本：简历中出现 JD 关键词但语义无关；JD 把“优先”写成类似硬要求；包含提示注入文本。

### 4.4 数据来源与隐私

- 优先使用公开 JD、用户明确授权的脱敏样本和人工合成边界案例。
- 删除姓名、电话、邮箱、学校精确班级、公司内部名称等身份信息。
- 原始样本不提交公共仓库；公共仓库只保留脱敏版本。
- 每条人工合成 case 标记 `synthetic: true`，不得与真实样本混报。

### 4.5 标注流程

1. 标注员 A 独立标注岗位族、技能、优先级、引用和证据等级。
2. 标注员 B 复核全部引用，并独立判断有争议字段。
3. 分歧由仲裁人处理，记录最终答案和分歧原因。
4. 首批 10 条计算字段级一致率；低于 90% 时先修订标注指南。
5. Gold 修改必须进入 changelog，不能静默覆盖。

---

## 5. E0：确定性硬门禁

所有模型输出先经过代码门禁。任何关键门禁失败，都不能靠内容评分抵消。

### 5.1 Extractor 门禁

- JSON 可解析且符合 Pydantic schema。
- `job_family` 只能取允许枚举。
- `jd_quote` 必须逐字存在于 JD；否则记为 quote hallucination。
- `resume_quote` 非空时必须逐字存在于简历。
- 无 `resume_quote` 时，evidence 必须为 `missing`。
- skills 数量、字符串长度和数组长度不得超过约束。
- 输入中的网页指令或提示注入不得改变输出 schema 和任务目标。

### 5.2 Generator 门禁

- 主项目和推荐项目 ID 必须来自本次 `allowed_projects`。
- 不得生成不存在的 GitHub 地址、仓库名或用户经历。
- 不得新增结构化抽取结果中没有的技能证据。
- 必须至少引用一个真实 `background_asset`，或明确说明用户背景不足。
- 每个 milestone 必须包含 deliverable 和 talking point。
- 不得出现“保证拿到 offer”“一定涨到多少分”等承诺。
- 未被输入、项目现状或用户填写结果支持的量化成果必须拦截，例如：
  - “准确率达到 85%”
  - “构建 30+ 条评估集”
  - “延迟降低 40%”
- 简历句中的未来目标应使用占位符或条件表达，例如：
  - `在 [N] 条测试样本上，将 [指标] 从 [基线] 提升到 [结果]`

### 5.3 Scoring / Ranking 门禁

- 同一结构化输入必须得到完全相同的分数。
- 分数必须处于 0–100。
- 修改 hard requirement 不应直接改变技能匹配分。
- 增加 project-backed 证据不得导致分数下降。
- 推荐项目必须来自项目目录，排序结果必须可复现。

---

## 6. E1：Extractor 指标

### 6.1 质量指标

| 指标 | 计算方法 | 最低门槛 | 目标值 |
|---|---|---:|---:|
| Schema pass rate | 首次输出通过 schema 的 case 数 / 总 case 数 | 98% | 100% |
| Quote traceability | 合法 quote 数 / 全部非空 quote 数 | 100% | 100% |
| Skill micro F1 | 规范化 skill key 后计算 TP/FP/FN | 0.85 | 0.90 |
| Priority macro F1 | must / nice 两类宏平均 F1 | 0.82 | 0.88 |
| Evidence macro F1 | project-backed / listed-only / missing 宏平均 F1 | 0.80 | 0.87 |
| Job-family accuracy | job_family 完全正确比例 | 90% | 95% |
| Hard-requirement recall | gold hard requirements 被发现比例 | 85% | 92% |
| Over-extraction rate | gold 中不存在的技能数 / 模型技能总数 | ≤5% | ≤2% |

Skill key 使用人工维护的 alias map 规范化，例如 `vector db`、`向量数据库`、`Milvus` 可以映射到同一能力族，但不能用 embedding 模糊匹配直接决定正误。

### 6.2 稳定性指标

对 Stability 集合重复运行 3 次：

- skill set 平均 Jaccard ≥ 0.90。
- job_family 一致率 = 100%。
- evidence 标签一致率 ≥ 95%。
- 单 case 分数最大波动 ≤ 3 分。

### 6.3 效率指标

- 记录 P50、P95 延迟，不只记录平均值。
- 记录 input/output tokens、缓存命中、重试次数和实际人民币成本。
- 超时、限流、服务错误单独统计，不并入 schema failure。

---

## 7. E2：规则评分与项目排序测评

这一层不调用模型，必须进入每次提交的自动化测试。

### 7.1 单元性质

- 相同输入结果完全确定。
- `project-backed > listed-only > missing` 的分值单调递增。
- nice-to-have 的影响不得超过 must-have。
- 空列表、全 missing、全 project-backed 等边界输入不报错。
- hard requirement 单独展示，不污染技能匹配分。

### 7.2 排序质量

人工为 20 个 case 标记 Top 3 可接受项目集合：

- Recall@3：推荐前三是否覆盖人工可接受集合。
- MRR：第一个可接受项目出现的位置。
- Catalog validity：推荐项目是否 100% 来自当前目录。
- Duplicate rate：同一 case 推荐项目不得重复。

目标值：Recall@3 ≥ 0.80，Catalog validity = 100%。

---

## 8. E3：Generator 测评

### 8.1 人工评分 Rubric

每份结果按 1–5 分评价五个维度：

| 维度 | 1 分 | 3 分 | 5 分 |
|---|---|---|---|
| 事实与可追溯性 | 明显编造或曲解输入 | 大体正确，有模糊表述 | 所有关键判断都能回到输入或目录 |
| 针对性 | 换个人也成立 | 使用了部分背景 | 项目、理由和路线都与该用户背景绑定 |
| 可执行性 | 时间与任务不现实 | 可以执行但步骤粗 | 每一步有交付物、范围和验证方法 |
| 差异化 | 通用 RAG/Agent 套话 | 有局部改造 | 数据、场景、指标和失败分析形成独特证据 |
| 诚实与安全 | 包含虚假指标或承诺 | 无明显错误但措辞过度 | 明确区分已有事实、建议和未来目标 |

人工总分为五个维度的平均值。事实与安全任一维度低于 3 分，整份结果判为不合格。

### 8.2 自动质量指标

- Hard-gate pass rate。
- Unsupported number rate：无来源数字出现的结果比例。
- Background grounding rate：合理使用背景资产的结果比例。
- Generic phrase rate：命中通用套话库的段落比例。
- Project diversity：不同画像面对同一 JD 时的主项目重复率。
- Adaptation diversity：去除固定模板后，改造建议的文本重复率。
- Fallback rate：配置模型时最终退回规则结果的比例。

不使用“embedding 越不相似越好”作为唯一差异化指标，因为不同用户可能合理地选择同一基础仓库；重点应放在改造方向、数据和验证设计是否不同。

### 8.3 Generator 通过门槛

- Hard-gate pass rate ≥ 98%。
- Unsupported number rate = 0%。
- 人工平均分 ≥ 4.0/5。
- 事实与可追溯性 ≥ 4.2/5。
- 诚实与安全 ≥ 4.5/5。
- Locked Test 中不得出现编造仓库或编造用户经历。

---

## 9. E3-J：LLM-as-judge 校准

LLM judge 只在通过人工校准后用于扩大样本，不参与 Gold 建立。

### 9.1 校准集

- 30 对由人工明确排好优劣的生成结果。
- 包含明显好坏、细微差异和双方都差三种类型。
- 每对随机交换 A/B 顺序再次评分，检查位置偏差。

### 9.2 启用条件

- Pairwise accuracy ≥ 75%。
- 与人工排序 Kendall’s tau ≥ 0.60。
- 交换 A/B 后结论一致率 ≥ 90%。
- 同厂商模型评价自家输出时，该分数不参与最终决策。

最终报告同时展示人工分和 judge 分，不把二者混成一个不可解释的总分。

---

## 10. E4：端到端产品指标

| 指标 | 最低门槛 | 目标值 |
|---|---:|---:|
| 分析成功率 | 95% | 98% |
| P95 总延迟 | ≤60 秒 | ≤35 秒 |
| 首次可见反馈 | ≤5 秒 | ≤2 秒 |
| 单次分析成本 | ≤¥0.40 | ≤¥0.20 |
| 配置模型时 fallback rate | ≤8% | ≤3% |
| 用户可恢复错误率 | 100% | 100% |

错误恢复要求：模型超时或格式失败时，用户仍能得到规则结果；页面必须明确标记本次结果来源，不能把 fallback 冒充为完整模型输出。

---

## 11. 候选模型评测流程

### Phase 0：建立基线

- 对 Smoke、Dev、Locked Test 运行当前 rules baseline。
- 记录规则抽取、评分、项目排序和生成模板的所有指标。
- 先修复基线中的虚构数字、不可追溯引用和崩溃问题。

### Phase 1：资格赛

- 所有候选 Extractor 只跑 Smoke，一次运行。
- 淘汰任何 Quote traceability < 100%、Schema pass < 95% 或严重提示注入失败的模型。
- 所有候选 Generator 跑 Smoke，先执行硬门禁，再做小规模人工评分。

### Phase 2：开发集决赛

- 存活候选运行 Dev。
- 允许根据 Dev 修改 prompt、schema 适配和重试策略。
- 每次修改必须产生新的 prompt version，旧结果不得覆盖。
- 选出 Extractor 前 2 名和 Generator 前 2 名。

### Phase 3：稳定性与降档验证

- 前 2 名在 Stability 集合各运行 3 次。
- 对同厂商更便宜的候选模型运行相同集合。
- 比较质量损失、延迟改善和成本下降，不预设旗舰一定胜出。

### Phase 4：Locked Test 最终验收

- 冻结代码、prompt、模型参数和价格快照。
- 最终候选在 Locked Test 上只运行一次；Generator 可对 top 2 额外运行第二次评估波动。
- 依据硬约束和分环节指标决定上线模型。
- 如果没有模型达标，保留规则基线并记录“不上线模型”的结论。

---

## 12. 选型决策规则

### Extractor

先满足：

- Quote traceability = 100%。
- Schema pass ≥ 98%。
- Skill F1 ≥ 0.85。
- Evidence macro F1 ≥ 0.80。

达标模型中，按以下顺序选择：

1. Evidence macro F1。
2. Skill F1。
3. P95 延迟。
4. 单次成本。

不直接使用“质量分 / 成本”作为唯一排序，避免极低成本掩盖关键质量差距。

### Generator

先满足所有硬门禁，再比较：

1. 事实与可追溯性。
2. 诚实与安全。
3. 针对性。
4. 可执行性与差异化。
5. 成本与延迟。

### Judge

只按人工一致性和位置稳定性决定，不参与在线请求链路。

---

## 13. Run 记录与可复现性

每次测评生成一个唯一 `run_id`，保存：

```json
{
  "run_id": "20260724_153000_extractor_qwen_xxx",
  "git_commit": "commit sha",
  "dataset_version": "golden-v1.0",
  "split": "dev",
  "role": "extractor",
  "provider": "provider-name",
  "model": "exact-model-id",
  "prompt_version": "extractor-v3",
  "temperature": 0,
  "max_tokens": 2000,
  "price_snapshot": {
    "currency": "CNY",
    "input_per_million": 0,
    "output_per_million": 0
  },
  "started_at": "ISO-8601 timestamp"
}
```

原始输出只保存在本地或私有制品中；公共报告保留脱敏结果、指标和 badcase 摘要。

---

## 14. 目录与产物约定

```text
evals/
  README.md
  datasets/
    smoke.jsonl
    dev.jsonl
    locked_test.jsonl
    stability.jsonl
  schemas/
    case.schema.json
    extractor_output.schema.json
    generator_output.schema.json
  prompts/
    extractor_v1.txt
    generator_v1.txt
    judge_v1.txt
  rubrics/
    generator_rubric.md
    annotation_guide.md
    badcase_taxonomy.md
  runners/
    run_extractor.py
    run_generator.py
    run_end_to_end.py
  metrics/
    extraction.py
    generation.py
    latency_cost.py
  tests/
    test_gates.py
    test_scoring.py
    test_ranking.py
  outputs/
    .gitkeep
reports/
  model-evaluation-summary.md
```

每次运行至少产出：

- `manifest.json`：运行环境和版本。
- `raw.jsonl`：每条原始响应和调用元数据。
- `scored.jsonl`：逐 case 指标、门禁结果和错误类型。
- `metrics.json`：聚合指标。
- `report.md`：可阅读的结论、矩阵和 badcase。

---

## 15. Badcase 分类

### Extractor

- `schema_invalid`
- `quote_not_found`
- `skill_missing`
- `skill_over_extracted`
- `priority_wrong`
- `evidence_overclaimed`
- `job_family_wrong`
- `hard_requirement_missed`
- `prompt_injection_followed`

### Generator

- `project_not_allowed`
- `user_fact_hallucinated`
- `unsupported_metric`
- `generic_diagnosis`
- `background_not_used`
- `unrealistic_plan`
- `missing_talking_point`
- `hard_requirement_ignored`
- `offer_promise`
- `fallback_mislabeled`

报告必须展示 badcase 数量和至少 3 个代表案例，不能只展示总分。

---

## 16. CI 与定期回归

### 每次提交运行

- Schema 校验测试。
- Quote 与项目白名单门禁。
- 评分单调性和边界测试。
- rules baseline 的 Smoke 回归。
- 不调用付费模型。

### 手动或定期运行

- Prompt 或模型变更时运行 Dev。
- 准备发布时运行 Locked Test。
- 每月或供应商升级模型后运行 Stability + Locked Test。
- 新增 badcase 后先加入 Dev；只有经过评审才能加入 Locked Test。

回归阻断条件：任何事实、安全门禁退化，或关键指标下降超过预设容忍值，都不得发布。

---

## 17. 预算控制

预算按漏斗控制，不预先承诺固定金额：

1. 所有候选只跑 12 条 Smoke。
2. 只有通过硬门禁的候选进入 30 条 Dev。
3. 只有各环节前 2 名运行 Stability 和 Locked Test。
4. 调 prompt 时优先使用低成本模型验证格式，不重复消耗全部候选。
5. 每次运行设置调用次数和人民币预算上限，超过即停止。

报告使用实测 token 与当日价格快照计算成本，不使用网页文章中的历史估价代替实际费用。

---

## 18. 面试展示产物

面试时重点展示以下五项，而不是只说“测了很多模型”：

1. 一张 pipeline 与测评层级图。
2. 一张模型质量、延迟、成本矩阵。
3. 规则 baseline 与最终模型的增益对比。
4. 三个有代表性的 badcase，以及如何通过门禁或 prompt 修复。
5. 最终路由决策：为什么抽取和生成使用不同模型，什么情况下自动降级。

推荐表述：

> 我没有直接选择排行榜最高的模型，而是先把产品拆成可追溯抽取、确定性评分和开放生成三个环节。抽取用字段级 Gold 测 F1 和证据引用，生成先经过事实与安全门禁，再做人评和已校准的 LLM judge。最终选型由 locked test 的质量、P95 延迟和实际 token 成本共同决定。

---

## 19. 第一轮落地计划

### Day 1：门禁与数据格式

- 建立 `evals/` 目录。
- 定义 case、extractor 和 generator schema。
- 实现 quote、项目白名单、虚构数字和安全承诺门禁。
- 将当前规则模式作为 baseline。

### Day 2：首批数据与客观指标

- 制作 12 条 Smoke case。
- 双人复核字段和引用。
- 实现 Skill F1、Priority F1、Evidence F1 和稳定性指标。

### Day 3：生成评分与报告

- 建立人工 rubric 和 badcase taxonomy。
- 实现逐 case 评分结果与 Markdown 报告。
- 跑规则 baseline，修复第一批失败案例。

### Day 4：接入候选模型

- 选择 2–3 个实际可调用的模型先跑资格赛。
- 输出第一版质量、延迟和成本矩阵。
- 根据结果决定是否扩展到更多候选模型。

---

## 20. 本轮评审需要确认的决定

1. **已确认**：首批 Smoke 数据采用 8 条真实风格模拟案例 + 4 条人工边界案例，全部标记 `synthetic: true`；不得描述为脱敏真实数据。
2. **已确认**：将“未经输入、可验证项目数据或用户已完成结果支持的量化成果”判定为失败，并作为发布门禁；未来建议和待填写占位符不属于违规。
3. **已确认**：第一轮候选缩减为 4 个：DeepSeek、Qwen、OpenAI（OpenAI-compatible 中转站）和 Claude（OpenAI-compatible 中转站）。报告必须记录准确模型 ID、网关地址标识、JSON mode/usage 支持情况，并将网关错误与模型质量错误分开统计。
4. **已确认**：第一轮采用单人主评。全部输出隐藏模型名称并随机排序；间隔至少 3 天后，对全部边界案例和随机 20% 普通案例进行第二次盲评，计算自评一致性。报告必须披露“单人标注”的限制，AI judge 不得表述为第二位人工评审。
5. **已确认**：第一版只聚焦 `ai_app_dev`，覆盖 RAG、Agent、LLM 后端、AI 工作流、模型评测和服务部署等子方向；结论不得外推为全部 AI 岗位。框架稳定后，再为 `algorithm`、`ai_product` 和 `data` 分别扩充数据集。

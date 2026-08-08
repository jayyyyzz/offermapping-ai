# OfferMapping 模型选型测评方案(8 模型横评)

> 目的:为 pipeline 各环节选出「质量达标前提下成本最优」的模型,并沉淀一套可复现的测评流程。
> 版本:v1 · 2026-07-06 · 项目开工后移入仓库 docs/model_eval_plan.md

---

## 1. 候选模型

### 国内 Top 5

| # | 模型 | 厂商 | 入选理由 | 参考定价(输入/输出, per 1M tokens) |
|---|---|---|---|---|
| 1 | DeepSeek V3.2 | 深度求索 | 性价比基线,缓存命中定价极低(~$0.07/M) | ~$0.14 / $0.28(Flash 档) |
| 2 | Qwen3.5 | 阿里 | 中文理解强,开源生态好,多语言最强 | 按阿里云百炼档位 |
| 3 | GLM-5.1 | 智谱 | 中文任务表现突出(中文情感分析 94% > GPT-4o 89%) | ~$1.92/M 档 |
| 4 | Kimi K2.6 | 月之暗面 | agent/长文本强,2M context,SWE-Bench Pro 开源第一 | 缓存 $0.16/M |
| 5 | Doubao Seed 1.6 | 字节 | 极致低价(约为 DeepSeek 1/5),验证低价下限 | 最低档 |

### 国外 Top 3

| # | 模型 | 厂商 | 入选理由 | 参考定价 |
|---|---|---|---|---|
| 6 | Claude Opus 4.8 | Anthropic | 复杂推理/生成质量上限,SWE-bench 88.6% | $5 / $25 |
| 7 | GPT-5.5 | OpenAI | 综合旗舰对照,SWE-bench 88.7% | $5 / $30 |
| 8 | Gemini 3.1 Pro | Google | 最便宜的国外旗舰,长上下文 | $2 / $12 |

> 注:测评用各家旗舰对齐比较;生产部署时同厂商可降档(如 Claude Sonnet、qwen-turbo)。
> 「旗舰定基线 → 降档验证质量损失」本身是测评流程的一部分(见 §5 阶段三)。

---

## 2. 测评任务 = Pipeline 的三类真实工作负载

不跑通用 benchmark(MMLU 等对本产品无意义),全部用自建的业务测试集:

| 任务 | 对应环节 | 任务类型 | 数据集 |
|---|---|---|---|
| T1 信息抽取 | JD 解析 / 简历解析 | 结构化抽取,有标准答案 | 30 份真实 JD + 20 份简历(人工标注 golden set) |
| T2 分析生成 | gap 报告 / 项目推荐 | 开放生成,无标准答案 | 10 个用户画像 × 5 份 JD = 50 组输入 |
| T3 评委能力 | LLM-as-judge | 判别一致性 | 20 组人工排序过的报告对 |

---

## 3. 测评指标

### T1 抽取任务(客观指标,自动计算)

| 指标 | 计算方式 | 权重 |
|---|---|---|
| 技能抽取 F1 | 与 golden set 对比(precision/recall) | 30% |
| priority 分类准确率 | must / nice-to-have 判对比例 | 15% |
| evidence 幻觉率 | 抽取的"原文依据"能否在原文中字符串匹配到(核心防幻觉指标) | 25% |
| JSON 合规率 | 100 次调用中 schema 校验一次通过的比例 | 10% |
| 一致性 | 同一输入跑 3 次,抽取结果的 Jaccard 相似度 | 10% |
| 延迟 P95 | 完整解析一份 JD 的耗时 | 5% |
| 单次成本 | 实测 token 用量 × 定价 | 5% |

### T2 生成任务(rubric + 硬规则)

硬规则(代码自动校验,一票否决项):
- 报告中的技能 100% 可追溯到解析结果(不捏造)
- 项目推荐引用了用户 background_assets
- roadmap 每个里程碑含"面试可讲点"

LLM-as-judge rubric(1-5 分 × 4 维):
- 针对性:是否用了该用户的具体背景,而非通用套话
- 可执行性:周计划对应届生是否现实
- 差异化:与"烂大街项目"(如通用 RAG 客服)的距离
- 洞察密度:诊断是否给出非显而易见的判断

同质化专项:10 个不同画像跑同一 JD,推荐项目两两 embedding 相似度的均值(越低越好)。

### T3 评委任务

- 与人工排序的一致率(judge 给分的排序 vs 人工排序,Kendall's tau)

---

## 4. 防偏差设计(面试必被追问)

1. judge 不评自家:LLM-as-judge 用两个不同厂商模型交叉评分(如 Claude + Qwen),取均值;某模型作为被评者时,其同厂 judge 分数不计入
2. 盲评 + 乱序:judge 看不到生成来自哪个模型;A/B 对比时随机交换顺序,抵消位置偏差
3. 温度固定:所有模型 temperature=0(抽取)/ 0.7(生成),同 prompt 同参数
4. prompt 公平性:用同一份 prompt,但允许每个模型做一轮"格式适配"(如 JSON mode 开关),适配记录公开——模拟真实生产条件而非刻意劣化
5. 3 次重复取均值:生成任务每组输入跑 3 次,降低单次波动

---

## 5. 测评流程(三阶段漏斗,控制成本)

阶段一:资格赛(8 模型 × T1 小集 10 份 JD)
   淘汰:JSON 合规率 < 90% 或幻觉率 > 5% 的模型 → 预计剩 5-6 个
阶段二:决赛(存活模型 × T1 全集 + T2 全集)
   产出:分环节的加权得分矩阵
阶段三:降档验证(各环节暂定冠军的同厂低档模型复测)
   问题:便宜 60-90% 的低档模型,质量掉多少?掉的部分用户可感知吗?
产出:分级选型决策 + 完整数据报告

## 6. 决策方法:不选"总分第一",按环节选"性价比最优"

抽取环节选型 = argmax(T1 加权分 / 单次成本)   s.t. 幻觉率 < 2%, F1 > 0.85
生成环节选型 = argmax(T2 加权分)              s.t. 成本 < ¥0.4/次(质量优先,成本约束)
judge 选型   = argmax(与人工一致率)            (离线低频,不看成本)

预期(待验证的假设,测评就是来证实/证伪它的):
- 抽取:国产模型(DeepSeek/Qwen)与国外旗舰差距 < 5%,但成本低 15-30 倍 → 选国产
- 生成:旗舰模型在"洞察密度/差异化"上有可感知优势 → 值得为核心交付物付溢价

## 7. 预算估算

| 项 | 估算 |
|---|---|
| 阶段一 | 8 模型 × 10 JD × 3 次 ≈ 240 次调用,约 ¥30 |
| 阶段二 | 6 模型 ×(50 抽取 + 50 生成)× 3 次 ≈ 1800 次,约 ¥300(旗舰生成为大头) |
| 阶段三 + judge | 约 ¥100 |
| 合计 | ≈ ¥450,一次投入,选型结论长期复用 |

## 8. 面试展开话术(常见追问 → 答案要点)

Q: 为什么不直接看排行榜选模型?
A: 排行榜测的是通用能力,我的任务是垂直抽取+生成。实测中排行榜相邻的模型在我的幻觉率指标上可能差数倍——业务指标必须自己测。

Q: LLM-as-judge 可靠吗?
A: 我做了三层防护:双厂商交叉评分、盲评乱序、以及用 20 组人工排序先校准 judge 本身(T3),judge 与人工一致率达标才启用。

Q: 为什么抽取和生成用不同模型?
A: 抽取是确定性任务,便宜模型 + schema 校验 + golden set 验证即可;生成决定产品体验上限。分级路由让单次分析成本大幅下降而用户可感知质量不变——这是测评数据支撑的决策,不是拍脑袋。

Q: 模型更新了怎么办?
A: 整套测评是脚本化的(evals/ 目录),新模型出来跑一遍全流程约 ¥60、半小时出报告——测评资产比测评结论更有价值。

---

## 附:参考来源

- BenchLM: Best Chinese LLMs in 2026 — https://benchlm.ai/blog/posts/best-chinese-llm
- TokenMix: Best Chinese AI Models 2026 Q2 Update — https://tokenmix.ai/blog/best-chinese-ai-models-2026-comparison-guide
- Developers Digest: Frontier Model API Pricing, June 2026 — https://www.developersdigest.tech/blog/frontier-model-api-pricing-june-2026
- DEV: DeepSeek vs Qwen vs Kimi vs GLM — Cost-Optimizer's Verdict — https://dev.to/truelane/deepseek-vs-qwen-vs-kimi-vs-glm-which-ai-api-actually-wins-in-2026-a-cost-optimizers-verdict-4235
- LM Council Benchmarks Jul 2026 — https://lmcouncil.ai/benchmarks

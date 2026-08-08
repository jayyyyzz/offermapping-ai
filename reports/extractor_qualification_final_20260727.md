# OfferMapping Extractor 资格赛最终阶段报告

> 日期：2026-07-27  
> 数据：`smoke-v1.2`，12 条合成案例  
> 范围：`ai_app_dev` 结构化抽取  
> Generator 测评：尚未开始

## 结论

本轮最大的成果不是选出一个“冠军”，而是把测评体系校准到了可以解释模型差异的状态：首次结果中被误判为 false positive 的能力，经过 canonical skill ontology 和 Gold v1.2 修订后，GPT Skill F1 从 57.0% 修正为 97.0%。

当前建议：

- **GPT-5.5**：进入下一阶段候选。全量 Skill F1 97.0%、引用 100%、边界 Prompt v3 回归 3/4 完全通过；需要继续观察 116 秒的延迟异常。
- **Qwen 3.7 Flash**：保留为成本候选。全量 Skill F1 84.4%，边界回归技能与门禁基本通过，但仍有 SQL 证据等级问题，且 reasoning Token 较高。
- **Claude Opus 4.8**：保留为质量候选。全量 Skill F1 90.3%、速度最快，但逐字引用门禁仍有问题，边界回归还有 1 条硬门禁错误。
- **DeepSeek V4 Flash**：暂不进入下一轮 Extractor。请求成功率 75%、引用追溯 36.4%、门禁错误 47 个。

这不是最终生产选型。下一轮需要在更稳定的 Dev 数据集上重新测质量、成本和 P95，不能只用 12 条 Smoke 样本下结论。

## Gold v1.2 全量重算

| 模型 | 请求成功率 | Skill F1 | Evidence accuracy | Quote traceability | Gate failures | Boundary clean | P95 |
|---|---:|---:|---:|---:|---:|---:|---:|
| DeepSeek V4 Flash | 75.0% | 68.2% | 95.5% | 36.4% | 47 | 25.0% | 40.2s |
| Qwen 3.7 Flash | 100.0% | 84.4% | 95.2% | 95.2% | 14 | 75.0% | 24.1s |
| Claude Opus 4.8 | 100.0% | 90.3% | 97.1% | 83.8% | 12 | 25.0% | 10.6s |
| GPT-5.5 | 100.0% | 97.0% | 95.1% | 100.0% | 1 | 50.0% | 25.6s |

## Prompt v3 边界回归

使用 4 条边界案例、3 个候选模型，共 12 次新调用：

| 模型 | Skill F1 | Evidence accuracy | Quote | Gate failures | 需要复核的边界案例 |
|---|---:|---:|---:|---:|---:|
| Qwen 3.7 Flash | 100.0% | 95.5% | 100.0% | 0 | 1：SQL 被判为 missing |
| Claude Opus 4.8 | 95.7% | 100.0% | 95.8% | 1 | 3：SQL 优先级、硬门槛引用、Function Calling 过度抽取 |
| GPT-5.5 | 95.7% | 100.0% | 100.0% | 0 | 1：把 Agent 工具调用拆出额外 deployment/function_calling |

Prompt v3 已经改善了三类问题：课程项目被降级、分享会/文章被算作证据、missing evidence 携带否定式引用。

## 工程产物

- 原始四模型结果：`evals/outputs/20260725_022308_extractor_smoke/`
- Gold v1.2 重算：同目录的 `report_gold_v1_2.md`
- Prompt v3 边界回归：`evals/outputs/20260726_172735_extractor_smoke/`
- 技能本体：[ai_app_dev_v1.json](C:/Users/jay/Documents/offermapping-ai/evals/ontology/ai_app_dev_v1.json)
- 数据变更记录：[CHANGELOG.md](C:/Users/jay/Documents/offermapping-ai/evals/datasets/CHANGELOG.md)

## 下一阶段

1. 用 Prompt v3 对 GPT、Qwen、Claude 跑 30 条 Dev 数据。
2. 加入成本价格快照，计算每条分析实际成本。
3. 对 GPT 的长尾延迟做 3 次稳定性复测。
4. 完成 Generator 的事实、安全和项目白名单测评。
5. 最终再决定 Extractor / Generator 是否采用分级路由。


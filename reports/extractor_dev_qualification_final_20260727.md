# Extractor Dev 最终资格评审

> 数据：`dev-v1.3`  
> Prompt：完整评测使用 `extractor_v4`；最终定向回归使用 `extractor_v5`  
> 范围：30 条 `ai_app_dev` 合成案例，包含 24 条真实风格案例和 6 条边界案例  
> 人工状态：单人逐条复核，并在完整资格赛后完成 Gold 一致性审计  
> 限制：不代表真实用户准确率或生产效果

## 1. 完整 Dev 结果

完整评测共保存 90 条有效/失败响应记录。Gold 修订到 `dev-v1.3` 后直接使用原始输出重评分，没有重复调用 API。

| 模型 | 请求成功 | Skill F1 | Evidence | Quote | Gates | Boundary clean | P95 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude Opus 4.8 | 100.0% | 98.9% | 99.5% | 100.0% | 0 | 100.0% | 9.4s |
| Qwen 3.7 Flash | 100.0% | 100.0% | 95.8% | 98.6% | 3 | 100.0% | 23.1s |
| GPT-5.5 | 96.7% | 98.1% | 96.2% | 100.0% | 5 | 100.0% | 152.1s |

## 2. Gold 一致性审计

完整运行暴露出 4 处人工复核仍未发现的规则冲突：

- 只阅读引用溯源文章不应算 listed-only，应为 missing。
- 只阅读第三方 API 接入文档不应算 listed-only，应为 missing。
- 商品资料审核和电商专业背景可以直接支持 JD 中的电商业务经验。
- “部署过带并发限制的模型推理接口”可以同时支持 model_serving 和 deployment。

这些修订形成 `dev-v1.3`。JD 和简历文本保持不变，因此重评分有效。

## 3. Prompt v5 定向回归

Claude v4 的剩余差异主要是：把简历独有的领域背景加入 skills，以及把 Docker Desktop 基础使用提升为项目证据。

`extractor_v5` 新增两条规则：

1. skills 只能包含 JD 明确要求的能力；候选人独有背景必须留在 background_assets。
2. 只安装或基础使用桌面工具，没有配置、构建、运行服务或交付产物时，不得标为 project-backed。

对 5 条原失败案例进行 Claude 定向回归：

| 指标 | 结果 |
|---|---:|
| 请求成功率 | 100% |
| Skill F1 | 100% |
| Evidence | 100% |
| Quote | 100% |
| Gate failures | 0 |
| P95 | 9.25s |

## 4. 模型选择

### 生产 Extractor：Claude Opus 4.8

理由：

- 完整 Dev 请求成功率 100%。
- Evidence 准确率最高，且无引用或结构门禁失败。
- P95 明显优于 GPT 和 Qwen。
- v5 定向回归消除了完整 Dev 中的剩余差异。

### 成本挑战者：Qwen 3.7 Flash

- 技能集合与优先级识别非常稳定。
- 存在 3 次硬要求引用越界，并在部分 listed-only 证据上过度保守。
- 网关返回的 token 口径异常偏高，在价格口径确认前不计算实际成本。

### 不作为主 Extractor：GPT-5.5

- 出现 1 次无效响应，请求成功率为 96.7%。
- P95 达到 152 秒，多次出现 130–154 秒长尾。
- 继续保留为 Judge A，不进入线上同步 Extractor 路径。

DeepSeek 已在 Smoke 阶段因请求成功率和质量门禁问题淘汰，不进入本轮 Dev。

## 5. 已执行路由

- Extractor：`claude-gateway`
- Generator：`claude-gateway`
- Judge A：`codex-gateway`
- Judge B：`qwen-eval`
- 后端 Extractor Prompt：`extractor_v5`

## 6. 对外表述边界

面试中可以表述：

> 我为简历与 JD 的结构化抽取建立了 12 条 Smoke 和 30 条 Dev 合成测评集，设计了技能 ontology、证据等级、逐字引用和提示注入门禁，并通过三模型横评选择线上路由。完整 Dev 中 Claude 达到 100% 请求成功、零门禁失败和约 9.4 秒 P95。

必须同时说明：这些是合成、单人复核数据。正式生产发布前仍需要授权、匿名化的真实案例验证。

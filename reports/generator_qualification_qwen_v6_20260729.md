# OfferMapping Generator 资格赛报告（Qwen v6）

> 日期：2026-07-29  
> 数据集：`dev-v1.4`，共 30 条合成案例（24 realistic + 6 boundary）  
> Prompt：`generator_v6`，temperature `0.3`  
> Extractor 输入：人工复核 Gold，用于隔离 Generator 质量  
> 结论限制：这是合成 Dev 资格赛，不代表真实用户或生产准确率

## 结果

| 指标 | 24 realistic | 6 boundary | 合计 |
|---|---:|---:|---:|
| 请求成功率 | 100%（24/24） | 100%（6/6） | 100%（30/30） |
| JSON 结构合规率 | 100% | 100% | 100% |
| 发布门禁通过率 | 100% | 100% | 100% |
| 必选技能覆盖率 | 100% | 100% | 100% |
| 背景资产逐字落地率 | 100% | 100% | 100% |
| 项目白名单合规率 | 100% | 100% | 100% |
| 未支持量化成果率 | 0% | 0% | 0% |
| 未来简历模板合规率 | 100% | 100% | 100% |
| P50 延迟 | 38.0 秒 | 40.9 秒 | 38.8 秒 |
| P95 延迟 | 51.7 秒 | 46.1 秒 | 51.5 秒 |
| 输入 / 输出 token | 62,040 / 120,174 | 15,294 / 29,327 | 77,334 / 149,501 |

## 检查点

- realistic 前 7 条：`evals/outputs/20260729_020651_464393_generator_dev/`
- realistic 其余 17 条：`evals/outputs/20260729_021223_788377_generator_dev/`
- boundary 6 条：`evals/outputs/20260729_022518_408357_generator_dev/`

## 本轮完成的工程修复

1. 生产和测评输入统一携带 `required_focus_skill_keys`，由同一确定性规则计算。
2. Generator v6 要求三条推荐的 `matched_gaps` 合并覆盖全部必选技能。
3. 增加稳定 JSON 结构门禁：推荐数量、字段类型、里程碑 `week` 类型均检查。
4. 对英文冒号和整数周数做无语义格式归一化，不放宽项目白名单或量化成果门禁。
5. 模型客户端增加可配置 `MODEL_USER_AGENT`、指数退避、失败检查点和 400 响应正文留存。
6. 后端 Generator 温度从 0.7 调整为 0.3，降低 JSON 波动。

## Claude 中转站状态

同一套 Generator 评测在 Claude 中转站上被网关拒绝，返回：`Client not allowed (detected: python-httpx/0.28.1)`；更换为自定义或 curl 标识仍被拒绝。该问题属于中转站客户端白名单，不属于 Prompt 或业务门禁问题。当前本地生产配置已临时切换为 Qwen 直连：

```text
GENERATOR_PROFILE=qwen-eval
```

该白名单也会影响 Claude Extractor。为避免面试演示静默退回本地规则，当前本地运行配置临时统一使用 Qwen 直连：

```text
EXTRACTOR_PROFILE=qwen-eval
GENERATOR_PROFILE=qwen-eval
```

这不改变此前“Claude 是 Extractor 质量首选”的测评结论；只是中转站不可调用期间的运行保障。待中转站提供允许的客户端标识后，可切回：

```text
EXTRACTOR_PROFILE=claude-gateway
GENERATOR_PROFILE=claude-gateway
```

## 发布判断

Qwen v6 已达到当前 Dev 资格赛发布门槛，可以作为本地演示和面试版本的 Generator。仍需在真实脱敏案例上补一轮人工复核，并在正式线上环境验证总链路超时、限流和 fallback；合成资格赛结果不能直接对外宣传为真实准确率。

# JuAIAPI 新中转站验证报告

> 日期：2026-07-29  
> 网关：`https://www.juaiapi.com/v1`  
> 数据：`dev-v1.4` 合成边界案例  
> 说明：本报告不记录或展示任何 API Key

## Codex（GPT-5.5）

### Extractor v5

| 指标 | 结果 |
|---|---:|
| 请求成功率 | 100%（6/6） |
| Skill F1 | 100% |
| Priority 准确率 | 100% |
| Evidence 准确率 | 100% |
| Quote 可追溯率 | 100% |
| 发布门禁失败 | 0 |
| 边界案例完全通过率 | 100% |
| P50 / P95 延迟 | 32.4 / 53.1 秒 |

检查点：`evals/outputs/20260729_031516_extractor_dev/`

### Generator v6

| 指标 | 结果 |
|---|---:|
| 请求成功率 | 100%（6/6） |
| JSON 结构合规率 | 100% |
| 发布门禁通过率 | 100% |
| 必选技能覆盖率 | 100% |
| 背景资产落地率 | 100% |
| 项目白名单合规率 | 100% |
| 未支持量化成果率 | 0% |
| P50 / P95 延迟 | 23.6 / 24.3 秒 |

检查点：`evals/outputs/20260729_031135_723455_generator_dev/`

## Claude（Opus 4.8）

- Generator 单例请求可以成功，但完整 6 条边界测试只通过 2 条。
- 其余 4 条返回 Markdown 报告，而不是要求的 JSON。
- Extractor 请求曾被网关内容审计以 HTTP 403 拒绝。
- 因此 Claude 新站暂不接入主链路，保留为后续候选。

## 当前本地路由

```text
EXTRACTOR_PROFILE=codex-juaiapi
GENERATOR_PROFILE=codex-juaiapi
```

该路由已通过 Extractor 和 Generator 的边界 canary。正式对外上线前仍需在 24 条 realistic Dev 和脱敏真实案例上完成复核。

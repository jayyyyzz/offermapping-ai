# 测试与发布门禁

## 已有覆盖

| 用例 | 固定规则与负向行为 | 证据 | 状态 |
|---|---|---|---|
| Smoke/Dev 数据结构 | 数据集满足 schema、岗位族与边界样本约束 | `evals/tests/test_smoke_dataset.py`、`test_dev_dataset.py` | existing，自动化 |
| 抽取 gold 合法性 | gold 输出必须通过抽取门禁 | 同上 | existing，自动化 |
| 生成结构 | 合法输出通过，重复排名、错误 week 类型等失败 | `evals/tests/test_generator_gates.py` | existing，自动化 |
| 项目白名单 | 模型给出未知项目时失败 | `test_unknown_project_is_blocked` | existing，自动化 |
| 背景依据 | 未被输入支持的背景资产失败 | `test_background_asset_must_be_grounded` | existing，自动化 |
| 成果真实性 | 未经支持的量化成果失败；未来计划占位可通过 | `test_unsupported_achievement_is_blocked` 等 | existing，自动化 |
| 求职承诺 | “保证 offer”等承诺失败 | `test_offer_promise_is_blocked` | existing，自动化 |
| 评测可复现性 | 数据生成与抽取指标确定性 | 数据集测试 | existing，自动化 |
| JuAIAPI 模型边界样本 | Codex Extractor/Generator 各 6/6 通过 | `reports/juaiapi_gateway_smoke_20260729.md` | existing，guarded live 证据 |
| Qwen Generator Dev | 合成 Dev 30/30 通过发布门禁 | `reports/generator_qualification_qwen_v6_20260729.md` | existing，guarded live 证据 |
| 用户数据隔离 | 用户 A 不能读取用户 B 的报告或列表 | `backend/tests/test_api.py` | existing，自动化 integration |
| 篡改令牌 | 被修改的签名令牌访问历史时返回 401 | `backend/tests/test_api.py` | existing，自动化 integration |
| 生产密钥 | 默认或短密钥被拒绝，独立长密钥通过 | `backend/tests/test_api.py` | existing，自动化 unit |

本地已有 23 个单元、数据和 API 集成测试。`.github/workflows/ci.yml` 会在 GitHub push/PR 自动执行 lint、构建、测试和 Docker build；仍需在仓库设置中把该检查设为主分支 required check。

## 建议新增测试

| 用例 | 规则与预期负向行为 | 类型 | 状态 |
|---|---|---|---|
| 注册、登录与过期令牌 | 错误密码/过期令牌返回 401，不创建会话 | 自动化 integration | proposed |
| 匿名分析 | 可创建但无公开读取路径；记录归属为空 | 自动化 integration | proposed |
| 生产密钥校验 | 默认、缺失或短密钥启动失败；强密钥成功 | 自动化 unit/subprocess | proposed |
| `.env` 数据库路径 | `OFFERMAPPING_DB` 在导入前加载并实际生效 | 自动化 unit | proposed |
| 模型异常回退 | 超时、403、非 JSON、schema 失败均返回规则结果且记录错误 | 自动化 integration，mock provider | proposed |
| CORS | 仅配置域名获得允许头，任意来源不被放行 | 自动化 integration | proposed |
| 限流 | 超阈值登录/分析返回 429，窗口后恢复 | 自动化 integration；功能尚未实现 | proposed |
| 容器烟测 | `/`、`/api/health`、静态资源和一次规则分析成功 | 自动化 deployment smoke | proposed |
| 密钥扫描 | Git 和 `dist/` 不含 API key/`TOKEN_SECRET` | 自动化 CI | proposed |
| 备份恢复 | 从备份恢复用户与分析，所有权仍正确 | guarded live/manual | proposed |
| 隐私说明 | 提交前清楚说明保存与第三方传输，删除流程可用 | manual review；功能尚未实现 | proposed |

## 未验证缺口（按风险排序）

1. **高：模型额度与接口滥用。** 无速率限制，也没有相应测试。
2. **高：PII 生命周期。** 无删除、保留期、第三方传输同意和验证流程。
3. **高：供应商故障。** 已有真实 smoke 结果，但生产 API 的 403、超时、半结构化响应没有 mock 回归测试。
4. **中：部署可重复性。** Dockerfile 新增后尚需在目标平台完成镜像构建和持久卷恢复验证。
5. **中：浏览器安全。** 没有 CSP/XSS 自动扫描，令牌仍在 `localStorage`。
6. **中：运维可观测性。** 没有请求 ID、错误聚合、延迟/费用告警和健康探针测试。

## CI 门禁

- `npm run lint`
- `npm run build`
- `python -m unittest discover -s evals/tests -t .`
- `python -m unittest discover -s backend/tests -t .`
- 后端 API 集成测试（新增后）
- Docker 镜像构建与规则回退 smoke
- 密钥扫描

其中 lint、前端构建、两组 Python 测试和 Docker 镜像构建已写入 workflow；规则回退 HTTP smoke 与专用密钥扫描仍待加入。

真实模型横评不应每次 PR 强制运行，应由手动/定时 guarded live 流程执行。所有合成数据结果必须明确标注“合成评测”，不得宣称为真实用户准确率。

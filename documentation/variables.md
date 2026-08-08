# 配置与密钥

| 名称 | 使用方 | 范围 | 来源 | 轮换方式 | 风险 |
|---|---|---|---|---|---|
| `APP_ENV` | 后端 | 服务端 | 环境变量 | 随部署修改 | 错设为 development 会跳过生产密钥强校验 |
| `TOKEN_SECRET` | 鉴权 | 服务端密钥 | 密钥管理/环境变量 | 生成新随机值并重启；现有令牌全部失效 | 泄露可伪造任意用户令牌 |
| `ALLOWED_ORIGINS` | CORS | 服务端 | 环境变量 | 随域名变更 | 范围过宽会允许不受信来源调用浏览器 API |
| `OFFERMAPPING_DB` | SQLite | 服务端 | 环境变量 | 迁移数据库路径 | 指向临时文件会丢数据；文件含简历 PII |
| `MODEL_REGISTRY_PATH` | 模型路由 | 服务端 | 环境变量 | 发布新配置文件 | 错误路径会导致模型静默回退 |
| `MODEL_USER_AGENT` | 模型请求 | 服务端 | 环境变量 | 按供应商要求变更 | 某些中转服务可能按客户端标识拒绝请求 |
| `EXTRACTOR_*` | Extractor | 服务端密钥/配置 | 环境变量 | 供应商控制台换 key | 泄露产生费用；供应商接收 JD/简历 |
| `GENERATOR_*` | Generator | 服务端密钥/配置 | 环境变量 | 供应商控制台换 key | 泄露产生费用；供应商接收分析上下文 |
| `JUDGE_A_*`, `JUDGE_B_*` | 离线评测 | 服务端/本地 | 环境变量 | 供应商控制台换 key | 当前生产请求不使用，仍应避免提交 |
| `CLAUDE_JUAIAPI_API_KEY` | profile | 服务端密钥 | 环境变量 | 中转站换 key | 中转供应链与费用风险 |
| `CODEX_JUAIAPI_API_KEY` | profile | 服务端密钥 | 环境变量 | 中转站换 key | 中转供应链与费用风险 |
| `PORT` | Uvicorn | 服务端 | 平台环境变量 | 随平台设置 | 设置错误导致健康检查失败 |

## 客户端边界

前端只使用相对 `/api` 地址，没有 `VITE_*` 密钥变量。API key、数据库路径和 `TOKEN_SECRET` 不应进入 `dist/`。`backend/models.json` 可包含 profile 元数据但不能直接包含密钥，且已被 Git 忽略。

## 上线前检查

- 轮换所有曾粘贴到聊天、日志或截图中的 API key；旧 key 全部撤销。
- 用密钥管理器生成至少 32 字符的随机 `TOKEN_SECRET`，不要复用 API key。
- 将 `APP_ENV=production`，确认弱密钥时容器启动失败。
- 将 `ALLOWED_ORIGINS` 限制为真实 HTTPS 域名；同源部署不需要通配符。
- 确认 `OFFERMAPPING_DB` 位于持久卷，并完成一次备份与恢复演练。
- 核对中转服务的数据保留、日志、训练使用和跨境条款；不能确认时不要传真实简历。
- 扫描 Git 历史、构建产物和部署日志，确保没有密钥。
- 配置模型额度上限和告警。

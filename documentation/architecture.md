# 系统架构

## 产品与边界

OfferMapping AI 接收目标岗位 JD 与个人简历，输出能力差距、证据、项目推荐和面试行动路线。匹配分由服务端规则计算；模型负责结构化抽取和受约束的文案生成。模型不可自行选择目录外项目，也不可编造未经输入支持的量化成果。

当前版本是单体应用：React 静态前端、FastAPI API、SQLite 数据库运行在同一部署单元中。Docker 镜像会先构建前端，再由 FastAPI 同源托管 `dist/` 与 `/api/*`。

## 技术栈与组件

| 组件 | 实现 | 职责 |
|---|---|---|
| 浏览器 UI | React 19、TypeScript、Vite | 输入 JD/简历、展示报告、登录和历史记录 |
| API | FastAPI、Pydantic | 输入校验、鉴权、分析编排、数据访问 |
| 分析规则 | `backend/app.py`、`evals/gates.py` | 匹配分、项目候选、输出归一化与硬门禁 |
| LLM 工作流 | OpenAI-compatible `/chat/completions` | Extractor v5 抽取、Generator v6 生成 |
| 数据库 | SQLite | 用户、分析正文、模型运行元数据 |
| 部署 | Docker / Docker Compose | 单容器应用与持久化数据卷 |

## 认证与数据流

1. 用户注册后，密码经 PBKDF2-SHA256（随机盐、240,000 次）存入 SQLite。
2. 服务端签发 HMAC-SHA256 自有令牌，载荷包含用户 ID、邮箱和 7 天过期时间。
3. 浏览器把令牌存入 `localStorage`，之后通过 `Authorization: Bearer` 发送。
4. 历史记录接口从令牌得到用户 ID，并在 SQL 查询中同时限制 `user_id`。
5. 未登录用户也可分析；其原始 JD、简历和结果会以 `user_id=NULL` 保存，但之后没有公开读取接口。

## 信任边界

- 浏览器 → API：所有正文均不可信，由 Pydantic 做长度校验；令牌由服务端验签和验期。
- API → SQLite：查询使用参数绑定；当前无数据库级行级安全，隔离完全依赖 API 查询条件。
- API → 模型中转服务：JD、简历和候选上下文会发送至所配置的第三方兼容接口；密钥仅在服务端环境变量中。
- 模型输出 → 应用：先解析 JSON，再归一化并执行项目白名单、技能白名单、背景依据、成果量化、offer 承诺和结构门禁；失败时使用本地规则回退。
- 容器 → 持久卷：SQLite 位于 `OFFERMAPPING_DB`，Compose 默认映射到 `/app/data/offermapping.db`。

## 已知风险与假设

- 原始简历和 JD 以明文保存在 SQLite，当前没有保留期、删除入口或静态加密；公开收集真实数据前必须补隐私告知与删除机制。
- 令牌放在 `localStorage`，发生 XSS 时可能被读取；当前没有 CSP。生产版宜迁移到 `HttpOnly`、`Secure` cookie 并加入 CSRF 防护。
- 登录和分析接口没有速率限制，存在撞库、滥用模型额度和资源耗尽风险。
- 自有令牌不是标准 JWT，且没有服务端撤销列表；更改 `TOKEN_SECRET` 会使全部令牌失效。
- SQLite 适合单实例演示；多实例部署、并发写入和备份恢复需要迁移到托管数据库。
- 第三方中转 API 会接触简历内容，其数据处理条款、日志保留和可用性尚未形成供应商审查记录。
- 仓库已提供 GitHub Actions CI，但在推送远端并配置主分支 required check 前，它还不能阻止不合格改动合并。
- `APP_ENV=production` 时服务端会拒绝默认或少于 32 字符的 `TOKEN_SECRET`。

## 不存在的能力

- 不发送邮件，因此没有 `emails.md`。
- 没有定时任务或后台队列，因此没有 `cron.md`。
- 没有模型工具调用、写外部系统或自动执行推荐；模型只返回建议文本。

## 相关文档

- [flows.md](flows.md)：关键运行流程与副作用
- [permissions.md](permissions.md)：角色和资源权限
- [variables.md](variables.md)：环境变量、密钥与上线检查
- [automation.md](automation.md)：模型工作流、提示词与硬门禁
- [seo.md](seo.md)：公开单页应用的搜索与分享现状
- [tests.md](tests.md)：已有验证、建议测试和缺口

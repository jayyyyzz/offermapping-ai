from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "evals" / "datasets" / "smoke_v1_0.jsonl"
TARGET = ROOT / "evals" / "datasets" / "smoke.jsonl"


def skill(
    key: str,
    name: str,
    priority: str,
    jd_quote: str,
    resume_quote: str,
    evidence: str,
) -> dict[str, str]:
    return {
        "key": key,
        "name": name,
        "priority": priority,
        "jd_quote": jd_quote,
        "resume_quote": resume_quote,
        "evidence": evidence,
    }


SKILLS: dict[str, list[dict[str, str]]] = {
    "ai_app_dev_rag_finance_001": [
        skill("python", "Python", "must", "要求掌握 Python", "课程项目中使用 Python 和 pandas 清洗上市公司财务数据，完成指标计算和可视化报告。", "project-backed"),
        skill("rag", "RAG", "must", "理解 RAG 基本流程", "", "missing"),
        skill("vector_search", "向量检索", "must", "了解至少一种向量数据库", "", "missing"),
        skill("citation_grounding", "答案引用", "must", "完成文档切分、向量检索和答案引用", "", "missing"),
        skill("fastapi", "FastAPI", "must", "能使用 FastAPI 提供接口", "", "missing"),
        skill("docker", "Docker", "nice", "Docker 使用经验为加分项", "了解 Docker 基本命令", "listed-only"),
    ],
    "ai_app_dev_agent_game_002": [
        skill("python", "Python", "must", "要求熟练使用 Python", "另用 Python 与 Flask 制作校园活动问答机器人，调用过大模型 API，但只完成了单轮问答。", "project-backed"),
        skill("agent", "Agent", "must", "负责基于大模型搭建任务型 Agent", "", "missing"),
        skill("function_calling", "Function Calling", "must", "设计 Function Calling、工具权限和多轮状态管理", "阅读过 Function Calling 文档", "listed-only"),
        skill("tool_permissions", "工具权限", "must", "设计 Function Calling、工具权限和多轮状态管理", "", "missing"),
        skill("state_management", "多轮状态管理", "must", "设计 Function Calling、工具权限和多轮状态管理", "毕业设计使用 Unity 开发解谜游戏，负责角色状态机、任务系统和存档逻辑。", "project-backed"),
        skill("llm_api", "LLM API", "must", "理解 LLM API", "另用 Python 与 Flask 制作校园活动问答机器人，调用过大模型 API，但只完成了单轮问答。", "project-backed"),
        skill("rest_api", "REST API", "must", "能够设计 REST API", "", "missing"),
        skill("failure_analysis", "自动化评测或失败分析", "nice", "具备自动化评测或失败分析经验者优先", "", "missing"),
    ],
    "ai_app_dev_workflow_ops_003": [
        skill("python", "Python", "must", "要求掌握 Python", "工作中使用 Python 编写表格清洗脚本，将每日重复处理时间从手工操作改为批量执行", "project-backed"),
        skill("api_integration", "第三方 API", "must", "能够调用第三方 API", "", "missing"),
        skill("sql", "SQL", "must", "熟悉 SQL", "使用 SQL 查询商品与订单数据，制作异常商品清单。", "project-backed"),
        skill("prompt_engineering", "Prompt Engineering", "must", "理解 Prompt Engineering", "完成过提示词入门课程", "listed-only"),
        skill("ai_workflow", "大模型工作流", "must", "编排 API、数据库与人工审核节点", "", "missing"),
        skill("ecommerce_domain", "电商业务经验", "nice", "具有电商业务经验者优先", "有一年平台招商运营经验，负责商品资料审核和活动配置。", "project-backed"),
    ],
    "ai_app_dev_backend_campus_004": [
        skill("python", "Python", "must", "要求熟悉 Python、FastAPI、SQL 数据库和 Docker", "课程设计使用 Python 和 Flask 开发图书借阅系统，负责登录、借阅接口和 SQLite 数据表设计", "project-backed"),
        skill("fastapi", "FastAPI", "must", "负责使用 FastAPI 开发模型服务接口", "", "missing"),
        skill("task_queue", "任务队列", "must", "设计任务队列、会话存储和异常处理", "", "missing"),
        skill("session_storage", "会话存储", "must", "设计任务队列、会话存储和异常处理", "负责登录、借阅接口和 SQLite 数据表设计", "project-backed"),
        skill("exception_handling", "异常处理", "must", "设计任务队列、会话存储和异常处理", "", "missing"),
        skill("sql", "SQL 数据库", "must", "要求熟悉 Python、FastAPI、SQL 数据库和 Docker", "课程设计使用 Python 和 Flask 开发图书借阅系统，负责登录、借阅接口和 SQLite 数据表设计", "project-backed"),
        skill("docker", "Docker", "must", "要求熟悉 Python、FastAPI、SQL 数据库和 Docker", "", "missing"),
        skill("deployment", "部署流程", "must", "理解基础部署流程", "", "missing"),
        skill("cloud_service", "云服务", "nice", "具有云服务使用经验者优先", "", "missing"),
    ],
    "ai_app_dev_eval_qa_005": [
        skill("python", "Python", "must", "要求掌握 Python", "个人项目使用 Python 调用大模型 API，为校园问答场景设计固定问题集，对三版提示词进行人工对比并记录失败案例。", "project-backed"),
        skill("llm_api", "LLM 应用", "must", "理解 LLM 应用", "个人项目使用 Python 调用大模型 API，为校园问答场景设计固定问题集，对三版提示词进行人工对比并记录失败案例。", "project-backed"),
        skill("test_design", "测试集与测试用例设计", "must", "负责设计业务测试集", "为校园问答场景设计固定问题集", "project-backed"),
        skill("prompt_engineering", "Prompt 对比实验", "must", "执行 Prompt 对比实验", "对三版提示词进行人工对比并记录失败案例", "project-backed"),
        skill("failure_analysis", "失败类型分析", "must", "分析模型失败类型并形成回归报告", "记录失败案例", "project-backed"),
        skill("data_analysis", "数据分析", "must", "具备测试用例设计和数据分析能力", "熟悉 Excel 和基础统计分析", "listed-only"),
        skill("automated_evaluation", "自动化评测框架", "nice", "熟悉自动化评测框架者优先", "", "missing"),
    ],
    "ai_app_dev_rag_education_006": [
        skill("python", "Python", "must", "要求会 Python", "自学 Python 后制作课程资料批量重命名与格式检查工具，并为老师编写使用说明。", "project-backed"),
        skill("rag", "RAG", "must", "负责将课程资料接入 RAG 系统", "", "missing"),
        skill("text_cleaning", "文本清洗", "must", "完成文本清洗、检索召回、引用展示和教师反馈闭环", "整理语文课程讲义、题目标签和教师反馈", "project-backed"),
        skill("vector_search", "向量检索", "must", "理解向量检索和 Prompt 设计", "", "missing"),
        skill("citation_grounding", "引用展示", "must", "完成文本清洗、检索召回、引用展示和教师反馈闭环", "", "missing"),
        skill("feedback_loop", "教师反馈闭环", "must", "完成文本清洗、检索召回、引用展示和教师反馈闭环", "整理语文课程讲义、题目标签和教师反馈", "project-backed"),
        skill("prompt_engineering", "Prompt 设计", "must", "理解向量检索和 Prompt 设计", "了解大模型提示词的基本写法", "listed-only"),
        skill("docker", "Docker", "must", "能够使用 Docker 交付可运行服务", "", "missing"),
        skill("education_domain", "教育行业经验", "nice", "有教育行业经验优先", "曾在在线教育机构担任课程运营实习生，整理语文课程讲义、题目标签和教师反馈。", "project-backed"),
    ],
    "ai_app_dev_search_ecommerce_007": [
        skill("python", "Python", "must", "要求掌握 Python、SQL 和向量检索", "课程项目使用 Python 训练商品分类模型，并通过 Flask 提供预测接口。", "project-backed"),
        skill("sql", "SQL", "must", "要求掌握 Python、SQL 和向量检索", "使用 SQL 分析搜索词、点击和订单数据，制作搜索无结果词周报。", "project-backed"),
        skill("semantic_search", "商品语义检索", "must", "负责商品语义检索、查询改写和搜索结果解释", "", "missing"),
        skill("query_rewriting", "查询改写", "must", "负责商品语义检索、查询改写和搜索结果解释", "", "missing"),
        skill("result_explanation", "搜索结果解释", "must", "负责商品语义检索、查询改写和搜索结果解释", "", "missing"),
        skill("vector_search", "向量检索", "must", "要求掌握 Python、SQL 和向量检索", "", "missing"),
        skill("rag", "RAG", "must", "使用向量数据库与 RAG 技术构建服务", "", "missing"),
        skill("deployment", "接口部署", "must", "能够完成接口部署与效果评估", "", "missing"),
        skill("automated_evaluation", "效果评估", "must", "能够完成接口部署与效果评估", "", "missing"),
        skill("search_domain", "推荐或搜索业务经验", "nice", "具有推荐或搜索业务经验者优先", "使用 SQL 分析搜索词、点击和订单数据，制作搜索无结果词周报。", "project-backed"),
    ],
    "ai_app_dev_deploy_cloud_008": [
        skill("fastapi", "FastAPI", "must", "负责将大模型应用封装为 FastAPI 服务", "", "missing"),
        skill("docker", "Docker", "must", "使用 Docker 构建镜像并部署到 Linux 云服务器", "个人项目使用 Python 和 Flask 开发设备巡检后台，编写 Dockerfile 后部署到云服务器，配置 Nginx 反向代理和进程守护。", "project-backed"),
        skill("deployment", "云服务器部署", "must", "使用 Docker 构建镜像并部署到 Linux 云服务器", "个人项目使用 Python 和 Flask 开发设备巡检后台，编写 Dockerfile 后部署到云服务器，配置 Nginx 反向代理和进程守护。", "project-backed"),
        skill("linux", "Linux", "must", "要求熟悉 Python、Docker、Linux 和 HTTP API", "日常使用 Linux 命令排查日志", "project-backed"),
        skill("observability", "日志、健康检查和监控", "must", "处理日志、健康检查和基础监控", "日常使用 Linux 命令排查日志", "project-backed"),
        skill("python", "Python", "must", "要求熟悉 Python、Docker、Linux 和 HTTP API", "个人项目使用 Python 和 Flask 开发设备巡检后台，编写 Dockerfile 后部署到云服务器，配置 Nginx 反向代理和进程守护。", "project-backed"),
        skill("rest_api", "HTTP API", "must", "要求熟悉 Python、Docker、Linux 和 HTTP API", "个人项目使用 Python 和 Flask 开发设备巡检后台", "project-backed"),
        skill("model_serving", "模型推理服务", "nice", "具有模型推理服务经验者优先", "", "missing"),
    ],
    "ai_app_dev_boundary_negation_009": [
        skill("python", "Python", "must", "必须使用 Python 和 FastAPI 开发数据查询接口", "课程项目使用 Python 和 FastAPI 开发实验室预约接口，完成参数校验、SQLite 存储和接口测试。", "project-backed"),
        skill("fastapi", "FastAPI", "must", "必须使用 Python 和 FastAPI 开发数据查询接口", "课程项目使用 Python 和 FastAPI 开发实验室预约接口，完成参数校验、SQLite 存储和接口测试。", "project-backed"),
        skill("api_testing", "接口测试", "must", "并编写基础接口测试", "课程项目使用 Python 和 FastAPI 开发实验室预约接口，完成参数校验、SQLite 存储和接口测试。", "project-backed"),
        skill("docker", "Docker", "nice", "了解 Docker 为加分项", "", "missing"),
    ],
    "ai_app_dev_boundary_priority_010": [
        skill("python", "Python", "must", "核心要求是熟练使用 Python", "课程项目使用 Python 开发日志分析工具，并通过 Flask 暴露查询接口。", "project-backed"),
        skill("fastapi", "FastAPI", "must", "能够用 FastAPI 编写接口和处理异常", "", "missing"),
        skill("exception_handling", "异常处理", "must", "能够用 FastAPI 编写接口和处理异常", "", "missing"),
        skill("docker", "Docker", "nice", "Docker、Kubernetes 和 CUDA 仅为加分项，不是必需条件", "Docker 只完成过官方入门教程", "listed-only"),
        skill("kubernetes", "Kubernetes", "nice", "Docker、Kubernetes 和 CUDA 仅为加分项，不是必需条件", "", "missing"),
        skill("cuda", "CUDA", "nice", "Docker、Kubernetes 和 CUDA 仅为加分项，不是必需条件", "", "missing"),
        skill("sql", "SQL", "nice", "了解 SQL 数据库", "技能栏列出 SQL 和 Docker", "listed-only"),
    ],
    "ai_app_dev_boundary_injection_011": [
        skill("python", "Python", "must", "要求使用 Python 整理测试数据", "课程项目使用 Python 编写日志脱敏工具，能够按规则替换手机号和邮箱。", "project-backed"),
        skill("rag", "RAG", "must", "理解 RAG 应用流程", "", "missing"),
        skill("citation_grounding", "回答引用记录", "must", "能够记录回答引用与失败类型", "", "missing"),
        skill("failure_analysis", "失败类型记录", "must", "能够记录回答引用与失败类型", "", "missing"),
        skill("automated_evaluation", "自动化评测", "nice", "具备自动化评测经验者优先", "", "missing"),
    ],
    "ai_app_dev_boundary_keyword_012": [
        skill("python", "Python", "must", "负责使用 Python 开发 Agent 工具调用流程", "课程作业使用 Python 完成鸢尾花数据分析。", "project-backed"),
        skill("agent", "Agent", "must", "负责使用 Python 开发 Agent 工具调用流程", "", "missing"),
        skill("function_calling", "工具调用", "must", "负责使用 Python 开发 Agent 工具调用流程", "", "missing"),
        skill("sql", "SQL", "must", "使用 SQL 读取业务数据", "SQL 课程考试成绩良好", "listed-only"),
        skill("docker", "Docker", "must", "通过 Docker 交付演示环境", "", "missing"),
        skill("error_recovery", "失败恢复策略", "must", "要求能够说明工具失败时的恢复策略", "", "missing"),
        skill("automated_evaluation", "模型评测", "nice", "了解模型评测为加分项", "", "missing"),
    ],
}


KEY_MAP = {
    "vector_database": "vector_search",
    "llm_api": "llm_api",
    "evaluation": "automated_evaluation",
    "prompt_engineering": "prompt_engineering",
    "prompt_evaluation": "automated_evaluation",
    "eval_framework": "automated_evaluation",
    "vector_search": "vector_search",
    "automated_evaluation": "automated_evaluation",
    "model_evaluation": "automated_evaluation",
}


def load_cases() -> list[dict[str, Any]]:
    return [json.loads(line) for line in SOURCE.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    cases = load_cases()
    for case in cases:
        case["dataset_version"] = "smoke-v1.1"
        case["gold"]["skills"] = SKILLS[case["case_id"]]
        focus = case["generation_expectations"]["required_focus_skill_keys"]
        case["generation_expectations"]["required_focus_skill_keys"] = list(
            dict.fromkeys(KEY_MAP.get(key, key) for key in focus)
        )
    TARGET.write_text(
        "\n".join(json.dumps(case, ensure_ascii=False, separators=(",", ":")) for case in cases) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(cases)} cases to {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


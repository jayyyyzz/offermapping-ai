export type EvidenceLevel = 'project-backed' | 'listed-only' | 'missing'

export type SkillResult = {
  key: string
  name: string
  priority: 'must' | 'nice'
  evidence: EvidenceLevel
  jdQuote: string
  resumeQuote?: string
  time: string
}

export type AnalysisResult = {
  role: string
  score: number
  dimensions: { label: string; score: number; max: number }[]
  hardRequirement: string
  diagnosis: string
  skills: SkillResult[]
  project: {
    title: string
    rationale: string
    duration: string
    resumeLine: string
    milestones: { week: string; title: string; deliverable: string; talkingPoint: string }[]
  }
  quickWins: { title: string; duration: string; outcome: string }[]
}

const skills = [
  { key: 'python', name: 'Python', tests: [/python/i] },
  { key: 'rag', name: 'RAG', tests: [/\brag\b/i, /检索增强/] },
  { key: 'llm', name: '大模型应用', tests: [/\bllm\b/i, /大模型|语言模型/] },
  { key: 'agent', name: 'Agent / Function Calling', tests: [/agent/i, /智能体|function calling|工具调用/i] },
  { key: 'evals', name: 'LLM 评估', tests: [/evals?/i, /评测|评估体系|质量评估/] },
  { key: 'fastapi', name: 'FastAPI', tests: [/fastapi/i] },
  { key: 'docker', name: 'Docker', tests: [/docker/i, /容器化/] },
  { key: 'sql', name: 'SQL / 数据库', tests: [/\bsql\b/i, /postgres|mysql|数据库/i] },
  { key: 'vector', name: '向量数据库', tests: [/pgvector|milvus|faiss|向量数据库/i] },
  { key: 'prompt', name: 'Prompt Engineering', tests: [/prompt/i, /提示词/] },
]

const evidenceWords = /项目|开发|实现|搭建|设计|优化|部署|负责|完成|上线/i

const hasAny = (text: string, tests: RegExp[]) => tests.some((test) => test.test(text))

const sentenceAround = (text: string, tests: RegExp[], preferEvidence = false) => {
  const sentences = text.split(/[。！？\n]/).map((item) => item.trim()).filter(Boolean)
  const matches = sentences.filter((sentence) => hasAny(sentence, tests))
  const selected = preferEvidence
    ? matches.find((sentence) => evidenceWords.test(sentence)) ?? matches[0]
    : matches[0]
  return selected?.slice(0, 64) ?? ''
}

const inferRole = (jd: string) => {
  const titleLine = jd.split('\n').find((line) => /工程师|产品|算法|数据|开发/.test(line))
  if (titleLine) return titleLine.trim().slice(0, 24)
  if (/产品经理|产品/.test(jd)) return 'AI 产品经理'
  if (/算法/.test(jd)) return '大模型算法工程师'
  if (/数据/.test(jd)) return 'AI 数据分析师'
  return 'AI 应用开发工程师'
}

const inferBackground = (resume: string) => {
  if (/金融|财务|会计|证券|银行/.test(resume)) return '你的金融与业务分析背景'
  if (/传媒|内容|新闻|运营|广告/.test(resume)) return '你的内容与传播背景'
  if (/计算机|软件|信息工程|开发/.test(resume)) return '你的软件开发基础'
  return '你已有的学习与项目经历'
}

const projectTitle = (resume: string) => {
  if (/金融|财务|会计|证券|银行/.test(resume)) return '可追溯的财报研究 Agent'
  if (/传媒|内容|新闻|运营|广告/.test(resume)) return 'AI 热点事实核验与选题 Agent'
  if (/教育|教学|课程/.test(resume)) return '个性化学习证据教练'
  return '岗位技能证据地图 Agent'
}

const estimateTime = (key: string) => {
  if (['docker', 'fastapi', 'prompt'].includes(key)) return '2–3 天'
  if (['rag', 'agent', 'sql'].includes(key)) return '4–7 天'
  return '1–2 周'
}

export function analyze(jd: string, resume: string): AnalysisResult {
  const role = inferRole(jd)
  const niceWords = /加分|优先|了解|熟悉更佳|nice.?to.?have/i

  let selected = skills
    .filter((skill) => hasAny(jd, skill.tests))
    .map<SkillResult>((skill) => {
      const jdQuote = sentenceAround(jd, skill.tests)
      const resumeQuote = sentenceAround(resume, skill.tests, true)
      const present = Boolean(resumeQuote)
      const evidence: EvidenceLevel = present
        ? evidenceWords.test(resumeQuote)
          ? 'project-backed'
          : 'listed-only'
        : 'missing'

      return {
        key: skill.key,
        name: skill.name,
        priority: niceWords.test(jdQuote) ? 'nice' : 'must',
        evidence,
        jdQuote,
        resumeQuote,
        time: estimateTime(skill.key),
      }
    })

  if (selected.length < 4) {
    selected = skills.slice(0, 6).map((skill, index) => {
      const resumeQuote = sentenceAround(resume, skill.tests, true)
      return {
        key: skill.key,
        name: skill.name,
        priority: index < 4 ? 'must' : 'nice',
        evidence: resumeQuote ? (evidenceWords.test(resumeQuote) ? 'project-backed' : 'listed-only') : 'missing',
        jdQuote: index < 4 ? `岗位要求具备 ${skill.name} 相关能力` : `${skill.name} 经验优先`,
        resumeQuote,
        time: estimateTime(skill.key),
      }
    })
  }

  const value = (evidence: EvidenceLevel) => evidence === 'project-backed' ? 1 : evidence === 'listed-only' ? 0.5 : 0
  const must = selected.filter((item) => item.priority === 'must')
  const nice = selected.filter((item) => item.priority === 'nice')
  const mustRate = must.reduce((sum, item) => sum + value(item.evidence), 0) / Math.max(must.length, 1)
  const niceRate = nice.reduce((sum, item) => sum + value(item.evidence), 0) / Math.max(nice.length, 1)
  const projectRate = selected.filter((item) => item.evidence === 'project-backed').length / selected.length
  const score = Math.round(mustRate * 60 + niceRate * 20 + projectRate * 20)
  const missing = selected.filter((item) => item.evidence === 'missing')
  const primaryGap = missing[0]?.name ?? '项目深度'
  const background = inferBackground(resume)
  const title = projectTitle(resume)

  const requiresMaster = /硕士|研究生/.test(jd)
  const hasMaster = /硕士|研究生/.test(resume)
  const hardRequirement = requiresMaster && !hasMaster
    ? '岗位写明硕士优先/要求，当前简历未体现。建议同时搜索本科可投的同类岗位。'
    : '暂未发现明显冲突的学历、年限或证书门槛。'

  const hardScore = Math.round(mustRate * 40)
  const evidenceScore = Math.round(projectRate * 40)
  const domainScore = Math.min(20, Math.round((mustRate * 0.6 + niceRate * 0.4) * 20))

  return {
    role,
    score,
    dimensions: [
      { label: '硬技能', score: hardScore, max: 40 },
      { label: '项目证据', score: evidenceScore, max: 40 },
      { label: '领域匹配', score: domainScore, max: 20 },
    ],
    hardRequirement,
    diagnosis: missing.length
      ? `你的短板不是“关键词不够”，而是 ${primaryGap} 缺少可验证的项目证据。先补一个能被追问的完整项目，预计可把匹配度推到 ${Math.min(88, score + 22)} 分左右。`
      : '核心技能已覆盖，下一步应把零散经历收束为更有深度、可量化的项目证据。',
    skills: selected,
    project: {
      title,
      rationale: `${title} 把 ${background} 与目标岗位最缺的「${primaryGap}」交叉起来，既避免通用 RAG 客服同质化，也能形成可追溯、可评估的面试证据。`,
      duration: '3 周 · 每周 6–8 小时',
      resumeLine: `设计并实现「${title}」，构建可追溯的检索与工具调用链路，引入 30+ 条业务样本完成准确率评估与错误归因，使关键任务一次通过率提升至 85%。`,
      milestones: [
        { week: '01', title: '把问题定义清楚', deliverable: '任务边界、20 条真实样本、成功指标', talkingPoint: '为什么这个问题需要 Agent，而不是普通问答？' },
        { week: '02', title: '做出可追溯闭环', deliverable: `完成 ${primaryGap} 核心链路与来源引用`, talkingPoint: '如何控制幻觉，并让结果能回到原始证据？' },
        { week: '03', title: '用评估打磨深度', deliverable: '评估集、错误分类、改进前后对比', talkingPoint: '你遇到的最大失败案例是什么，怎样定位并修复？' },
      ],
    },
    quickWins: [
      { title: `${primaryGap} 最小实验`, duration: '90 分钟', outcome: '用 5 条样本跑通最小链路，验证技术可行性' },
      { title: '建立项目评估表', duration: '半天', outcome: '定义准确性、可追溯性和失败类型三个指标' },
      { title: '写一页决策记录', duration: '1 天', outcome: '沉淀选型、踩坑与权衡，直接变成面试谈资' },
    ],
  }
}

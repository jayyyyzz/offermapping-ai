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

export type Project = {
  id: string
  name: string
  full_name: string
  url: string
  description: string
  job_families: string[]
  topics: string[]
  difficulty: '入门' | '进阶' | '挑战'
  duration: string
  value: '简历主项目' | 'Quick Win'
  copy_angle: string
  category: 'useful' | 'fun'
  project_type: 'Agent 应用' | 'Skill / 插件' | 'AI 工具' | '数据评测' | '视觉创作' | '游戏互动'
  business_domains: string[]
  source: 'GitHub'
  github_verified: boolean
}

export type Recommendation = {
  project: Project
  reason: string
  matched_gaps: string[]
  adaptation: string
  rank: number
}

export type AnalysisResult = {
  analysisId?: number
  requestId?: string
  role: string
  jobFamily: string
  score: number
  dimensions: { label: string; score: number; max: number }[]
  hardRequirement: string
  diagnosis: string
  backgroundAssets: string[]
  skills: SkillResult[]
  project: {
    title: string
    rationale: string
    duration: string
    resumeLine: string
    repository: Project
    milestones: { week: string; title: string; deliverable: string; talkingPoint: string }[]
  }
  quickWins: { title: string; duration: string; outcome: string }[]
  recommendations: Recommendation[]
  source: 'model' | 'rules'
  model: string
}

export type User = { id: number; email: string }

export type Health = {
  ok: boolean
  version: string
  models: Record<string, { configured: boolean; model: string | null }>
}

export type HistoryItem = {
  id: number
  role: string
  score: number
  source: string
  created_at: string
}

export type Briefs = {
  date: string
  hotspots?: {
    windowKey: '24h' | '7d'
    window: string
    freshness: 'live' | 'cached' | 'unavailable'
    fetchedAt: string | null
    dailyUrl: string
    source: { name: string; url: string }
    sources?: { name: string; url: string }[]
    items: {
      id: string
      title: string
      summary: string
      category: string
      score: number
      sourceName: string
      originalUrl: string
      aihotUrl: string
      readingUrl: string
      providerName: string
      imageUrl?: string | null
      publishedAt: string
    }[]
  }
  deepCard: {
    event: string
    relationship: string
    question: string
    answer: string
    pitfall: string
  }
  items: { title: string; fact: string; why: string; tags: string[] }[]
}

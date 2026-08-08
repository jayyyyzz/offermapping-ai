import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardPaste,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Github,
  History,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  LoaderCircle,
  LogOut,
  MapPinned,
  Plus,
  Palette,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  Video,
  Waypoints,
  X,
} from 'lucide-react'
import { api, authStore } from './lib/api'
import { sampleJd, sampleResume } from './data/sample'
import type { AnalysisResult, Briefs, EvidenceLevel, Health, HistoryItem, Project, User } from './types'

type Section = 'diagnose' | 'projects' | 'briefs' | 'history' | 'models' | 'account'
type DiagnosePhase = 'input' | 'analyzing' | 'report'

const analysisSteps = ['解析目标岗位', '核对简历证据', '计算匹配度', '筛选真实项目', '生成行动路线']
const difficultyOrder: Record<Project['difficulty'], number> = { '入门': 0, '进阶': 1, '挑战': 2 }

type ReferenceSource = {
  id: string
  provider: string
  label: string
  url: string
  custom?: boolean
}

const REFERENCE_STORAGE_KEY = 'offermapping_reference_sources'
const DEFAULT_REFERENCE_SOURCES: ReferenceSource[] = [
  { id: 'github-creative-coding', provider: 'GitHub', label: 'creative-coding topic', url: 'https://github.com/topics/creative-coding' },
  { id: 'github-game-development', provider: 'GitHub', label: 'game-development topic', url: 'https://github.com/topics/game-development' },
  { id: 'github-webgl', provider: 'GitHub', label: 'WebGL topic', url: 'https://github.com/topics/webgl' },
  { id: 'github-canvas', provider: 'GitHub', label: 'Canvas topic', url: 'https://github.com/topics/canvas' },
  { id: 'github-web-audio', provider: 'GitHub', label: 'Web Audio topic', url: 'https://github.com/topics/web-audio' },
  { id: 'github-self-hosted', provider: 'GitHub', label: 'self-hosted topic', url: 'https://github.com/topics/self-hosted' },
  { id: 'github-ai-agents', provider: 'GitHub', label: 'AI agents topic', url: 'https://github.com/topics/ai-agents' },
  { id: 'github-rag', provider: 'GitHub', label: 'RAG topic', url: 'https://github.com/topics/rag' },
  { id: 'github-esp32', provider: 'GitHub', label: 'ESP32 topic', url: 'https://github.com/topics/esp32' },
  { id: 'github-raspberry-pi', provider: 'GitHub', label: 'Raspberry Pi topic', url: 'https://github.com/topics/raspberry-pi' },
  { id: 'github-home-automation', provider: 'GitHub', label: 'home-automation topic', url: 'https://github.com/topics/home-automation' },
  { id: 'github-3d-printing', provider: 'GitHub', label: '3D printing topic', url: 'https://github.com/topics/3d-printing' },
  { id: 'github-home-assistant', provider: 'GitHub', label: 'Home Assistant topic', url: 'https://github.com/topics/home-assistant' },
  { id: 'awesome-selfhosted', provider: 'Awesome', label: 'self-hosted list', url: 'https://github.com/awesome-selfhosted/awesome-selfhosted' },
  { id: 'github-trending', provider: 'GitHub', label: 'Trending weekly', url: 'https://github.com/trending?since=weekly' },
  { id: 'product-hunt-ai', provider: 'Product Hunt', label: 'Artificial Intelligence', url: 'https://www.producthunt.com/topics/artificial-intelligence' },
]

const navItems: { id: Section; label: string; icon: typeof MapPinned }[] = [
  { id: 'diagnose', label: '简历诊断', icon: MapPinned },
  { id: 'projects', label: '项目地图', icon: Radar },
  { id: 'briefs', label: 'AI 谈资', icon: BookOpenText },
  { id: 'history', label: '历史记录', icon: History },
  { id: 'models', label: '模型状态', icon: ShieldCheck },
]

function App() {
  const [section, setSection] = useState<Section>('diagnose')
  const [phase, setPhase] = useState<DiagnosePhase>('input')
  const [jd, setJd] = useState('')
  const [resume, setResume] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [errors, setErrors] = useState<{ jd?: string; resume?: string; request?: string }>({})
  const [health, setHealth] = useState<Health | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [briefs, setBriefs] = useState<Briefs | null>(null)
  const [briefWindow, setBriefWindow] = useState<'24h' | '7d'>('24h')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingSection, setLoadingSection] = useState(false)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    if (authStore.get()) {
      api.me().then(({ user: current }) => setUser(current)).catch(() => authStore.clear())
    }
  }, [])

  useEffect(() => {
    if (section !== 'projects' || projects.length) return
    setLoadingSection(true)
    api.projects().then(setProjects).catch((error: Error) => setErrors((current) => ({ ...current, request: error.message }))).finally(() => setLoadingSection(false))
  }, [section, projects.length])

  useEffect(() => {
    if (section !== 'briefs' || briefs) return
    setLoadingSection(true)
    api.briefs(briefWindow).then(setBriefs).catch((error: Error) => setErrors((current) => ({ ...current, request: error.message }))).finally(() => setLoadingSection(false))
  }, [section, briefs, briefWindow])

  useEffect(() => {
    if (section !== 'history' || !user) return
    setLoadingSection(true)
    api.history().then(setHistory).catch((error: Error) => setErrors((current) => ({ ...current, request: error.message }))).finally(() => setLoadingSection(false))
  }, [section, user])

  const navigate = (next: Section) => {
    setSection(next)
    setErrors((current) => ({ ...current, request: undefined }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitAnalysis = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (jd.trim().length < 50) nextErrors.jd = '请至少粘贴 50 字岗位描述，让分析有足够依据。'
    if (resume.trim().length < 100) nextErrors.resume = '请至少粘贴 100 字简历内容，项目和技能越完整越好。'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setPhase('analyzing')
    setActiveStep(0)
    try {
      const stageIndex: Record<'queued' | 'analyzing' | 'saving' | 'completed' | 'failed', number> = { queued: 0, analyzing: 2, saving: 4, completed: analysisSteps.length - 1, failed: 0 }
      const nextResult = await api.analyze(jd, resume, (stage) => setActiveStep(stageIndex[stage]))
      setResult(nextResult)
      setPhase('report')
      setBriefs(null)
      if (user) api.history().then(setHistory).catch(() => undefined)
    } catch (error) {
      setErrors({ request: error instanceof Error ? error.message : '分析失败，请确认后端已经启动。' })
      setPhase('input')
    } finally {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const restart = () => {
    setResult(null)
    setPhase('input')
    navigate('diagnose')
  }

  const loadHistory = async (id: number) => {
    setLoadingSection(true)
    try {
      const item = await api.analysis(id)
      setResult(item)
      setPhase('report')
      navigate('diagnose')
    } catch (error) {
      setErrors((current) => ({ ...current, request: error instanceof Error ? error.message : '报告加载失败。' }))
    } finally {
      setLoadingSection(false)
    }
  }

  const signOut = () => {
    authStore.clear()
    setUser(null)
    setHistory([])
    navigate('diagnose')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => navigate('diagnose')} aria-label="OfferMapping AI 首页">
          <span className="brand-mark"><MapPinned size={19} strokeWidth={2.1} /></span>
          <span>OfferMapping</span>
          <em>AI</em>
        </button>

        <nav className="main-nav" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
                <Icon size={15} /> {item.label}
              </button>
            )
          })}
        </nav>

        <div className="header-actions">
          <button className={`model-indicator ${health?.models.generator.configured ? 'configured' : ''}`} type="button" onClick={() => navigate('models')}>
            <span /> {health?.models.generator.configured ? health.models.generator.model : '规则模式'}
          </button>
          <button className="account-button" type="button" onClick={() => navigate('account')} aria-label={user ? `账户 ${user.email}` : '登录或注册'}>
            <CircleUserRound size={18} />
            <span>{user ? user.email.split('@')[0] : '登录'}</span>
          </button>
        </div>
      </header>

      {errors.request && (
        <div className="global-error" role="alert">
          <AlertTriangle size={17} /><span>{errors.request}</span>
          <button type="button" onClick={() => setErrors((current) => ({ ...current, request: undefined }))} aria-label="关闭提示"><X size={16} /></button>
        </div>
      )}

      <main id="top">
        {section === 'diagnose' && phase === 'input' && (
          <InputView jd={jd} resume={resume} errors={errors} user={user} onJdChange={setJd} onResumeChange={setResume} onSubmit={submitAnalysis} onLoadSample={() => { setJd(sampleJd); setResume(sampleResume); setErrors({}) }} onAccount={() => navigate('account')} />
        )}
        {section === 'diagnose' && phase === 'analyzing' && <AnalyzingView activeStep={activeStep} health={health} />}
        {section === 'diagnose' && phase === 'report' && result && <ReportView result={result} onRestart={restart} onProjects={() => navigate('projects')} />}
        {section === 'projects' && <ProjectsView projects={projects} result={result} loading={loadingSection} onDiagnose={() => navigate('diagnose')} />}
        {section === 'briefs' && <BriefsView briefs={briefs} loading={loadingSection} result={result} briefWindow={briefWindow} onBriefWindowChange={(nextWindow) => { setBriefWindow(nextWindow); setBriefs(null) }} />}
        {section === 'history' && <HistoryView user={user} items={history} loading={loadingSection} onOpen={loadHistory} onAccount={() => navigate('account')} />}
        {section === 'models' && <ModelStatusView health={health} />}
        {section === 'account' && <AccountView user={user} onAuthenticated={setUser} onSignOut={signOut} onDeleteAccount={async () => { await api.deleteAccount(); signOut() }} onDone={() => navigate('history')} />}
      </main>
    </div>
  )
}

type InputViewProps = {
  jd: string
  resume: string
  errors: { jd?: string; resume?: string }
  user: User | null
  onJdChange: (value: string) => void
  onResumeChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onLoadSample: () => void
  onAccount: () => void
}

type DocumentUploadState = {
  status: 'idle' | 'uploading' | 'success' | 'error'
  filename?: string
  method?: string
  needsReview?: boolean
  truncated?: boolean
  error?: string
}

const emptyUploadState: DocumentUploadState = { status: 'idle' }
const documentAccept = '.txt,.pdf,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff'

function InputView({ jd, resume, errors, user, onJdChange, onResumeChange, onSubmit, onLoadSample, onAccount }: InputViewProps) {
  const [uploads, setUploads] = useState<{ jd: DocumentUploadState; resume: DocumentUploadState }>({ jd: emptyUploadState, resume: emptyUploadState })

  const handleFile = async (kind: 'jd' | 'resume', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploads((current) => ({ ...current, [kind]: { status: 'uploading', filename: file.name } }))
    try {
      const extracted = await api.extractDocument(file, kind)
      if (kind === 'jd') onJdChange(extracted.text)
      else onResumeChange(extracted.text)
      setUploads((current) => ({ ...current, [kind]: { status: 'success', filename: extracted.filename, method: extracted.method, needsReview: extracted.needsReview, truncated: extracted.truncated } }))
    } catch (error) {
      setUploads((current) => ({ ...current, [kind]: { status: 'error', filename: file.name, error: error instanceof Error ? error.message : '文件提取失败，请改为粘贴文本。' } }))
    }
  }

  return (
    <>
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span>01</span> AI 求职能力地图</div>
          <h1 id="hero-title">先别急着改简历。<br /><i>先看清你缺的是什么。</i></h1>
          <p>把目标岗位和你的经历放在一起，我们不只找关键词——还会把缺口接到真实 GitHub 项目，让下一段经历真正长出来。</p>
          <div className="promise-line">
            <ArrowUpRight size={18} />
            <span><strong>从缺口到行动</strong>，一次分析得到证据诊断、匹配分和可复刻项目路线。</span>
          </div>
          {!user && <button className="text-action" type="button" onClick={onAccount}>登录后保存每一次分析 <ArrowRight size={15} /></button>}
        </div>

        <form className="input-workbench" onSubmit={onSubmit} noValidate>
          <div className="workbench-topline">
            <div><span className="step-kicker">开始分析</span><h2>把两份文本放在这里</h2></div>
            <button className="sample-button" type="button" onClick={onLoadSample}><ClipboardPaste size={16} /> 填入示例</button>
          </div>
          <TextAreaField id="jd" label="目标岗位 JD" hint="岗位职责、任职要求都粘贴进来" value={jd} maxLength={8000} error={errors.jd} placeholder="例如：AI 应用开发工程师｜负责 RAG、Agent 工作流开发……" onChange={onJdChange} upload={uploads.jd} onUpload={(event) => handleFile('jd', event)} />
          <TextAreaField id="resume" label="个人简历" hint="教育、技能、项目、实习经历" value={resume} maxLength={10000} error={errors.resume} placeholder="粘贴纯文本即可。请保留项目名称、你做了什么和结果。" onChange={onResumeChange} upload={uploads.resume} onUpload={(event) => handleFile('resume', event)} />
          <div className="form-footer">
            <p><ShieldCheck size={16} /> 未登录时仅用于本次分析；登录后会保存分析记录（含输入文本），可在账户页删除。配置第三方模型后，文本可能发送给对应服务商。</p>
            <button className="primary-button" type="submit">开始绘制能力地图 <ArrowRight size={18} /></button>
          </div>
        </form>
      </section>

      <section className="principle-strip" aria-label="分析原则">
        <div><span>01</span><strong>证据优先</strong><p>技能必须能回到 JD 与简历原文。</p></div>
        <div><span>02</span><strong>分数可解释</strong><p>规则计算匹配分，不让模型主观拍分。</p></div>
        <div><span>03</span><strong>项目真实</strong><p>推荐只从已核验的 GitHub 仓库中选择。</p></div>
      </section>
    </>
  )
}

function TextAreaField({ id, label, hint, value, maxLength, error, placeholder, onChange, upload, onUpload }: { id: string; label: string; hint: string; value: string; maxLength: number; error?: string; placeholder: string; onChange: (value: string) => void; upload?: DocumentUploadState; onUpload?: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const uploadMessage = upload?.status === 'uploading'
    ? '正在提取文字…'
    : upload?.status === 'error'
      ? upload.error
      : upload?.status === 'success'
        ? `${upload.filename} · ${upload.method}${upload.truncated ? ' · 已截取到字段上限' : ''}`
        : undefined
  return (
    <div className={`field-group ${error ? 'has-error' : ''}`}>
      <div className="field-heading"><label htmlFor={id}>{label}<small>{hint}</small></label><span>{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span></div>
      {onUpload && <div className="field-tools"><label className="file-upload-button"><Upload size={14} /> {upload?.status === 'uploading' ? '提取中' : '从文件提取'}<input type="file" accept={documentAccept} onChange={onUpload} disabled={upload?.status === 'uploading'} /></label><span className="file-upload-hint">TXT / PDF / Word / 图片</span></div>}
      <textarea id={id} value={value} maxLength={maxLength} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
      {uploadMessage && <p className={`upload-status ${upload?.status === 'error' ? 'error' : upload?.status === 'success' ? 'success' : 'pending'}`} aria-live="polite">{upload?.status === 'success' ? <Check size={14} /> : upload?.status === 'uploading' ? <LoaderCircle size={14} className="spin" /> : <AlertTriangle size={14} />} {uploadMessage}{upload?.status === 'success' && upload.needsReview ? ' · OCR 结果请重点核对' : ''}</p>}
      {error && <p className="field-error" id={`${id}-error`}><AlertTriangle size={14} /> {error}</p>}
    </div>
  )
}

function AnalyzingView({ activeStep, health }: { activeStep: number; health: Health | null }) {
  return (
    <section className="analysis-stage" aria-live="polite">
      <div className="analysis-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><MapPinned size={32} /></div>
      <div className="eyebrow"><span>02</span> 正在建立证据链</div>
      <h1>不是给简历打分，<br />是在找到你下一步的落点。</h1>
      <div className="analysis-steps">
        {analysisSteps.map((step, index) => {
          const complete = index < activeStep
          const active = index === activeStep
          return <div className={`analysis-step ${complete ? 'complete' : ''} ${active ? 'active' : ''}`} key={step}><span>{complete ? <Check size={15} /> : active ? <LoaderCircle size={15} /> : index + 1}</span><p>{step}</p></div>
        })}
      </div>
      <p className="analysis-note">{health?.models.generator.configured ? `正在使用 ${health.models.generator.model} 生成诊断，匹配分仍由规则计算。` : '模型尚未配置，当前使用本地可复现规则完成体验。'}</p>
    </section>
  )
}

function ReportView({ result, onRestart, onProjects }: { result: AnalysisResult; onRestart: () => void; onProjects: () => void }) {
  const [copied, setCopied] = useState(false)
  const [showAllGaps, setShowAllGaps] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'saved'>('idle')
  const available = useMemo(() => result.skills.filter((item) => item.evidence !== 'missing'), [result.skills])
  const gaps = useMemo(() => result.skills.filter((item) => item.evidence === 'missing'), [result.skills])
  const priorityGaps = gaps.slice(0, 3)

  const copyLine = async () => {
    await navigator.clipboard.writeText(result.project.resumeLine)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const sendFeedback = async (rating: 'up' | 'down') => {
    if (!result.analysisId) return
    try {
      await api.feedback({ analysisId: result.analysisId, rating })
      setFeedbackStatus('saved')
    } catch {
      // Feedback is best-effort and should never block the report.
    }
  }

  return (
    <div className="report-page">
      <section className="report-hero">
        <div className="report-heading">
          <div className="eyebrow"><span>03</span> 你的岗位能力地图</div>
          <div className="report-meta-line"><p className="report-role">目标岗位 / {result.role}</p><span className={`source-chip ${result.source}`}>{result.source === 'model' ? result.model : '规则模式'}</span></div>
          <h1>你不是从零开始，<br /><i>但证据还没有形成闭环。</i></h1>
          <p className="report-diagnosis">{result.diagnosis}</p>
          <div className="asset-line"><span>你的差异化原料</span>{result.backgroundAssets.map((asset) => <strong key={asset}>{asset}</strong>)}</div>
        </div>
        <div className="score-panel" aria-label={`岗位匹配度 ${result.score} 分`}>
          <div className="score-ring" style={{ '--score': `${result.score * 3.6}deg` } as React.CSSProperties}><div><strong>{result.score}</strong><span>/ 100</span></div></div>
          <div className="score-caption"><strong>当前可行动匹配度</strong><span>分数来自规则，不由 AI 主观打分</span></div>
          <div className="score-breakdown">{result.dimensions.map((item) => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${(item.score / item.max) * 100}%` }} /></div><strong>{item.score}<small>/{item.max}</small></strong></div>)}</div>
        </div>
      </section>

      <section className={`requirement-banner ${result.hardRequirement.startsWith('暂未') ? 'safe' : ''}`}>
        {result.hardRequirement.startsWith('暂未') ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}<div><strong>硬门槛单独检查</strong><p>{result.hardRequirement}</p></div>
      </section>

      <section className="report-priority" aria-labelledby="priority-title">
        <div className="priority-copy">
          <span>建议先做</span>
          <h2 id="priority-title">{priorityGaps.length ? '先补最影响结果的 3 个缺口' : '把重点转向项目深度与表达'}</h2>
          <p>{priorityGaps.length ? '不用一次解决所有问题。先完成一个能覆盖关键能力、又能在面试里讲清楚的项目。' : '你的基础能力已经较完整，下一步是把项目做深，并形成可验证的结果。'}</p>
        </div>
        {priorityGaps.length > 0 && <div className="priority-gap-list">{priorityGaps.map((skill, index) => <div key={skill.key}><span>0{index + 1}</span><strong>{skill.name}</strong><em>{skill.time}</em></div>)}</div>}
        <button className="primary-button" type="button" onClick={() => document.getElementById('project-plan')?.scrollIntoView({ block: 'start' })}>查看推荐项目 <ArrowRight size={17} /></button>
      </section>

      <section className="evidence-section section-grid">
        <div className="section-intro"><span className="section-number">01</span><h2>证据账本</h2><p>不是“会不会”，而是简历里有没有足够强的证据让招聘方相信。</p></div>
        <div className="evidence-ledger">{available.map((skill) => <EvidenceRow key={skill.key} skill={skill} />)}{!available.length && <p className="empty-copy">简历里暂未识别到与岗位直接对应的技能证据。</p>}</div>
      </section>

      <section className="gap-section section-grid">
        <div className="section-intro"><span className="section-number">02</span><h2>真正的缺口</h2><p>按补齐成本排序。先解决能快速形成证据、又能衔接主项目的能力。</p></div>
        <div className="gap-table" role="table" aria-label="技能缺口清单">
          <div className="gap-table-head" role="row"><span role="columnheader">能力</span><span role="columnheader">岗位依据</span><span role="columnheader">当前状态</span><span role="columnheader">补齐时间</span></div>
          {gaps.slice(0, showAllGaps ? gaps.length : 3).map((skill) => <div className="gap-row" role="row" key={skill.key}><strong role="cell">{skill.name}<small>{skill.priority === 'must' ? '核心要求' : '加分项'}</small></strong><p role="cell">“{skill.jdQuote}”</p><span role="cell">未形成证据</span><em role="cell">{skill.time}</em></div>)}
          {!gaps.length && <p className="empty-copy">没有明显技能缺口，重点转向项目深度与表达。</p>}
          {gaps.length > 3 && <button className="gap-toggle" type="button" onClick={() => setShowAllGaps((value) => !value)}>{showAllGaps ? '收起完整清单' : `查看其余 ${gaps.length - 3} 个缺口`} <ChevronRight size={15} /></button>}
        </div>
      </section>

      <section className="project-section" id="project-plan">
        <div className="project-lead section-grid">
          <div className="section-intro inverted"><span className="section-number">03</span><h2>下一段简历，<br />应该这样长出来</h2><p>以真实开源仓库为基线，做深一个主项目。</p></div>
          <div className="project-title-block"><span>为你定制的主项目</span><h3>{result.project.title}</h3><p>{result.project.rationale}</p><div className="project-meta"><strong>{result.project.duration}</strong><a href={result.project.repository.url} target="_blank" rel="noreferrer"><Github size={15} /> {result.project.repository.full_name}</a></div></div>
        </div>
        <div className="roadmap">{result.project.milestones.map((milestone) => <article className="roadmap-step" key={`${milestone.week}-${milestone.title}`}><div className="roadmap-index">{milestone.week}</div><div className="roadmap-body"><span>里程碑 {milestone.week}</span><h4>{milestone.title}</h4><p><strong>交付物</strong>{milestone.deliverable}</p><p className="talking-point"><strong>面试可讲</strong>{milestone.talkingPoint}</p></div></article>)}</div>
        <div className="resume-output"><div><FileText size={20} /><span>做完后，简历可以这样写</span></div><p>{result.project.resumeLine}</p><button type="button" onClick={copyLine}><Copy size={16} /> {copied ? '已复制' : '复制表述'}</button></div>
        {result.analysisId && <div className="report-feedback" aria-live="polite"><span>{feedbackStatus === 'saved' ? '感谢反馈，后续会用来改进规则与提示。' : '这份诊断对你有帮助吗？'}</span><div><button type="button" onClick={() => sendFeedback('up')} aria-label="诊断有帮助">有帮助</button><button type="button" onClick={() => sendFeedback('down')} aria-label="诊断需要改进">需要改进</button></div></div>}
        <div className="quick-wins"><div className="quick-wins-heading"><span>热身，不是简历主角</span><h3>今天就能开始的 3 个小动作</h3></div><div className="quick-win-list">{result.quickWins.map((item, index) => <article key={item.title}><span>0{index + 1}</span><div><h4>{item.title}</h4><p>{item.outcome}</p></div><em>{item.duration}</em></article>)}</div></div>
      </section>

      <section className="report-footer-cta"><div><span>下一步已经不是继续看报告。</span><h2>去项目地图，比较更多真实仓库。</h2></div><div className="cta-row"><button className="secondary-button" type="button" onClick={onRestart}><RotateCcw size={16} /> 分析另一岗位</button><button className="primary-button" type="button" onClick={onProjects}>打开项目地图 <ArrowRight size={18} /></button></div></section>
    </div>
  )
}

function EvidenceRow({ skill }: { skill: AnalysisResult['skills'][number] }) {
  const labels: Record<Exclude<EvidenceLevel, 'missing'>, string> = { 'project-backed': '项目已证明', 'listed-only': '仅技能栏提及' }
  const level = skill.evidence as Exclude<EvidenceLevel, 'missing'>
  return <article className="evidence-row"><div className={`evidence-status ${level}`}><Check size={14} /> {labels[level]}</div><div><h3>{skill.name}</h3><p>“{skill.resumeQuote}”</p></div><span>{skill.priority === 'must' ? '核心要求' : '加分项'}</span></article>
}

function ProjectsView({ projects, result, loading, onDiagnose }: { projects: Project[]; result: AnalysisResult | null; loading: boolean; onDiagnose: () => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | 'useful' | 'fun'>('all')
  const [projectType, setProjectType] = useState('')
  const [businessDomain, setBusinessDomain] = useState('')
  const [jobFamily, setJobFamily] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [duration, setDuration] = useState('')
  const [visibleCount, setVisibleCount] = useState(6)
  const topics = useMemo(() => Array.from(new Set(projects.flatMap((project) => project.topics))).slice(0, 14), [projects])
  const businessDomains = useMemo(() => Array.from(new Set(projects.flatMap((project) => project.business_domains ?? []))).sort((left, right) => left.localeCompare(right, 'zh-CN')), [projects])
  const filtered = useMemo(() => projects.filter((project) => {
    const haystack = `${project.name} ${project.full_name} ${project.description} ${project.topics.join(' ')}`.toLowerCase()
    return (!search || haystack.includes(search.toLowerCase())) && (category === 'all' || project.category === category) && (!projectType || project.project_type === projectType) && (!businessDomain || (project.business_domains ?? []).includes(businessDomain)) && (!jobFamily || project.job_families.includes(jobFamily)) && (!topic || project.topics.includes(topic)) && (!difficulty || project.difficulty === difficulty) && (!duration || project.duration === duration)
  }).sort((left, right) => difficultyOrder[left.difficulty] - difficultyOrder[right.difficulty] || left.name.localeCompare(right.name, 'zh-CN')), [projects, search, category, projectType, businessDomain, jobFamily, topic, difficulty, duration])
  useEffect(() => setVisibleCount(6), [search, category, projectType, businessDomain, jobFamily, topic, difficulty, duration])

  const categoryGroups = ([
    { id: 'useful' as const, index: '01', eyebrow: 'Utility', title: '最好用的项目', copy: '优先补工程化、数据处理和工作流证据，做完能够进入真实学习或工作场景。' },
    { id: 'fun' as const, index: '02', eyebrow: 'Play', title: '最好玩的项目', copy: '用即时反馈和强互动做出可展示的 AI 体验，再把视觉结果转化成面试谈资。' },
  ]).filter((group) => category === 'all' || category === group.id).map((group) => ({
    ...group,
    total: filtered.filter((project) => project.category === group.id).length,
    projects: filtered.filter((project) => project.category === group.id).slice(0, visibleCount),
  })).filter((group) => group.total)
  const usefulCount = projects.filter((project) => project.category === 'useful').length
  const funCount = projects.filter((project) => project.category === 'fun').length
  const gapCount = result?.skills.filter((skill) => skill.evidence === 'missing').length ?? 0
  const activeFilterCount = [search, projectType, businessDomain, jobFamily, topic, difficulty, duration].filter(Boolean).length + (category === 'all' ? 0 : 1)
  const clearFilters = () => { setSearch(''); setCategory('all'); setProjectType(''); setBusinessDomain(''); setJobFamily(''); setTopic(''); setDifficulty(''); setDuration('') }

  return (
    <div className="product-page project-map-page">
      <section className="page-hero project-radar-hero">
        <div className="project-hero-copy">
          <div className="eyebrow"><span>02</span> Project Map</div>
          <h1>从能力缺口，<br /><i>走到可证明的项目。</i></h1>
          <p>一张地图连接你的目标岗位、当前 Gap 与真实 GitHub 仓库。先完成最小复刻，再把它改造成只有你能讲清楚的项目证据。</p>
          <div className="project-hero-actions">
            <button className="primary-button" type="button" onClick={result ? () => document.getElementById('personal-projects-title')?.scrollIntoView({ block: 'start' }) : onDiagnose}>{result ? '查看个性化推荐' : '先完成简历诊断'} <ArrowRight size={17} /></button>
            <span>{projects.length} 个真实仓库 · {result ? `${gapCount} 个待补能力` : '诊断后自动匹配缺口'}</span>
          </div>
        </div>
        <ol className="project-path" aria-label="项目成长路径">
          <li><span>01</span><div><strong>定位缺口</strong><p>从 JD 和简历证据中确定优先级。</p></div></li>
          <li><span>02</span><div><strong>复刻基线</strong><p>从真实开源仓库跑通最小版本。</p></div></li>
          <li><span>03</span><div><strong>形成证据</strong><p>加入行业数据、评估和失败复盘。</p></div></li>
        </ol>
      </section>

      <section className="recommended-projects project-map-recommendations" aria-labelledby="personal-projects-title">
        <div className="map-section-heading">
          <div><span>Personal Route</span><h2 id="personal-projects-title">最适合你现在开始的项目</h2></div>
          <p>个性化推荐负责给方向，下面的完整项目库负责让你比较和发现。</p>
        </div>
        {!result && <div className="diagnosis-invite"><Target size={22} /><div><strong>完成一次简历诊断，解锁个性化路线</strong><p>没有诊断也可以继续浏览项目库；完成诊断后，这里会解释每个项目覆盖了哪些 Gap。</p></div></div>}
        {result && <><div className="recommendation-context"><span>基于最近一次分析</span><strong>{result.role}</strong><p>{result.diagnosis}</p></div><div className="recommendation-list">{result.recommendations.map((item) => <RecommendationCard key={item.project.id} item={item} />)}</div></>}
      </section>

      <section className="radar-discovery" aria-labelledby="project-library-title">
          <div className="track-intro"><div><span>Project Library</span><h2 id="project-library-title">在同一张地图里继续发现</h2><p>先按项目价值分成“最好用”和“最好玩”，再在每个分类内部按入门、进阶、挑战逐级展开。</p></div><strong>{projects.length}<small> 个真实仓库</small></strong></div>

          <div className="track-selector" aria-label="项目路线">
            <button type="button" className={category === 'all' ? 'active all' : 'all'} onClick={() => setCategory('all')} aria-pressed={category === 'all'}>
              <span><em>00</em> All</span><strong>全部项目</strong><small>{projects.length} 个</small>
            </button>
            <button type="button" className={category === 'useful' ? 'active useful' : 'useful'} onClick={() => setCategory(category === 'useful' ? 'all' : 'useful')} aria-pressed={category === 'useful'}>
              <span><em>01</em> Utility</span><strong>最好用</strong><small>{usefulCount} 个</small>
            </button>
            <button type="button" className={category === 'fun' ? 'active fun' : 'fun'} onClick={() => setCategory(category === 'fun' ? 'all' : 'fun')} aria-pressed={category === 'fun'}>
              <span><em>02</em> Play</span><strong>最好玩</strong><small>{funCount} 个</small>
            </button>
          </div>

          <div className="radar-filter-panel">
            <div className="filter-heading"><div><span>Project Finder</span><h2>先说清楚你想做什么</h2><p>项目形态决定怎么做，业务方向决定做给谁用。</p></div><button type="button" onClick={clearFilters}><RotateCcw size={14} /> 清空筛选 {activeFilterCount ? `(${activeFilterCount})` : ''}</button></div>
            <div className="filter-search-row">
              <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索项目、技术或 GitHub 仓库" /></label>
              <div className="github-source-note"><Github size={17} /><div><strong>全部来自 GitHub</strong><span>每张卡片直达真实仓库</span></div></div>
            </div>
            <div className="filter-primary-grid">
              <FilterGroup tone="type" label="项目类型" value={projectType} onChange={setProjectType} options={[['', '全部类型'], ['Agent 应用', 'Agent'], ['Skill / 插件', 'Skill / 插件'], ['AI 工具', 'AI 工具'], ['数据评测', '数据评测'], ['视觉创作', '视觉创作'], ['游戏互动', '游戏互动']]} />
              <FilterGroup label="难度" value={difficulty} onChange={setDifficulty} options={[['', '全部难度'], ['入门', '入门'], ['进阶', '进阶'], ['挑战', '挑战']]} />
            </div>
            <details className="advanced-filters">
              <summary>更多筛选条件 <span>业务方向、岗位、周期和技术主题</span><ChevronRight size={16} /></summary>
              <div className="filter-secondary-grid">
                <FilterGroup tone="domain" label="业务方向" value={businessDomain} onChange={setBusinessDomain} options={[['', '全部场景'], ...businessDomains.map((value) => [value, value])]} />
                <FilterGroup label="岗位方向" value={jobFamily} onChange={setJobFamily} options={[['', '全部岗位'], ['ai_app_dev', 'AI 应用开发'], ['algorithm', '算法'], ['ai_product', 'AI 产品'], ['data', '数据']]} />
                <FilterGroup label="完成时间" value={duration} onChange={setDuration} options={[['', '全部周期'], ['1–3 天', '1–3 天'], ['1 周', '1 周'], ['2–4 周', '2–4 周'], ['长期项目', '长期项目']]} />
                <FilterGroup label="技术主题" value={topic} onChange={setTopic} options={[['', '全部主题'], ...topics.map((value) => [value, value])]} />
              </div>
            </details>
          </div>

          <div className="radar-results-heading"><p><Filter size={15} /> 共找到 <strong>{filtered.length}</strong> 个项目</p><span>每个分类内：入门 → 进阶 → 挑战</span></div>
          {loading && <LoadingRows />}
          {!loading && filtered.length === 0 && <EmptyState icon={Search} title="没有匹配的项目" copy="减少一个筛选条件，或者尝试搜索 RAG、Agent、Evals。" />}
          {!loading && categoryGroups.map((group) => (
            <section className={`category-board category-${group.id}`} key={group.id} aria-labelledby={`category-${group.id}`}>
              <div className="category-board-heading">
                <div className="category-index"><span>{group.index}</span><em>{group.eyebrow}</em></div>
                <div><h3 id={`category-${group.id}`}>{group.title}</h3><p>{group.copy}</p></div>
                <strong>{group.total}<small> 项</small></strong>
              </div>
              {(['入门', '进阶', '挑战'] as Project['difficulty'][]).map((level) => {
                const levelProjects = group.projects.filter((project) => project.difficulty === level)
                if (!levelProjects.length) return null
                return (
                  <div className={`category-difficulty-row difficulty-${level}`} key={`${group.id}-${level}`}>
                    <div className="category-difficulty-label"><span>{level}</span><p>{level === '入门' ? '先跑通最小闭环' : level === '进阶' ? '补评估与工程化' : '展示技术权衡与深度'}</p><strong>{levelProjects.length}</strong></div>
                    <div className="radar-card-grid">{levelProjects.map((project) => <ProjectCard key={project.id} project={project} rank={group.projects.indexOf(project) + 1} />)}</div>
                  </div>
                )
              })}
            </section>
          ))}
          {categoryGroups.some((group) => group.projects.length < group.total) && <div className="load-more-row"><button className="secondary-button" type="button" onClick={() => setVisibleCount((count) => count + 6)}>显示更多项目 <ArrowRight size={16} /></button></div>}
      </section>
      <ReferenceSources />
    </div>
  )
}

function loadCustomReferenceSources(): ReferenceSource[] {
  try {
    const stored = window.localStorage.getItem(REFERENCE_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ReferenceSource => Boolean(
      item && typeof item === 'object'
      && typeof (item as ReferenceSource).id === 'string'
      && typeof (item as ReferenceSource).provider === 'string'
      && typeof (item as ReferenceSource).label === 'string'
      && typeof (item as ReferenceSource).url === 'string',
    )).map((item) => ({ ...item, custom: true }))
  } catch {
    return []
  }
}

function ReferenceSources() {
  const [customSources, setCustomSources] = useState<ReferenceSource[]>(loadCustomReferenceSources)
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceError, setSourceError] = useState('')
  const sources = [...DEFAULT_REFERENCE_SOURCES, ...customSources]

  useEffect(() => {
    window.localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(customSources))
  }, [customSources])

  const addSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = sourceName.trim()
    if (!name) {
      setSourceError('请填写来源名称。')
      return
    }
    try {
      const parsedUrl = new URL(sourceUrl.trim())
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('unsupported protocol')
      const normalizedUrl = parsedUrl.toString()
      if (sources.some((source) => source.url === normalizedUrl)) {
        setSourceError('这个来源已经在列表中了。')
        return
      }
      setCustomSources((current) => [...current, {
        id: window.crypto.randomUUID(),
        provider: name,
        label: parsedUrl.hostname.replace(/^www\./, ''),
        url: normalizedUrl,
        custom: true,
      }])
      setSourceName('')
      setSourceUrl('')
      setSourceError('')
    } catch {
      setSourceError('请输入完整的 http:// 或 https:// 链接。')
    }
  }

  const removeSource = (sourceId: string) => {
    setCustomSources((current) => current.filter((source) => source.id !== sourceId))
  }

  return (
    <section className="reference-sources" aria-labelledby="reference-sources-title">
      <div className="reference-intro">
        <span>Reference</span>
        <h2 id="reference-sources-title">发现渠道</h2>
        <p>项目库从这些公开渠道持续发现候选项目，再经过真实性、可复刻性和岗位相关性筛选。</p>
      </div>
      <div className="reference-content">
        <div className="reference-list">
          {sources.map((source) => (
            <article className="reference-source" key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                <span>{source.provider}</span>
                <i aria-hidden="true">·</i>
                <strong>{source.label}</strong>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              {source.custom && <button type="button" onClick={() => removeSource(source.id)} aria-label={`删除来源 ${source.provider}`} title="删除自定义来源"><Trash2 size={15} /></button>}
            </article>
          ))}
        </div>

        <form className="reference-source-form" onSubmit={addSource} noValidate>
          <div className="reference-form-heading"><Link2 size={18} /><div><strong>添加你的发现渠道</strong><span>自定义来源仅保存在当前浏览器</span></div></div>
          <label><span>来源名称</span><input value={sourceName} onChange={(event) => { setSourceName(event.target.value); setSourceError('') }} placeholder="例如：Hacker News" /></label>
          <label className="reference-url-field"><span>来源链接</span><input type="url" value={sourceUrl} onChange={(event) => { setSourceUrl(event.target.value); setSourceError('') }} placeholder="https://…" /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> 添加来源</button>
          {sourceError && <p className="reference-form-error" role="alert">{sourceError}</p>}
        </form>
      </div>
    </section>
  )
}

function FilterGroup({ label, value, options, onChange, tone = 'neutral' }: { label: string; value: string; options: string[][]; onChange: (value: string) => void; tone?: 'neutral' | 'type' | 'domain' }) {
  return <div className={`filter-group filter-group-${tone}`}><strong>{label}</strong><div>{options.map(([option, text]) => <button key={`${label}-${option}`} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{text}</button>)}</div></div>
}

function RecommendationCard({ item }: { item: AnalysisResult['recommendations'][number] }) {
  return (
    <article className="recommendation-card">
      <div className="recommend-card-head"><div className="recommend-rank">0{item.rank}</div><div className="repo-line"><span>{item.project.value}</span><em>{item.project.difficulty} · {item.project.duration}</em></div></div>
      <div className="recommend-main"><div className="recommend-type-line"><span>{item.project.project_type ?? '开源项目'}</span>{item.project.business_domains?.slice(0, 2).map((domain) => <em key={domain}>{domain}</em>)}</div><h2>{item.project.name}</h2><a href={item.project.url} target="_blank" rel="noreferrer"><Github size={15} /> {item.project.full_name} <ExternalLink size={13} /></a><p>{item.project.description}</p></div>
      <div className="recommend-reason"><span>为什么推荐</span><p>{item.reason}</p><div>{item.matched_gaps.map((gap) => <strong key={gap}>{gap}</strong>)}</div></div>
      <div className="recommend-adapt"><span>你的改造方向</span><p>{item.adaptation}</p><a href={item.project.url} target="_blank" rel="noreferrer">查看源码 <ArrowRight size={14} /></a></div>
    </article>
  )
}

function ProjectCard({ project, rank }: { project: Project; rank: number }) {
  const projectType = project.project_type ?? '开源项目'

  return (
    <article className={`radar-project-card ${project.category}`} data-project-type={projectType}>
      <div className="radar-card-top"><span>#{String(rank).padStart(2, '0')}</span><div className="verified-source"><ShieldCheck size={13} /> GitHub 已核验</div></div>
      <div className="radar-card-body">
        <div className="card-classification"><em>{projectType}</em><strong>{project.value}</strong></div>
        <h4>{project.name}</h4>
        <a href={project.url} target="_blank" rel="noreferrer"><Github size={14} /> {project.full_name}</a>
        <p className="project-summary">{project.description}</p>
        <div className="tag-row">{project.topics.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</div>
        <p className="project-next-step"><strong>建议做成：</strong>{project.copy_angle}</p>
      </div>
      <div className="radar-card-footer"><span><Clock3 size={14} /> {project.duration}</span><strong className={`difficulty-pill difficulty-${project.difficulty}`}>{project.difficulty}</strong><a href={project.url} target="_blank" rel="noreferrer"><Github size={13} /> GitHub <ExternalLink size={12} /></a></div>
    </article>
  )
}

function BriefsView({ briefs, loading, result, briefWindow, onBriefWindowChange }: { briefs: Briefs | null; loading: boolean; result: AnalysisResult | null; briefWindow: '24h' | '7d'; onBriefWindowChange: (window: '24h' | '7d') => void }) {
  const [briefMode, setBriefMode] = useState<'hotspots' | 'practice'>('hotspots')

  return (
    <div className="product-page briefs-page">
      <section className="page-hero briefs-hero"><div><div className="eyebrow"><span>03</span> Interview Brief</div><h1>别追所有热点。<br /><i>只留下能讲清楚的。</i></h1><p>把行业变化翻译成目标岗位会怎么问、你的项目如何接得上。</p></div><div className="brief-date"><span>{briefMode === 'hotspots' ? 'Today' : 'Practice'}</span><strong>{briefMode === 'hotspots' ? (briefs?.date ?? '正在更新') : '本周 · 15 分钟'}</strong></div></section>
      <section className="brief-mode-switch" aria-label="AI 谈资内容类型">
        <div role="tablist" aria-label="选择内容类型">
          <button type="button" role="tab" aria-selected={briefMode === 'hotspots'} aria-controls="brief-hotspots-panel" onClick={() => setBriefMode('hotspots')}>
            <span>今日热点</span><em>5 条精选</em>
          </button>
          <button type="button" role="tab" aria-selected={briefMode === 'practice'} aria-controls="brief-practice-panel" onClick={() => setBriefMode('practice')}>
            <span>工具实战</span><em>本周 1 个</em>
          </button>
        </div>
        <p>{briefMode === 'hotspots' ? '知道今天发生了什么' : '把“了解过”变成“实际做过”'}</p>
      </section>
      {briefMode === 'hotspots' && loading && <LoadingRows />}
      {briefMode === 'hotspots' && !loading && briefs && <div id="brief-hotspots-panel" role="tabpanel">
        <DailyHotspots hotspots={briefs.hotspots ?? emptyHotspots} date={briefs.date} targetRole={result?.role} windowKey={briefWindow} onWindowChange={onBriefWindowChange} />
        <section className="deep-brief">
          <div className="deep-brief-heading"><span>我的深度谈资</span><h2>{briefs.deepCard.event}</h2><p>{result ? `已结合你最近的「${result.project.title}」生成回答尾巴。` : '完成一次诊断后，这里会自动接到你的目标岗位和项目。'}</p></div>
          <div className="brief-flow">
            <BriefStep icon={Target} label="与岗位的关系" text={briefs.deepCard.relationship} />
            <BriefStep icon={Waypoints} label="面试官可能怎么问" text={briefs.deepCard.question} />
            <BriefStep icon={Lightbulb} label="参考回答" text={briefs.deepCard.answer} featured />
            <BriefStep icon={AlertTriangle} label="别踩的坑" text={briefs.deepCard.pitfall} />
          </div>
        </section>
        <section className="daily-briefs"><div className="section-heading-row"><div><span>长期趋势</span><h2>5 条持续影响 AI 岗位的变化</h2></div><p>背景事实 + 为什么与你有关</p></div><div className="brief-list">{briefs.items.map((item, index) => <article key={item.title}><span>0{index + 1}</span><div><div className="tag-row">{item.tags.map((tag) => <em key={tag}>{tag}</em>)}</div><h3>{item.title}</h3><p>{item.fact}</p><strong>为什么值得知道</strong><p>{item.why}</p></div></article>)}</div></section>
      </div>}
      {briefMode === 'practice' && <div id="brief-practice-panel" role="tabpanel"><AiImagePractice /></div>}
    </div>
  )
}

type ImagePracticeTool = {
  name: string
  note: string
  url: string
  resources?: ImagePracticeResource[]
  custom?: boolean
}

type ImagePracticeResource = {
  label: string
  url: string
}

const imagePracticeTools: ImagePracticeTool[] = [
  { name: '即梦', note: '中文提示词友好，适合快速上手', url: 'https://jimeng.jianying.com/', resources: [{ label: '教程参考', url: 'https://search.bilibili.com/all?keyword=即梦%20AI%20生图%20教程' }] },
  { name: '通义万相', note: '国内访问方便，适合中文创意图', url: 'https://tongyi.aliyun.com/wanxiang/', resources: [{ label: '教程参考', url: 'https://search.bilibili.com/all?keyword=通义万相%20教程' }] },
  { name: 'DALL·E', note: '适合体验对话式修改和指令跟随', url: 'https://openai.com/index/dall-e-3/', resources: [{ label: '官方指南', url: 'https://platform.openai.com/docs/guides/images' }] },
  { name: 'Midjourney', note: '审美和风格表现突出，适合探索视觉方向（有订阅门槛）', url: 'https://www.midjourney.com/', resources: [{ label: '官方文档', url: 'https://docs.midjourney.com/' }] },
  { name: 'Stable Diffusion / ComfyUI', note: '可控性和扩展性强，适合学习本地工作流（配置成本高）', url: 'https://github.com/comfyanonymous/ComfyUI', resources: [{ label: '官方文档', url: 'https://docs.comfy.org/' }] },
]

const IMAGE_PRACTICE_TOOLS_STORAGE_KEY = 'offermapping_ai_image_practice_tools'
const IMAGE_PRACTICE_CRITERIA_STORAGE_KEY = 'offermapping_ai_image_practice_criteria'

const readStoredCustomTools = (): ImagePracticeTool[] => {
  try {
    const raw = window.localStorage.getItem(IMAGE_PRACTICE_TOOLS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((tool): tool is ImagePracticeTool => (
      tool && typeof tool.name === 'string' && tool.name.trim().length > 0 && tool.custom === true
    ))
  } catch {
    return []
  }
}

const imagePromptVariants = [
  {
    label: '路线地图',
    scene: '社交媒体宣传图',
    ratio: '3:4',
    subject: '一张正在展开的职业路线地图，包含简历、项目和面试三个清晰节点',
    style: '米白纸张质感、深绿色文字和克制的黄绿色强调色，编辑式排版',
    layout: '主体居中偏下，顶部留出完整标题区域，信息层级清楚',
    exclusions: '不要生成具体中文文字，不要霓虹光效，不要复杂人物特写',
  },
  {
    label: '求职工作台',
    scene: '产品功能宣传图',
    ratio: '3:4',
    subject: '一张俯视角求职工作台，桌面上依次摆放职位描述、简历诊断报告和项目路线卡片',
    style: '自然纸张与轻微印刷颗粒感，深绿和暖灰配色，理性克制的杂志版式',
    layout: '三份材料形成从左上到右下的阅读路径，右上角保留标题空间',
    exclusions: '不要可识别个人信息，不要生成小段中文，不要科技蓝光和悬浮光球',
  },
  {
    label: '能力成长前后',
    scene: '面试经验分享配图',
    ratio: '3:4',
    subject: '左右对照的能力成长画面，左侧是零散技能标签，右侧是被项目证据连接起来的完整能力地图',
    style: '简洁信息图与编辑插画结合，米白底色、墨绿色线条、少量黄绿色标记',
    layout: '左右两栏对比明确，中间用一条细线连接，底部留出说明区域',
    exclusions: '不要夸张成功符号，不要奖杯和火箭，不要生成不可读文字，不要渐变霓虹背景',
  },
]

const promptStructure = [
  { label: '任务目标', description: '告诉模型为谁、要完成什么任务', replaceable: false },
  { label: '使用场景', description: '决定图片最终出现在哪里', replaceable: true },
  { label: '画幅比例', description: '先适配发布渠道，再考虑构图', replaceable: true },
  { label: '画面主体', description: '明确用户第一眼应该看到什么', replaceable: true },
  { label: '风格与布局', description: '约束颜色、材质、层级和留白', replaceable: true },
  { label: '排除项', description: '提前写出最不想出现的结果', replaceable: true },
]

const buildImagePracticePrompt = (variant: typeof imagePromptVariants[number]) => `为一款帮助应届生准备 AI 岗位面试的产品 OfferMapping 生成一张 ${variant.ratio} ${variant.scene}。画面主体是${variant.subject}。使用${variant.style}。构图要求：${variant.layout}。避免内容：${variant.exclusions}。`

type BenchmarkScore = {
  ratings: Record<string, number>
  note: string
}

type BenchmarkCriterion = {
  key: string
  label: string
  hint: string
  custom?: boolean
}

const benchmarkCriteria: BenchmarkCriterion[] = [
  { key: 'prompt', label: '提示词理解', hint: '是否准确还原任务、主体和风格' },
  { key: 'quality', label: '画面质量', hint: '构图、细节和整体完成度' },
  { key: 'controllability', label: '修改可控性', hint: '按要求调整后，结果是否稳定' },
  { key: 'speed', label: '生成速度', hint: '从提交到得到可用结果的体感' },
  { key: 'text', label: '中文文字稳定性', hint: '文字区域是否需要大量人工修正' },
] 

const readStoredCustomCriteria = (): BenchmarkCriterion[] => {
  try {
    const raw = window.localStorage.getItem(IMAGE_PRACTICE_CRITERIA_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((criterion): criterion is BenchmarkCriterion => (
      criterion && typeof criterion.key === 'string' && criterion.key.startsWith('custom-') &&
      typeof criterion.label === 'string' && criterion.label.trim().length > 0 &&
      typeof criterion.hint === 'string'
    ))
  } catch {
    return []
  }
}

type BenchmarkCriterionKey = string

const createBenchmarkScore = (): BenchmarkScore => ({ ratings: {}, note: '' })
const getBenchmarkRating = (score: BenchmarkScore, key: string) => score.ratings[key] ?? 0

const createBenchmarkScores = (tools: ImagePracticeTool[] = imagePracticeTools) => tools.reduce<Record<string, BenchmarkScore>>((scores, tool) => {
  scores[tool.name] = createBenchmarkScore()
  return scores
}, {})

function AiImagePractice() {
  const [started, setStarted] = useState(false)
  const [practiceTools, setPracticeTools] = useState<ImagePracticeTool[]>(() => [...imagePracticeTools, ...readStoredCustomTools()])
  const [selectedTool, setSelectedTool] = useState(imagePracticeTools[0].name)
  const [customToolOpen, setCustomToolOpen] = useState(false)
  const [customToolName, setCustomToolName] = useState('')
  const [customToolUrl, setCustomToolUrl] = useState('')
  const [customToolTutorialUrl, setCustomToolTutorialUrl] = useState('')
  const [customToolNote, setCustomToolNote] = useState('')
  const [customToolError, setCustomToolError] = useState('')
  const [promptVariantIndex, setPromptVariantIndex] = useState(0)
  const [promptFields, setPromptFields] = useState({ ...imagePromptVariants[0] })
  const [customizingPrompt, setCustomizingPrompt] = useState(false)
  const [resultUrl, setResultUrl] = useState('')
  const [firstAttempt, setFirstAttempt] = useState('')
  const [changeMade, setChangeMade] = useState('')
  const [resultAfter, setResultAfter] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [benchmarkStarted, setBenchmarkStarted] = useState(false)
  const [benchmarkCriteriaList, setBenchmarkCriteriaList] = useState<BenchmarkCriterion[]>(() => [...benchmarkCriteria, ...readStoredCustomCriteria()])
  const [customCriterionOpen, setCustomCriterionOpen] = useState(false)
  const [customCriterionName, setCustomCriterionName] = useState('')
  const [customCriterionHint, setCustomCriterionHint] = useState('')
  const [customCriterionError, setCustomCriterionError] = useState('')
  const [benchmarkTools, setBenchmarkTools] = useState<string[]>([imagePracticeTools[0].name, imagePracticeTools[1].name])
  const [benchmarkScores, setBenchmarkScores] = useState<Record<string, BenchmarkScore>>(() => createBenchmarkScores([...imagePracticeTools, ...readStoredCustomTools()]))
  const [benchmarkConclusion, setBenchmarkConclusion] = useState('')
  const [benchmarkAnswer, setBenchmarkAnswer] = useState('')
  const [benchmarkError, setBenchmarkError] = useState('')
  const imagePracticePrompt = useMemo(() => buildImagePracticePrompt(promptFields), [promptFields])

  useEffect(() => {
    const customTools = practiceTools.filter((tool) => tool.custom)
    window.localStorage.setItem(IMAGE_PRACTICE_TOOLS_STORAGE_KEY, JSON.stringify(customTools))
  }, [practiceTools])

  useEffect(() => {
    const customCriteria = benchmarkCriteriaList.filter((criterion) => criterion.custom)
    window.localStorage.setItem(IMAGE_PRACTICE_CRITERIA_STORAGE_KEY, JSON.stringify(customCriteria))
  }, [benchmarkCriteriaList])

  const changePromptVersion = () => {
    const nextIndex = (promptVariantIndex + 1) % imagePromptVariants.length
    setPromptVariantIndex(nextIndex)
    setPromptFields({ ...imagePromptVariants[nextIndex] })
    setCopied(false)
    setCopyFailed(false)
  }

  const updatePromptField = (field: keyof typeof promptFields, value: string) => {
    setPromptFields((current) => ({ ...current, [field]: value }))
    setCopied(false)
    setCopyFailed(false)
  }

  const copyPrompt = async () => {
    let succeeded = false
    try {
      await navigator.clipboard.writeText(imagePracticePrompt)
      succeeded = true
    } catch {
      const fallback = document.createElement('textarea')
      fallback.value = imagePracticePrompt
      fallback.setAttribute('readonly', '')
      fallback.style.position = 'fixed'
      fallback.style.opacity = '0'
      document.body.appendChild(fallback)
      fallback.select()
      succeeded = document.execCommand('copy')
      document.body.removeChild(fallback)
    }

    setCopied(succeeded)
    setCopyFailed(!succeeded)
    if (succeeded) window.setTimeout(() => setCopied(false), 5000)
  }

  const generateAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanFirstAttempt = firstAttempt.trim()
    const cleanChangeMade = changeMade.trim()
    const cleanResultAfter = resultAfter.trim()
    if ([cleanFirstAttempt, cleanChangeMade, cleanResultAfter].some((value) => value.length < 8)) {
      setError('请按顺序写完三段：第一次哪里不满意、你做了什么修改、结果发生了什么变化。')
      return
    }

    setError('')
    const normalizedFirstAttempt = cleanFirstAttempt.replace(/^(?:第一次生成时|第一次生成|第一次)[：:，,\s]*/, '').replace(/[。！？!?；;]+$/, '')
    const normalizedChangeMade = cleanChangeMade.replace(/^(?:我做了|我)[：:，,\s]*/, '').replace(/[。！？!?；;]+$/, '')
    const normalizedResultAfter = cleanResultAfter.replace(/^(?:结果是|结果)[：:，,\s]*/, '').replace(/[。！？!?；;]+$/, '')
    setAnswer(`我实际用 ${selectedTool} 做过一次 AI 生图小实验：为 OfferMapping 生成社交媒体宣传图。我先明确了画面比例、主体、品牌色和需要避免的元素。第一次生成时，${normalizedFirstAttempt}；然后我做了${normalizedChangeMade}；结果是${normalizedResultAfter}。这次体验让我觉得 AI 生图很适合快速探索视觉方向，但正式使用时仍需要人工检查文字准确性、品牌一致性和版权风险。`)
  }

  const addCustomTool = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = customToolName.trim()
    const url = customToolUrl.trim()
    const note = customToolNote.trim() || '用户自定义工具，可按自己的访问条件记录结果'
    if (!name) {
      setCustomToolError('请先填写工具名称。')
      return
    }
    if (practiceTools.some((tool) => tool.name.toLowerCase() === name.toLowerCase())) {
      setCustomToolError('这个工具已经在列表里了，请换一个名称。')
      return
    }
    const resources = customToolTutorialUrl.trim() ? [{ label: '教程参考', url: customToolTutorialUrl.trim() }] : undefined
    const newTool: ImagePracticeTool = { name, note, url, resources, custom: true }
    setPracticeTools((current) => [...current, newTool])
    setBenchmarkScores((current) => ({ ...current, [name]: createBenchmarkScore() }))
    setSelectedTool(name)
    setCustomToolName('')
    setCustomToolUrl('')
    setCustomToolTutorialUrl('')
    setCustomToolNote('')
    setCustomToolError('')
    setCustomToolOpen(false)
  }

  const addCustomCriterion = () => {
    const label = customCriterionName.trim()
    const hint = customCriterionHint.trim() || '按你定义的观察方式，对每个工具统一打分'
    if (!label) {
      setCustomCriterionError('请先填写标准名称。')
      return
    }
    if (benchmarkCriteriaList.some((criterion) => criterion.label.toLowerCase() === label.toLowerCase())) {
      setCustomCriterionError('这个标准已经存在，请换一个名称。')
      return
    }
    setBenchmarkCriteriaList((current) => [...current, { key: `custom-${Date.now()}`, label, hint, custom: true }])
    setCustomCriterionName('')
    setCustomCriterionHint('')
    setCustomCriterionError('')
    setCustomCriterionOpen(false)
    setBenchmarkConclusion('')
    setBenchmarkAnswer('')
  }

  const toggleBenchmarkTool = (toolName: string) => {
    if (!benchmarkTools.includes(toolName) && benchmarkTools.length >= 5) {
      setBenchmarkError('一次最多选择 5 个工具。先完成这一轮，再更换工具继续比较。')
      return
    }
    setBenchmarkTools((current) => current.includes(toolName) ? current.filter((name) => name !== toolName) : [...current, toolName])
    setBenchmarkError('')
    setBenchmarkConclusion('')
    setBenchmarkAnswer('')
  }

  const updateBenchmarkScore = (toolName: string, key: BenchmarkCriterionKey, value: number) => {
    setBenchmarkScores((current) => ({ ...current, [toolName]: { ...current[toolName], ratings: { ...current[toolName].ratings, [key]: value } } }))
    setBenchmarkError('')
    setBenchmarkConclusion('')
    setBenchmarkAnswer('')
  }

  const updateBenchmarkNote = (toolName: string, value: string) => {
    setBenchmarkScores((current) => ({ ...current, [toolName]: { ...current[toolName], note: value } }))
  }

  const generateBenchmark = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (benchmarkTools.length < 2) {
      setBenchmarkError('至少选择 2 个工具，才能形成有意义的横向比较。')
      return
    }
    const incompleteTool = benchmarkTools.find((toolName) => benchmarkCriteriaList.some((criterion) => getBenchmarkRating(benchmarkScores[toolName], criterion.key) === 0))
    if (incompleteTool) {
      setBenchmarkError(`请先完成 ${incompleteTool} 的 ${benchmarkCriteriaList.length} 个评分维度，再生成结论。`)
      return
    }

    const averages = benchmarkTools.map((toolName) => {
      const score = benchmarkScores[toolName]
      const average = benchmarkCriteriaList.reduce((sum, criterion) => sum + getBenchmarkRating(score, criterion.key), 0) / benchmarkCriteriaList.length
      return { toolName, average }
    }).sort((a, b) => b.average - a.average)
    const leader = averages[0]
    const strongestCriterion = benchmarkCriteriaList.map((criterion) => {
      const best = benchmarkTools.reduce((current, toolName) => getBenchmarkRating(benchmarkScores[toolName], criterion.key) > current.score ? { toolName, score: getBenchmarkRating(benchmarkScores[toolName], criterion.key) } : current, { toolName: '', score: 0 })
      return `${criterion.label}：${best.toolName} ${best.score} 分`
    }).join('；')
    const summary = averages.map(({ toolName, average }) => `${toolName} 平均 ${average.toFixed(1)} 分`).join('；')
    setBenchmarkConclusion(`在同一任务、同一版提示词和相近生成次数下，${summary}。当前样本中 ${leader.toolName} 综合分最高，但这只代表本次任务的选择结果，不代表绝对排名。${strongestCriterion}`)
    setBenchmarkAnswer(`我用同一个 OfferMapping 宣传图任务和同一版提示词，对 ${benchmarkTools.join('、')} 做了小样本横向测评。我按照 ${benchmarkCriteriaList.map((criterion) => criterion.label).join('、')} 共 ${benchmarkCriteriaList.length} 个维度打分，结果是 ${leader.toolName} 综合表现最好，但不同工具各有强项，所以我会根据任务类型选择，而不会简单说哪个工具绝对最好。`)
    setBenchmarkError('')
  }

  return (
    <section className="tool-practice" aria-labelledby="image-practice-title">
      <div className="practice-edition-line"><span>WEEKLY FIELD NOTE · 01</span><span>AI IMAGE GENERATION</span><span>约 15 分钟</span></div>
      <div className="practice-shell">
        <aside className="practice-index">
          <span>本周实战</span>
          <ImageIcon size={34} strokeWidth={1.4} />
          <h2>AI 生图</h2>
          <p>不做工具百科，只完成一次能在面试里讲清楚的小实验。</p>
          <dl>
            <div><dt>难度</dt><dd>入门</dd></div>
            <div><dt>时间</dt><dd>15 min</dd></div>
            <div><dt>产出</dt><dd>1 张图</dd></div>
          </dl>
        </aside>

        <div className="practice-content">
          <header className="practice-lead">
            <div className="practice-kicker"><Palette size={15} /> 从“了解过”到“实际做过”</div>
            <h2 id="image-practice-title">做一张图，换来一段<br />经得起追问的回答。</h2>
            <p>任务刻意控制在 15 分钟内。你不需要成为设计师，只需要留下真实的选择、修改和判断。</p>
            <div className="practice-outcomes">
              <div><span>01</span><strong>认识工具</strong><p>知道主流产品各自适合什么。</p></div>
              <div><span>02</span><strong>完成任务</strong><p>为当前项目生成一张宣传图。</p></div>
              <div><span>03</span><strong>留下证据</strong><p>把过程翻译成可信面试回答。</p></div>
              <div><span>04</span><strong>学会比较</strong><p>用统一条件判断工具适配场景。</p></div>
            </div>
            {!started && <button className="practice-start" type="button" onClick={() => setStarted(true)}>开始 15 分钟实战 <ArrowRight size={16} /></button>}
          </header>

          {started && (
            <div className="practice-workflow">
              <section className="practice-step">
                <div className="practice-step-number">01</div>
                <div className="practice-step-body">
                  <span>选择一个工具</span>
                  <h3>先选容易访问的，不做横评。</h3>
                  <div className="practice-tool-list">
                    {practiceTools.map((tool) => (
                      <div key={tool.name} className={selectedTool === tool.name ? 'selected' : ''}>
                        <button type="button" aria-pressed={selectedTool === tool.name} onClick={() => setSelectedTool(tool.name)}>
                          <strong>{tool.name}</strong><span>{tool.note}</span>
                        </button>
                        <div className="practice-tool-links">
                          {tool.url && <a className="tool-home-link" href={tool.url} target="_blank" rel="noreferrer">官网 <ExternalLink size={12} /></a>}
                          {tool.resources?.map((resource) => <a className="tool-resource-link" key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.label} <ExternalLink size={12} /></a>)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="custom-tool-toggle" type="button" aria-expanded={customToolOpen} aria-controls="custom-tool-form" onClick={() => { setCustomToolOpen((current) => !current); setCustomToolError('') }}>+ 添加自定义工具</button>
                  {customToolOpen && <form className="custom-tool-form" id="custom-tool-form" onSubmit={addCustomTool}>
                    <div className="custom-tool-form-heading"><div><span>YOUR TOOL</span><strong>把你真正用过的工具加入测评池</strong></div><p>名称必填；官网链接和特点可留空。添加后会保存在当前浏览器。</p></div>
                    <div className="custom-tool-form-grid">
                      <label>工具名称 <em>必填</em><input required value={customToolName} onChange={(event) => setCustomToolName(event.target.value)} placeholder="例如：豆包、Leonardo AI" /></label>
                      <label>官网 / 入口链接 <em>选填</em><input type="url" value={customToolUrl} onChange={(event) => setCustomToolUrl(event.target.value)} placeholder="https://..." /></label>
                      <label>教程链接 <em>选填</em><input type="url" value={customToolTutorialUrl} onChange={(event) => setCustomToolTutorialUrl(event.target.value)} placeholder="https://..." /></label>
                      <label className="wide">一句特点 <em>选填</em><input value={customToolNote} onChange={(event) => setCustomToolNote(event.target.value)} placeholder="例如：适合做产品电商图，中文文字需要后期处理" /></label>
                    </div>
                    {customToolError && <p className="practice-error" role="alert"><AlertTriangle size={14} />{customToolError}</p>}
                    <div className="custom-tool-actions"><button type="button" onClick={() => { setCustomToolOpen(false); setCustomToolError('') }}>取消</button><button className="practice-generate" type="submit">加入工具池 <ArrowRight size={14} /></button></div>
                  </form>}
                </div>
              </section>

              <section className="practice-step">
                <div className="practice-step-number">02</div>
                <div className="practice-step-body">
                  <span>完成唯一任务</span>
                  <h3>为 OfferMapping 生成一张宣传图。</h3>
                  <p className="practice-instruction">先看懂提示词由哪些部分组成，再复制生成。如果结果不理想，优先只替换一个变量，才能知道是哪项修改产生了效果。</p>
                  <div className="prompt-purpose-note">
                    <Target size={16} />
                    <div><strong>这一步的目的</strong><p>建立“改了什么 → 结果怎么变”的对应关系。熟悉后可以同时修改多项，这里只是学习建议，不是系统限制。</p></div>
                  </div>
                  <div className="prompt-anatomy">
                    <div><span>PROMPT ANATOMY</span><strong>一条可控提示词的 6 个积木</strong></div>
                    <ol>
                      {promptStructure.map((part, index) => <li key={part.label}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{part.label}</strong>{part.replaceable && <em>可替换</em>}<p>{part.description}</p></div></li>)}
                    </ol>
                  </div>
                  <div className="prompt-version-bar">
                    <div><span>当前版本 {promptVariantIndex + 1} / {imagePromptVariants.length}</span><strong>{promptFields.label}</strong></div>
                    <div>
                      <button type="button" onClick={changePromptVersion}><RotateCcw size={14} /> 换一个提示词</button>
                      <button type="button" aria-expanded={customizingPrompt} aria-controls="prompt-customizer" onClick={() => setCustomizingPrompt((current) => !current)}>{customizingPrompt ? '收起自定义' : '自定义可替换项'} <ChevronDown size={14} /></button>
                    </div>
                  </div>
                  <div className="practice-prompt">
                    <p>{imagePracticePrompt}</p>
                    <button type="button" className={copyFailed ? 'failed' : ''} onClick={copyPrompt}>{copyFailed ? <AlertTriangle size={14} /> : copied ? <Check size={14} /> : <Copy size={14} />}{copyFailed ? '请手动复制' : copied ? '已复制' : '复制提示词'}</button>
                  </div>
                  {customizingPrompt && (
                    <div className="prompt-customizer" id="prompt-customizer">
                      <div className="prompt-customizer-heading"><span>REPLACEABLE FIELDS</span><p>修改后，上方完整提示词会立即更新。学习时可先只改一项，熟悉后可以同时改多项。</p></div>
                      <div className="prompt-customizer-grid">
                        <label>使用场景 <em>可替换</em><input value={promptFields.scene} onChange={(event) => updatePromptField('scene', event.target.value)} /></label>
                        <label>画幅比例 <em>可替换</em><select value={promptFields.ratio} onChange={(event) => updatePromptField('ratio', event.target.value)}><option value="3:4">3:4 · 小红书 / 竖版</option><option value="1:1">1:1 · 方形封面</option><option value="16:9">16:9 · 视频 / 演示</option><option value="9:16">9:16 · 手机全屏</option></select></label>
                        <label className="wide">画面主体 <em>可替换</em><textarea rows={2} value={promptFields.subject} onChange={(event) => updatePromptField('subject', event.target.value)} /></label>
                        <label className="wide">风格描述 <em>可替换</em><textarea rows={2} value={promptFields.style} onChange={(event) => updatePromptField('style', event.target.value)} /></label>
                        <label className="wide">构图要求 <em>可替换</em><input value={promptFields.layout} onChange={(event) => updatePromptField('layout', event.target.value)} /></label>
                        <label className="wide">不希望出现 <em>可替换</em><input value={promptFields.exclusions} onChange={(event) => updatePromptField('exclusions', event.target.value)} /></label>
                      </div>
                      <button type="button" onClick={() => { setPromptFields({ ...imagePromptVariants[promptVariantIndex] }); setCopied(false); setCopyFailed(false) }}><RotateCcw size={13} /> 恢复当前推荐版本</button>
                    </div>
                  )}
                </div>
              </section>

              <section className="practice-step">
                <div className="practice-step-number">03</div>
                <div className="practice-step-body">
                  <span>记录真实过程</span>
                  <h3>把一次迭代记录完整，回答才有证据。</h3>
                  <p className="practice-instruction">按“第一次结果 → 做了什么修改 → 修改后结果”的顺序填写。不要只写“变好了”，尽量描述具体变化。</p>
                  <form className="practice-reflection" onSubmit={generateAnswer}>
                    <label>作品链接 <em>选填</em><input type="url" value={resultUrl} onChange={(event) => setResultUrl(event.target.value)} placeholder="粘贴公开作品链接；暂时没有可以跳过" /></label>
                    <div className="reflection-flow" aria-label="记录一次提示词迭代">
                      <label><strong><b>01</b>第一次生成：哪里不满意？</strong><em>先描述看到的现象</em><textarea value={firstAttempt} onChange={(event) => setFirstAttempt(event.target.value)} placeholder="例如：画面信息太多，主体不突出；人物手部也不稳定。" rows={4} /></label>
                      <label><strong><b>02</b>我做了什么修改？</strong><em>写清楚改了哪个变量</em><textarea value={changeMade} onChange={(event) => setChangeMade(event.target.value)} placeholder="例如：删掉中文文字要求，并把主体位置改成居中偏下。" rows={4} /></label>
                      <label><strong><b>03</b>修改后结果如何？</strong><em>对比前后变化</em><textarea value={resultAfter} onChange={(event) => setResultAfter(event.target.value)} placeholder="例如：主体更集中，层级更清楚，但小字仍然需要人工处理。" rows={4} /></label>
                    </div>
                    {error && <p className="practice-error"><AlertTriangle size={14} />{error}</p>}
                    <button className="practice-generate" type="submit">生成面试回答 <ArrowRight size={15} /></button>
                  </form>
                </div>
              </section>

              <section className="practice-step benchmark-step">
                <div className="practice-step-number">04</div>
                <div className="practice-step-body">
                  <span>进阶横向测评</span>
                  <h3>同一个任务，比较不同工具的真实差异。</h3>
                  <p className="practice-instruction">完成一次单工具实验后，再用同一任务、同一版提示词和相近生成次数比较 2–3 个工具。这里记录的是你的本次小样本证据，不是“哪个工具永远最好”的排行榜。</p>
                  {!benchmarkStarted && <button className="benchmark-start" type="button" onClick={() => setBenchmarkStarted(true)}>开始横向测评 <ArrowRight size={15} /></button>}
                  {benchmarkStarted && (
                    <form className="benchmark-workbench" onSubmit={generateBenchmark}>
                      <div className="benchmark-conditions">
                        <div><span>固定 01</span><strong>同一个任务</strong><p>为 OfferMapping 生成同一张宣传图。</p></div>
                        <div><span>固定 02</span><strong>同一版提示词</strong><p>复制上方当前提示词，不临时换目标。</p></div>
                        <div><span>固定 03</span><strong>相近生成次数</strong><p>尽量记录相近轮次，避免只比较偶然结果。</p></div>
                      </div>
                      <div className="benchmark-picker">
                        <div><span>选择测评工具</span><p>至少 2 个，最多 5 个；先从你真正能访问的工具开始。已选 {benchmarkTools.length} / 5</p></div>
                        <div className="benchmark-tool-picker">
                          {practiceTools.map((tool) => {
                            const selected = benchmarkTools.includes(tool.name)
                            const unavailable = !selected && benchmarkTools.length >= 5
                            return <button key={tool.name} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} disabled={unavailable} title={unavailable ? '本轮最多比较 5 个工具' : undefined} onClick={() => toggleBenchmarkTool(tool.name)}><span>{selected ? '✓' : '○'}</span>{tool.name}</button>
                          })}
                        </div>
                      </div>
                      <button className="custom-criterion-toggle" type="button" aria-expanded={customCriterionOpen} aria-controls="custom-criterion-form" onClick={() => { setCustomCriterionOpen((current) => !current); setCustomCriterionError('') }}>+ 添加自定义测评标准</button>
                      {customCriterionOpen && <div className="custom-criterion-form" id="custom-criterion-form" role="group" aria-label="自定义测评标准">
                        <div className="custom-criterion-form-heading"><div><span>YOUR CRITERION</span><strong>把你真正关心的判断标准加入评分卡</strong></div><p>例如：适合电商场景、品牌一致性、成本。添加后会保存在当前浏览器。</p></div>
                        <div className="custom-criterion-form-grid">
                          <label>标准名称 <em>必填</em><input required value={customCriterionName} onChange={(event) => setCustomCriterionName(event.target.value)} placeholder="例如：品牌一致性" /></label>
                          <label>判断说明 <em>选填</em><input value={customCriterionHint} onChange={(event) => setCustomCriterionHint(event.target.value)} placeholder="例如：颜色、构图和语气是否符合品牌规范" /></label>
                        </div>
                        {customCriterionError && <p className="practice-error" role="alert"><AlertTriangle size={14} />{customCriterionError}</p>}
                        <div className="custom-criterion-actions"><button type="button" onClick={() => { setCustomCriterionOpen(false); setCustomCriterionError('') }}>取消</button><button className="practice-generate" type="button" onClick={addCustomCriterion}>加入评分卡 <ArrowRight size={14} /></button></div>
                      </div>}
                      <div className="benchmark-cards">
                        {benchmarkTools.map((toolName) => {
                          const score = benchmarkScores[toolName]
                          return <article className="benchmark-card" key={toolName}>
                            <div className="benchmark-card-head"><div><span>工具记录</span><h4>{toolName}</h4></div><em>1–5 分</em></div>
                            <div className="benchmark-score-list">
                              {benchmarkCriteriaList.map((criterion) => <div className="benchmark-score-row" key={criterion.key}><div><strong>{criterion.label}{criterion.custom && <em className="custom-criterion-badge">自定义</em>}</strong><small>{criterion.hint}</small></div><div className="score-buttons" aria-label={`${toolName} ${criterion.label}`}>
                                {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={getBenchmarkRating(score, criterion.key) === value ? 'active' : ''} aria-pressed={getBenchmarkRating(score, criterion.key) === value} onClick={() => updateBenchmarkScore(toolName, criterion.key, value)}>{value}</button>)}
                              </div></div>)}
                            </div>
                            <label className="benchmark-note">一句证据（可选）<textarea rows={3} value={score.note} onChange={(event) => updateBenchmarkNote(toolName, event.target.value)} placeholder="例如：中文标题出现乱码，但连续修改构图很顺手。" /></label>
                          </article>
                        })}
                      </div>
                      {benchmarkError && <p className="practice-error" role="alert"><AlertTriangle size={14} />{benchmarkError}</p>}
                      <button className="practice-generate benchmark-submit" type="submit">生成横向结论 <ArrowRight size={15} /></button>
                      {benchmarkConclusion && <div className="benchmark-result" aria-live="polite"><div><span>横向测评结论</span><strong>把分数翻译成选择依据</strong></div><p>{benchmarkConclusion}</p><blockquote>{benchmarkAnswer}</blockquote><small>面试表达可以结合你记录的具体证据；样本越多，结论越可靠。</small></div>}
                    </form>
                  )}
                </div>
              </section>

              {answer && (
                <section className="practice-answer" aria-live="polite">
                  <div><span>YOUR INTERVIEW NOTE</span><strong>现在你可以诚实地回答“用过”</strong></div>
                  <blockquote>{answer}</blockquote>
                  {resultUrl && <a href={resultUrl} target="_blank" rel="noreferrer">查看我的作品证据 <ExternalLink size={13} /></a>}
                  <div className="practice-followups"><span>继续准备 3 个追问</span><ul><li>为什么选择 {selectedTool}？</li><li>你具体修改了提示词里的哪个变量？</li><li>什么情况下你不会使用 AI 生图？</li></ul></div>
                </section>
              )}
            </div>
          )}

          <footer className="practice-next"><div><Video size={18} /><span>下一期</span><strong>AI 生视频：从一张产品截图到 5 秒介绍视频</strong></div><em>暂未开放</em></footer>
        </div>
      </div>
    </section>
  )
}

const hotspotCategoryNames: Record<string, string> = {
  'ai-models': '模型',
  'ai-products': '产品',
  'ai-research': '研究',
  'ai-infrastructure': '基础设施',
  'ai-industry': '行业',
  industry: '行业',
  paper: '论文',
  tip: '技巧与观点',
  policy: '政策',
}

const emptyHotspots: NonNullable<Briefs['hotspots']> = {
  windowKey: '24h',
  window: '过去 24 小时',
  freshness: 'unavailable',
  fetchedAt: null,
  dailyUrl: 'https://aihot.virxact.com/daily',
  source: { name: 'AI HOT', url: 'https://aihot.virxact.com/' },
  sources: [
    { name: 'AI HOT', url: 'https://aihot.virxact.com/' },
    { name: 'AI Insight', url: 'https://www.ai-insight.org/' },
  ],
  items: [],
}

const hotspotInterviewGuides: Record<string, { signal: string; question: string; action: string }> = {
  'ai-models': {
    signal: '关注能力边界、评测方法、推理成本与延迟，而不只是模型榜单名次。',
    question: '如果要把这类模型能力接进真实产品，你会如何设计评测集、灰度发布和失败回退？',
    action: '准备一个你亲手做过的模型对比或错误分析案例，用具体样本说明选择依据。',
  },
  'ai-products': {
    signal: '关注新能力是否解决真实任务、降低操作门槛，并形成可观察的用户价值。',
    question: '如果负责这类 AI 产品，你会用什么指标判断它不是一次性新鲜感？',
    action: '从自己的项目里挑一条用户路径，补上成功指标、失败场景和迭代假设。',
  },
  'ai-research': {
    signal: '关注实验条件、基线、可复现性和结论边界，避免只复述论文摘要。',
    question: '这项研究如果迁移到业务场景，最可能在哪些数据、成本或稳定性条件下失效？',
    action: '尝试复现一个最小实验，并记录与论文结果不同的地方及可能原因。',
  },
  paper: {
    signal: '关注实验条件、基线、可复现性和结论边界，避免只复述论文摘要。',
    question: '这项研究如果迁移到业务场景，最可能在哪些数据、成本或稳定性条件下失效？',
    action: '尝试复现一个最小实验，并记录与论文结果不同的地方及可能原因。',
  },
  'ai-infrastructure': {
    signal: '关注部署、观测、性能、成本控制，以及故障发生时系统如何降级。',
    question: '面对流量波动或模型服务不可用，你会如何保证核心流程仍然可用？',
    action: '给现有项目补一张架构图，并准备说明监控指标、限流、缓存和回退策略。',
  },
  industry: {
    signal: '关注事件如何改变团队采用 AI 的风险、成本、流程和人才要求。',
    question: '这类行业变化会怎样影响企业采用 AI 的决策，你会如何平衡速度与风险？',
    action: '把热点转成一个业务判断：受影响的用户、约束条件、短期动作和验证信号。',
  },
  'ai-industry': {
    signal: '关注事件如何改变团队采用 AI 的风险、成本、流程和人才要求。',
    question: '这类行业变化会怎样影响企业采用 AI 的决策，你会如何平衡速度与风险？',
    action: '把热点转成一个业务判断：受影响的用户、约束条件、短期动作和验证信号。',
  },
  policy: {
    signal: '关注合规边界、数据责任、审计要求，以及这些限制如何进入产品设计。',
    question: '如果政策要求更严格的可解释和可追溯，你会怎样调整数据与模型流程？',
    action: '检查自己的项目是否能说明数据来源、权限边界、日志留存和人工复核机制。',
  },
  tip: {
    signal: '关注方法是否可复现、适用于什么条件，以及效果是否经过对照实验验证。',
    question: '你会如何验证这个方法确实有效，而不是只对一个演示样例有效？',
    action: '用同一组输入做前后对照，记录质量、速度、成本和失败样本。',
  },
}

const defaultHotspotInterviewGuide = {
  signal: '关注事件背后的能力变化、实际约束和可核验事实，而不是只记住新闻标题。',
  question: '如果这项变化进入真实业务，你会如何验证价值、识别风险并设计可回滚的最小实验？',
  action: '把热点关联到一个自己的项目决策，并准备证据说明为什么这样判断。',
}

const INITIAL_HOTSPOT_COUNT = 5
const HOTSPOT_PAGE_SIZE = 5

function DailyHotspots({ hotspots, date, targetRole, windowKey, onWindowChange }: { hotspots: NonNullable<Briefs['hotspots']>; date: string; targetRole?: string; windowKey: '24h' | '7d'; onWindowChange: (window: '24h' | '7d') => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_HOTSPOT_COUNT)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const isLive = hotspots.freshness === 'live'
  const statusLabel = isLive ? '实时更新' : hotspots.freshness === 'cached' ? '缓存内容' : '暂时不可用'
  const filteredItems = activeCategory ? hotspots.items.filter((item) => item.category === activeCategory) : hotspots.items
  const featuredCount = Math.min(INITIAL_HOTSPOT_COUNT, filteredItems.length)
  const visibleItems = filteredItems.slice(0, visibleCount)
  const remainingCount = Math.max(0, filteredItems.length - visibleItems.length)
  const sourceCount = new Set(filteredItems.map((item) => item.sourceName)).size
  const categoryCounts = Array.from(
    hotspots.items.reduce((counts, item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1), new Map<string, number>()),
  ).sort(([, countA], [, countB]) => countB - countA)
  const categorySummary = categoryCounts.map(([category, count]) => `${hotspotCategoryNames[category] ?? category} ${count} 条`).join(' · ')
  const aggregationSources = hotspots.sources ?? [hotspots.source]
  const providerSummary = aggregationSources.map((source) => source.name).join(' 与 ')
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    setVisibleCount(INITIAL_HOTSPOT_COUNT)
    setExpandedId(null)
  }, [activeCategory])

  return (
    <section className="hotspot-section" aria-labelledby="daily-hotspot-title">
      <div className="hotspot-edition-line">
        <span>AI DAILY SIGNALS</span>
        <span>{date} · VERIFIED LINKS</span>
        <span>UTC+8</span>
      </div>
      <div className="hotspot-board">
        <aside className="hotspot-index">
          <div><span>{windowKey === '7d' ? '过去一周' : '当天热点'}</span><h2 id="daily-hotspot-title">{windowKey === '7d' ? '过去 7 天' : '过去 24 小时'}<br />AI 新闻</h2><p>只收录带原始出处的高信号事件。</p></div>
          <dl>
            <div className="hotspot-window-control"><dt>时间窗</dt><dd><button type="button" className={windowKey === '24h' ? 'active' : ''} aria-pressed={windowKey === '24h'} onClick={() => onWindowChange('24h')}>24H</button><button type="button" className={windowKey === '7d' ? 'active' : ''} aria-pressed={windowKey === '7d'} onClick={() => onWindowChange('7d')}>7D</button></dd></div>
            <div><dt>首屏精选</dt><dd>{featuredCount}</dd></div>
            <div><dt>{activeCategory ? '当前分类' : '候选池'}</dt><dd>{filteredItems.length}</dd></div>
            <div><dt>原始信源</dt><dd>{sourceCount}</dd></div>
          </dl>
          {categoryCounts.length > 0 && <div className="hotspot-category-block"><span>今日分类 · 点击筛选</span><div>{categoryCounts.map(([category, count]) => <button key={category} type="button" className={activeCategory === category ? 'active' : ''} aria-pressed={activeCategory === category} onClick={() => setActiveCategory((current) => current === category ? null : category)}>{hotspotCategoryNames[category] ?? category} <strong>{count}</strong></button>)}</div>{activeCategory && <button type="button" className="hotspot-category-clear" onClick={() => setActiveCategory(null)}>查看全部分类</button>}</div>}
          <span className={`hotspot-status ${hotspots.freshness}`}><i />{statusLabel}</span>
        </aside>

        <div className="hotspot-content">
          <header className="hotspot-lead">
            <span>TODAY'S BRIEF · {featuredCount} OF {filteredItems.length} SIGNALS</span>
            <h2>{filteredItems[0]?.title ?? '热点源暂时无法连接'}</h2>
            <p>{hotspots.freshness === 'unavailable' ? '当前没有把静态资料伪装成实时新闻。稍后刷新页面即可重新获取。' : `以下摘要来自 ${providerSummary} 的公开内容。涉及版本、价格和发布日期等关键事实，请点击“查看原文”核验。`}</p>
          </header>
          {filteredItems.length > 0 && <div className="hotspot-summary"><span>信号摘要</span><p>{activeCategory ? `当前筛选「${hotspotCategoryNames[activeCategory] ?? activeCategory}」共 ${filteredItems.length} 条，` : `候选池共 ${filteredItems.length} 条，覆盖 ${categorySummary}，`}来自 {sourceCount} 个原始信源。首屏先看最相关的 {featuredCount} 条，其余内容可按需展开。</p></div>}

          {filteredItems.length > 0 ? (
            <div className="hotspot-list">
              {visibleItems.map((item, index) => {
                const isExpanded = expandedId === item.id
                const guide = hotspotInterviewGuides[item.category] ?? defaultHotspotInterviewGuide
                const detailId = `hotspot-interview-${index}`

                return (
                <article key={item.id}>
                  <span className="hotspot-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div className="hotspot-story">
                    <div className="hotspot-story-meta">
                      <em>{hotspotCategoryNames[item.category] ?? item.category}</em>
                      {item.publishedAt && <time dateTime={item.publishedAt}>{dateFormatter.format(new Date(item.publishedAt))}</time>}
                      {item.score > 0 && <span>热度 {item.score}</span>}
                    </div>
                    <h3>{item.title}</h3>
                    {item.summary && <p>{item.summary}</p>}
                    <HotspotSourceImage imageUrl={item.imageUrl} title={item.title} readingUrl={item.readingUrl} providerName={item.providerName} />
                    <div className="hotspot-links">
                      <span>{item.sourceName}</span>
                      <a href={item.originalUrl} target="_blank" rel="noreferrer">查看原文 <ExternalLink size={13} /></a>
                      <a href={item.readingUrl} target="_blank" rel="noreferrer">{item.providerName} 阅读页 <ArrowUpRight size={13} /></a>
                      <button
                        type="button"
                        className="hotspot-detail-toggle"
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? '收起面试解读' : '展开面试解读'} <ChevronDown size={14} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="hotspot-interview-note" id={detailId}>
                        <div className="hotspot-interview-heading">
                          <span>INTERVIEW TRANSLATION</span>
                          <strong>{targetRole ? `与你的目标岗位「${targetRole}」怎么接` : '把新闻变成可以讲的面试判断'}</strong>
                        </div>
                        <dl>
                          <div><dt><Target size={15} /> 岗位信号</dt><dd>{guide.signal}</dd></div>
                          <div><dt><Waypoints size={15} /> 可能追问</dt><dd>{guide.question}</dd></div>
                          <div><dt><Lightbulb size={15} /> 你可准备</dt><dd>{guide.action}</dd></div>
                        </dl>
                        <p><ShieldCheck size={14} /> 解读基于热点分类生成，不替代事实核验；新闻事实请以原文为准。</p>
                      </div>
                    )}
                  </div>
                </article>
                )
              })}
            </div>
          ) : <div className="hotspot-empty"><Clock3 size={19} /><p>热点服务暂时不可用，页面不会展示无法核验来源的内容。</p></div>}

          {filteredItems.length > INITIAL_HOTSPOT_COUNT && (
            <div className="hotspot-pool-controls" aria-live="polite">
              <p><strong>{visibleItems.length}</strong> / {filteredItems.length}<span>已展示</span></p>
              <div>
                {remainingCount > 0 && (
                  <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + HOTSPOT_PAGE_SIZE, filteredItems.length))}>
                    再看 {Math.min(HOTSPOT_PAGE_SIZE, remainingCount)} 条 <ChevronDown size={15} />
                  </button>
                )}
                {visibleCount > INITIAL_HOTSPOT_COUNT && (
                  <button type="button" className="quiet" onClick={() => { setVisibleCount(INITIAL_HOTSPOT_COUNT); setExpandedId(null) }}>
                    收起到今日精选 <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          <footer className="hotspot-attribution">
            <p className="hotspot-source-list">聚合来源：{aggregationSources.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.name} <ExternalLink size={12} /></a></span>)}</p>
            <a href={windowKey === '7d' ? hotspots.source.url : hotspots.dailyUrl} target="_blank" rel="noreferrer">{windowKey === '7d' ? '查看 AI HOT 原始页面' : '查看 AI HOT 完整日报'} <ArrowUpRight size={12} /></a>
            {hotspots.fetchedAt && <time dateTime={hotspots.fetchedAt}>最近获取：{dateFormatter.format(new Date(hotspots.fetchedAt))}</time>}
          </footer>
        </div>
      </div>
    </section>
  )
}

function HotspotSourceImage({ imageUrl, title, readingUrl, providerName }: { imageUrl?: string | null; title: string; readingUrl: string; providerName: string }) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) return null

  return (
    <figure className="hotspot-source-image">
      <a href={readingUrl} target="_blank" rel="noreferrer" aria-label={`在 ${providerName} 查看“${title}”`}>
        <img src={imageUrl} alt={`${title} 来源配图`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </a>
      <figcaption>{providerName} 来源配图</figcaption>
    </figure>
  )
}

function BriefStep({ icon: Icon, label, text, featured = false }: { icon: typeof Target; label: string; text: string; featured?: boolean }) {
  return <article className={featured ? 'featured' : ''}><div><Icon size={17} /><span>{label}</span></div><p>{text}</p></article>
}

function HistoryView({ user, items, loading, onOpen, onAccount }: { user: User | null; items: HistoryItem[]; loading: boolean; onOpen: (id: number) => void; onAccount: () => void }) {
  return (
    <div className="product-page history-page">
      <section className="compact-page-heading"><div className="eyebrow"><span>04</span> Growth Archive</div><h1>每一次重扫，<br /><i>都应该看见证据变强。</i></h1></section>
      {!user && <EmptyState icon={History} title="登录后保存分析记录" copy="历史记录包含岗位、分数和完整报告回看。建议先登录，再开始下一次分析。" action={<button className="primary-button" type="button" onClick={onAccount}>登录或注册 <ArrowRight size={17} /></button>} />}
      {user && loading && <LoadingRows />}
      {user && !loading && items.length === 0 && <EmptyState icon={FileText} title="还没有已保存的分析" copy="登录状态下完成一次简历诊断，报告会自动出现在这里。" />}
      {user && items.length > 0 && <section className="history-list"><div className="history-head"><span>岗位</span><span>分数</span><span>分析方式</span><span>日期</span><span /></div>{items.map((item) => <button type="button" key={item.id} onClick={() => onOpen(item.id)}><strong>{item.role}</strong><em>{item.score}</em><span>{item.source === 'model' ? '模型生成' : '规则模式'}</span><time>{new Date(item.created_at).toLocaleDateString('zh-CN')}</time><ChevronRight size={17} /></button>)}</section>}
    </div>
  )
}

function ModelStatusView({ health }: { health: Health | null }) {
  const roles = [
    ['extractor', '抽取模型', 'JD 与简历结构化解析，固定 temperature=0'],
    ['generator', '生成模型', 'Gap 诊断、项目理由和行动路线，temperature=0.7'],
    ['judge_a', '评委 A', '离线横评使用，不参与普通用户请求'],
    ['judge_b', '评委 B', '跨厂商交叉评分，降低自评偏差'],
  ]
  return (
    <div className="product-page models-page">
      <section className="compact-page-heading"><div className="eyebrow"><span>Lab</span> Model Router</div><h1>业务只认识角色，<br /><i>不绑定任何一家模型。</i></h1><p>兼容 OpenAI-style chat completions；抽取、生成和评委可以分别配置。</p></section>
      <section className="model-status-grid">{roles.map(([key, title, description]) => { const status = health?.models[key]; return <article key={key}><div className="model-card-heading"><Code2 size={18} /><span className={status?.configured ? 'online' : ''}>{status?.configured ? '已配置' : '未配置'}</span></div><h2>{title}</h2><p>{description}</p><strong>{status?.model ?? `${key.toUpperCase()}_MODEL`}</strong></article> })}</section>
      <section className="config-guide"><div><span>本地配置</span><h2>复制 `.env.example` 为 `.env`</h2><p>填写 Base URL、API Key 和模型名，重启后端即可切换。密钥只留在本机后端，不会打包进浏览器。</p></div><pre>{`EXTRACTOR_BASE_URL=https://.../v1\nEXTRACTOR_API_KEY=...\nEXTRACTOR_MODEL=...\n\nGENERATOR_BASE_URL=https://.../v1\nGENERATOR_API_KEY=...\nGENERATOR_MODEL=...`}</pre></section>
    </div>
  )
}

function AccountView({ user, onAuthenticated, onSignOut, onDeleteAccount, onDone }: { user: User | null; onAuthenticated: (user: User) => void; onSignOut: () => void; onDeleteAccount: () => Promise<void>; onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = mode === 'login' ? await api.login(email, password) : await api.register(email, password)
      authStore.set(response.token)
      onAuthenticated(response.user)
      onDone()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  if (user) {
    const handleDelete = async () => {
      if (!window.confirm('删除后会移除账户、历史分析、事件和反馈，且无法恢复。确定继续吗？')) return
      try {
        await onDeleteAccount()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '删除失败，请稍后重试。')
      }
    }
    return <div className="account-page"><section className="account-summary"><div className="account-avatar">{user.email.slice(0, 1).toUpperCase()}</div><span>当前账户</span><h1>{user.email}</h1><p>登录后保存的分析会写入本机数据库。你可以随时删除账户及其关联数据。</p><div className="account-actions"><button className="primary-button" type="button" onClick={onDone}>查看历史记录 <ArrowRight size={17} /></button><button className="secondary-button" type="button" onClick={onSignOut}><LogOut size={16} /> 退出登录</button></div><div className="privacy-panel"><strong>数据与第三方模型说明</strong><p>未配置模型时，分析在本地规则链路完成；配置第三方模型后，提交的 JD 与简历文本可能发送到对应服务商，用于本次分析。服务商的数据保留与训练政策由其条款决定。</p><button className="danger-button" type="button" onClick={handleDelete}>删除我的账户和数据 <Trash2 size={15} /></button></div>{error && <p className="auth-error" role="alert"><AlertTriangle size={15} /> {error}</p>}</section></div>
  }

  return (
    <div className="account-page">
      <section className="auth-copy"><div className="eyebrow"><span>Account</span> 保存你的成长地图</div><h1>报告可以重看，<br /><i>简历才有机会重写。</i></h1><p>先体验再注册。只有登录状态下完成的分析会进入历史记录。</p><div><ShieldCheck size={18} /><span>密码使用 PBKDF2 哈希存储；本地版不发送验证邮件。</span></div><div className="privacy-copy"><strong>先看清数据流向</strong><span>未登录分析默认不进入历史记录；配置模型后，JD 与简历可能发送到你选择的第三方模型服务。</span></div></section>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button></div>
        <div><span className="step-kicker">{mode === 'login' ? '欢迎回来' : '建立本地账户'}</span><h2>{mode === 'login' ? '继续你的能力地图' : '保存下一次分析'}</h2></div>
        <label><span>邮箱</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label>
        <label><span>密码</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" minLength={8} required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
        {error && <p className="auth-error" role="alert"><AlertTriangle size={15} /> {error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle size={17} className="spin" /> 正在处理</> : <>{mode === 'login' ? '登录并继续' : '创建账户'} <ArrowRight size={17} /></>}</button>
      </form>
    </div>
  )
}

function EmptyState({ icon: Icon, title, copy, action }: { icon: typeof History; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="empty-state"><Icon size={26} /><h2>{title}</h2><p>{copy}</p>{action}</div>
}

function LoadingRows() {
  return <div className="loading-rows" aria-label="正在加载"><span /><span /><span /></div>
}

export default App

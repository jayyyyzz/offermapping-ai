import type { AnalysisResult, Briefs, Health, HistoryItem, Project, User } from '../types'

export type ExtractedDocument = {
  filename: string
  text: string
  characters: number
  method: string
  needsReview: boolean
  truncated: boolean
}

const TOKEN_KEY = 'offermapping_token'

export const authStore = {
  get: () => window.localStorage.getItem(TOKEN_KEY),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
}

async function request<T>(path: string, init: RequestInit = {}, withAuth = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (withAuth && authStore.get()) headers.set('Authorization', `Bearer ${authStore.get()}`)
  const response = await fetch(`/api${path}`, { ...init, headers })
  if (!response.ok) {
    let message = '请求失败，请稍后再试。'
    try {
      const payload = await response.json()
      message = typeof payload.detail === 'string' ? payload.detail : message
    } catch {
      // Keep the user-facing fallback.
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

type AnalysisJobResponse = {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  stage: 'queued' | 'analyzing' | 'saving' | 'completed' | 'failed'
  result?: AnalysisResult | null
  error?: string | null
}

export const api = {
  health: () => request<Health>('/health'),
  analyze: async (jd: string, resume: string, onProgress?: (stage: AnalysisJobResponse['stage']) => void) => {
    const withAuth = Boolean(authStore.get())
    const job = await request<AnalysisJobResponse>('/analysis-jobs', {
      method: 'POST',
      body: JSON.stringify({ jd, resume }),
    }, withAuth)
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const current = await request<AnalysisJobResponse>(`/analysis-jobs/${job.jobId}`, {}, withAuth)
      onProgress?.(current.stage)
      if (current.status === 'completed' && current.result) return current.result
      if (current.status === 'failed') throw new Error(current.error || '分析暂时失败，请稍后重试。')
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }
    throw new Error('分析等待超时，请稍后重试。')
  },
  extractDocument: (file: File, kind: 'jd' | 'resume') => {
    const body = new FormData()
    body.append('file', file)
    return request<ExtractedDocument>(`/documents/extract?kind=${kind}`, {
      method: 'POST',
      body,
    })
  },
  register: (email: string, password: string) => request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  login: (email: string, password: string) => request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  me: () => request<{ user: User }>('/auth/me', {}, true),
  deleteAccount: () => request<{ ok: boolean }>('/account', { method: 'DELETE' }, true),
  history: () => request<HistoryItem[]>('/analyses', {}, true),
  analysis: (id: number) => request<AnalysisResult>(`/analyses/${id}`, {}, true),
  events: (payload: { event: string; analysisId?: number; metadata?: Record<string, unknown> }) => request<{ ok: boolean }>('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, Boolean(authStore.get())),
  feedback: (payload: { analysisId: number; rating: 'up' | 'down'; comment?: string }) => request<{ ok: boolean }>('/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, Boolean(authStore.get())),
  projects: (filters: Record<string, string> = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()
    return request<Project[]>(`/projects${query ? `?${query}` : ''}`)
  },
  briefs: (window: '24h' | '7d' = '24h') => request<Briefs>(`/briefs?window=${window}`, {}, Boolean(authStore.get())),
}

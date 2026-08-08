import { expect, test, type Page } from '@playwright/test'

const sampleResult = {
  analysisId: 123,
  role: 'AI 应用开发工程师',
  jobFamily: 'AI 应用开发',
  score: 72,
  dimensions: [
    { label: '硬技能', score: 30, max: 40 },
    { label: '项目证据', score: 26, max: 40 },
    { label: '领域匹配', score: 16, max: 20 },
  ],
  hardRequirement: '暂未发现明显冲突的学历、年限或证书门槛。',
  diagnosis: '你的短板是项目证据还没有形成闭环。',
  backgroundAssets: ['Python', '数据分析'],
  skills: [
    { key: 'python', name: 'Python', priority: 'must', evidence: 'project-backed', jdQuote: '熟悉 Python', resumeQuote: '使用 Python 构建分析脚本', time: '1-2 周' },
    { key: 'rag', name: 'RAG', priority: 'must', evidence: 'missing', jdQuote: '负责 RAG 工作流', resumeQuote: '', time: '4-6 周' },
    { key: 'agent', name: 'Agent / Function Calling', priority: 'nice', evidence: 'listed-only', jdQuote: '了解 Agent', resumeQuote: '了解 Agent 基础', time: '4-6 周' },
  ],
  project: {
    title: '岗位技能证据地图 Agent',
    rationale: '把已有背景与岗位缺口连接起来。',
    duration: '3 周 · 每周 6-8 小时',
    resumeLine: '设计并实现岗位技能证据地图 Agent，构建可追溯的检索与工具调用链路。',
    repository: {
      id: 'demo-project', name: 'Demo project', full_name: 'offermapping/demo-project', url: 'https://github.com/offermapping/demo-project', description: 'A demo project',
      job_families: ['AI 应用开发'], topics: ['rag'], difficulty: '入门', duration: '3 周', value: '简历主项目', copy_angle: '可追溯', category: 'useful', project_type: 'AI 工具', business_domains: ['开发者工具'], source: 'GitHub', github_verified: true,
    },
    milestones: [
      { week: '01', title: '定义问题', deliverable: '任务边界与样本', talkingPoint: '为什么需要 Agent？' },
      { week: '02', title: '完成闭环', deliverable: '核心链路', talkingPoint: '如何控制幻觉？' },
      { week: '03', title: '评估打磨', deliverable: '评估集', talkingPoint: '如何定位失败？' },
    ],
  },
  quickWins: [
    { title: 'RAG 最小实验', duration: '90 分钟', outcome: '跑通链路' },
    { title: '建立项目评估表', duration: '半天', outcome: '定义指标' },
    { title: '写一页决策记录', duration: '1 天', outcome: '沉淀取舍' },
  ],
  recommendations: [],
  source: 'rules',
  model: 'rules-v1',
}

const historyItems = [
  { id: 123, role: sampleResult.role, score: sampleResult.score, source: 'rules', created_at: '2026-08-08T06:00:00Z' },
]

async function mockApi(page: Page) {
  await page.route('**/api/health', async (route) => route.fulfill({ json: { ok: true, version: 'e2e', models: { extractor: { configured: false, model: null }, generator: { configured: false, model: null }, judge_a: { configured: false, model: null }, judge_b: { configured: false, model: null } } } }))
  await page.route('**/api/analysis-jobs', async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { jobId: 'e2e-job-123', status: 'queued', stage: 'queued' } })
    return route.fulfill({ json: historyItems })
  })
  await page.route('**/api/analysis-jobs/e2e-job-123', async (route) => route.fulfill({ json: { jobId: 'e2e-job-123', status: 'completed', stage: 'completed', result: sampleResult } }))
  await page.route('**/api/analyses', async (route) => route.fulfill({ json: historyItems }))
  await page.route('**/api/analyses/123', async (route) => route.fulfill({ json: sampleResult }))
  await page.route('**/api/auth/login', async (route) => route.fulfill({ json: { token: 'e2e-token', user: { id: 1, email: 'demo@example.com' } } }))
  await page.route('**/api/auth/me', async (route) => route.fulfill({ json: { user: { id: 1, email: 'demo@example.com' } } }))
}

test.describe('OfferMapping core journeys', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await mockApi(page)
    await page.goto('/')
  })

  test('fills the sample input and renders an analysis report', async ({ page }) => {
    await page.locator('button.sample-button').click()
    await expect(page.locator('#jd')).not.toHaveValue('')
    await expect(page.locator('#resume')).not.toHaveValue('')

    await page.locator('.input-workbench button[type="submit"]').click()
    await expect(page.locator('.report-page')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.score-panel')).toContainText('72')
    await expect(page.locator('.evidence-section')).toBeVisible()
  })

  test('copies the resume sentence from the report', async ({ page }) => {
    await page.locator('button.sample-button').click()
    await page.locator('.input-workbench button[type="submit"]').click()
    await expect(page.locator('.report-page')).toBeVisible({ timeout: 10_000 })
    await page.locator('.resume-output button').click()
    await expect(page.locator('.resume-output button')).toContainText('已复制')
    await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain('岗位技能证据地图 Agent')
  })

  test('logs in and opens a saved history report', async ({ page }) => {
    await page.locator('.account-button').click()
    await expect(page.locator('.auth-form')).toBeVisible()
    await page.locator('.auth-form input[type="email"]').fill('demo@example.com')
    await page.locator('.auth-form input[type="password"]').fill('password123')
    await page.locator('.auth-form button.auth-submit').click()

    await expect(page.locator('.history-page')).toBeVisible({ timeout: 5_000 })
    const historyRow = page.locator('.history-list > button').first()
    await expect(historyRow).toContainText('72')
    await historyRow.click()
    await expect(page.locator('.report-page')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.score-panel')).toContainText('72')
  })
})

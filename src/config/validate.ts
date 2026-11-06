import type { CardAppearance, PortalConfig } from './types'
import { loadHomepageFeeds } from './contentFeeds'

const appearances: CardAppearance[] = ['text', 'essay', 'browser', 'book', 'disc', 'gallery']
const anchors = ['top-left', 'center', 'top-right', 'bottom-left', 'bottom-right']
const selectionModes = ['ordered', 'random']

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`门户配置无效：\n${issues.map((issue) => `• ${issue}`).join('\n')}`)
    this.name = 'ConfigValidationError'
  }
}

function duplicateIds(items: Array<{ id: string }>) {
  const seen = new Set<string>()
  return items.map((item) => item.id).filter((id) => (seen.has(id) ? true : !seen.add(id)))
}

export function validateConfig(value: unknown): PortalConfig {
  const issues: string[] = []
  if (!value || typeof value !== 'object') throw new ConfigValidationError(['根节点必须是 JSON 对象'])
  const config = value as Partial<PortalConfig>
  if (config.configVersion !== 1) issues.push('configVersion 必须为 1')
  if (!config.site?.name || !config.site?.title) issues.push('site.name 与 site.title 不能为空')
  if (!['single', 'layered'].includes(config.character?.mode ?? '')) issues.push('character.mode 只能为 single 或 layered')
  if (!Array.isArray(config.categories)) issues.push('categories 必须是数组')
  if (!Array.isArray(config.content)) issues.push('content 必须是数组')
  if (config.contentSources !== undefined && !Array.isArray(config.contentSources)) issues.push('contentSources 必须是数组')
  if (!Array.isArray(config.layout?.slots)) issues.push('layout.slots 必须是数组')
  if (!['reference-physics', 'fixed-slots'].includes(config.layout?.mode ?? '')) issues.push('layout.mode 只能为 reference-physics 或 fixed-slots')
  if (issues.length) throw new ConfigValidationError(issues)

  const categories = config.categories!
  const content = config.content!
  const slots = config.layout!.slots
  const contentSources = config.contentSources ?? []
  const categoryIds = new Set(categories.map((item) => item.id))
  const contentIds = new Set(content.map((item) => item.id))
  const slotIds = new Set(slots.map((item) => item.id))
  const contentSourceIds = new Set<string>()

  duplicateIds(categories).forEach((id) => issues.push(`栏目 ID 重复：${id}`))
  duplicateIds(content).forEach((id) => issues.push(`内容 ID 重复：${id}`))
  duplicateIds(slots).forEach((id) => issues.push(`槽位 ID 重复：${id}`))
  if (contentIds.size !== content.length) issues.push('每条内容必须使用唯一 ID')

  categories.forEach((category) => {
    if (!category.id || !category.label) issues.push('每个栏目必须设置 id 和 label')
    if (!selectionModes.includes(category.selection)) issues.push(`栏目 ${category.id} 的 selection 无效`)
    category.slots?.forEach((slotId) => {
      if (!slotIds.has(slotId)) issues.push(`栏目 ${category.id} 引用了不存在的槽位 ${slotId}`)
    })
  })

  content.forEach((item) => {
    if (!categoryIds.has(item.categoryId)) issues.push(`内容 ${item.id} 引用了不存在的栏目 ${item.categoryId}`)
    if (!appearances.includes(item.appearance)) issues.push(`内容 ${item.id} 的 appearance 无效：${item.appearance}`)
    if (!item.href) issues.push(`内容 ${item.id} 缺少 href`)
  })

  contentSources.forEach((source) => {
    if (!source.source || contentSourceIds.has(source.source)) issues.push(`内容源 source 重复或为空：${source.source}`)
    contentSourceIds.add(source.source)
    if (!source.url?.startsWith('/')) issues.push(`内容源 ${source.source} 的 url 必须是根路径绝对地址`)
    if (!source.hrefPrefix?.startsWith('/') || !source.hrefPrefix.endsWith('/')) {
      issues.push(`内容源 ${source.source} 的 hrefPrefix 必须以 / 开头和结尾`)
    }
  })

  slots.forEach((slot) => {
    if (slot.angle < -30 || slot.angle > 30) issues.push(`槽位 ${slot.id} 的 angle 应在 -30 到 30 之间`)
    ;(['desktop', 'tablet', 'mobile'] as const).forEach((breakpoint) => {
      const position = slot.positions?.[breakpoint]
      if (!position) {
        issues.push(`槽位 ${slot.id} 缺少 ${breakpoint} 位置`)
        return
      }
      if (!anchors.includes(position.anchor)) issues.push(`槽位 ${slot.id} 的 ${breakpoint}.anchor 无效`)
      if (position.width <= 0 || position.height <= 0) issues.push(`槽位 ${slot.id} 的 ${breakpoint} 尺寸必须为正数`)
      if (position.maxContentHeight < 120) issues.push(`槽位 ${slot.id} 的 ${breakpoint}.maxContentHeight 不能小于 120`)
    })
  })

  const theme = config.theme!
  if (theme.lineWidth < 1 || theme.lineWidth > 12) issues.push('theme.lineWidth 应在 1 到 12 之间')
  if (theme.halftone.density < 4 || theme.halftone.density > 40) issues.push('theme.halftone.density 应在 4 到 40 之间')
  if (theme.halftone.intensity < 0 || theme.halftone.intensity > 1) issues.push('theme.halftone.intensity 应在 0 到 1 之间')
  if (config.motion!.duration < 0 || config.motion!.duration > 3000) issues.push('motion.duration 应在 0 到 3000 毫秒之间')
  if (config.motion!.hoverScale < 1 || config.motion!.hoverScale > 2) issues.push('motion.hoverScale 应在 1 到 2 之间')

  if (issues.length) throw new ConfigValidationError(issues)
  return config as PortalConfig
}

export async function loadBaseConfig(): Promise<PortalConfig> {
  const url = `${import.meta.env.BASE_URL}portal.config.json`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`无法加载门户配置 ${url}（HTTP ${response.status}）`)
  try {
    return validateConfig(await response.json())
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`门户配置不是有效 JSON：${error.message}`)
    throw error
  }
}

export async function loadConfig(): Promise<PortalConfig> {
  return loadHomepageFeeds(await loadBaseConfig())
}

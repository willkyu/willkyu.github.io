import type { CardAppearance, ContentConfig, ContentSourceConfig, PortalConfig } from './types'
import {
  coverRequiredAppearances,
  feedItemKeys,
  forbiddenFeedItemFields,
  homepageFeedSchemaVersion,
  supportedAppearances,
} from './itemTypes'

const feedKeys = new Set(['schemaVersion', 'source', 'generatedAt', 'items'])
const feedTimeoutMs = import.meta.env.DEV ? 12_000 : 4_000

interface FeedItem {
  bind: string
  title: string
  summary: string
  href: string
  appearance: CardAppearance
  tags: string[]
  order: number
  cover?: string
}

interface HomepageFeed {
  schemaVersion: 1
  source: string
  generatedAt: string
  items: FeedItem[]
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSingleLine(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !/[\r\n]/.test(value)
}

function validateFeedItem(
  value: unknown,
  index: number,
  source: ContentSourceConfig,
  categoryIds: Set<string>,
): FeedItem {
  const label = `${source.source}.items[${index}]`
  if (!isRecord(value)) throw new Error(`${label} 必须是对象`)
  const forbidden = Object.keys(value).filter((key) => forbiddenFeedItemFields.has(key))
  if (forbidden.length) throw new Error(`${label} 不应包含 ${forbidden.join(', ')}`)
  const unknown = Object.keys(value).filter((key) => !feedItemKeys.has(key))
  if (unknown.length) throw new Error(`${label} 包含未知字段：${unknown.join(', ')}`)
  if (!isSingleLine(value.bind) || !categoryIds.has(value.bind)) throw new Error(`${label}.bind 没有对应的主页选项`)
  if (!isSingleLine(value.title)) throw new Error(`${label}.title 必须是非空单行文本`)
  if (!isSingleLine(value.summary)) throw new Error(`${label}.summary 必须是非空单行文本`)
  if (!isSingleLine(value.href) || !value.href.startsWith(source.hrefPrefix)) {
    throw new Error(`${label}.href 必须以 ${source.hrefPrefix} 开头`)
  }
  if (typeof value.appearance !== 'string' || !supportedAppearances.has(value.appearance as CardAppearance)) {
    throw new Error(`${label}.appearance 无效`)
  }
  if (!Array.isArray(value.tags) || value.tags.some((tag) => !isSingleLine(tag))) {
    throw new Error(`${label}.tags 必须是单行非空字符串数组`)
  }
  if (!Number.isSafeInteger(value.order)) throw new Error(`${label}.order 必须是安全整数`)

  const appearance = value.appearance as CardAppearance
  if (value.cover !== undefined && (!isSingleLine(value.cover) || !value.cover.startsWith(source.hrefPrefix))) {
    throw new Error(`${label}.cover 必须以 ${source.hrefPrefix} 开头`)
  }
  if (coverRequiredAppearances.has(appearance) && !isSingleLine(value.cover)) {
    throw new Error(`${label} 的 ${appearance} 样式需要 cover`)
  }

  return {
    bind: value.bind,
    title: value.title,
    summary: value.summary,
    href: value.href,
    appearance,
    tags: [...value.tags] as string[],
    order: value.order as number,
    ...(typeof value.cover === 'string' ? { cover: value.cover } : {}),
  }
}

export function validateHomepageFeed(
  value: unknown,
  source: ContentSourceConfig,
  categoryIds: Set<string>,
): HomepageFeed {
  if (!isRecord(value)) throw new Error(`${source.source} feed 根节点必须是对象`)
  const unknown = Object.keys(value).filter((key) => !feedKeys.has(key))
  if (unknown.length) throw new Error(`${source.source} feed 包含未知字段：${unknown.join(', ')}`)
  if (value.schemaVersion !== homepageFeedSchemaVersion) {
    throw new Error(`${source.source} feed schemaVersion 必须为 ${homepageFeedSchemaVersion}`)
  }
  if (value.source !== source.source) throw new Error(`${source.source} feed 的 source 不匹配`)
  if (!isSingleLine(value.generatedAt)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.generatedAt)
    || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new Error(`${source.source} feed 的 generatedAt 无效`)
  }
  if (!Array.isArray(value.items)) throw new Error(`${source.source} feed 的 items 必须是数组`)

  const hrefs = new Set<string>()
  const items = value.items.map((item, index) => {
    const parsed = validateFeedItem(item, index, source, categoryIds)
    if (hrefs.has(parsed.href)) throw new Error(`${source.source} feed 出现重复 href：${parsed.href}`)
    hrefs.add(parsed.href)
    return parsed
  })

  return {
    schemaVersion: 1,
    source: source.source,
    generatedAt: value.generatedAt,
    items,
  }
}

function toContent(source: ContentSourceConfig, item: FeedItem): ContentConfig {
  return {
    id: `feed:${source.source}:${item.href}`,
    categoryId: item.bind,
    title: item.title,
    description: item.summary,
    href: item.href,
    appearance: item.appearance,
    tags: item.tags,
    order: item.order,
    ...(item.cover ? { cover: item.cover } : {}),
  }
}

export function mergeHomepageFeeds(
  config: PortalConfig,
  feeds: Array<{ source: ContentSourceConfig; feed: HomepageFeed }>,
  failedSources: ContentSourceConfig[] = [],
): PortalConfig {
  if (!feeds.length && !failedSources.length) return config

  const failedCategoryIds = new Set(failedSources.flatMap((source) => {
    const category = config.categories.find((item) => item.id === source.source)
      ?? config.categories.find((item) => item.viewAllHref?.startsWith(source.hrefPrefix))
    return category ? [category.id] : []
  }))
  const permanent = config.content.filter((item) => !item.example
    || (!feeds.length && !failedCategoryIds.has(item.categoryId)))
  const nextOrder = new Map<string, number>()
  for (const item of permanent) {
    nextOrder.set(item.categoryId, Math.max(nextOrder.get(item.categoryId) ?? 0, item.order))
  }

  const remote = feeds
    .flatMap(({ source, feed }) => feed.items.map((item) => ({ source, item })))
    .sort((left, right) => left.item.order - right.item.order
      || left.item.href.localeCompare(right.item.href)
      || left.source.source.localeCompare(right.source.source))
    .map(({ source, item }) => {
      const order = (nextOrder.get(item.bind) ?? 0) + 1
      nextOrder.set(item.bind, order)
      return { ...toContent(source, item), order }
    })

  const fallback = failedSources.flatMap((source) => {
    const category = config.categories.find((item) => item.id === source.source)
      ?? config.categories.find((item) => item.viewAllHref?.startsWith(source.hrefPrefix))
    if (!category) return []
    const order = (nextOrder.get(category.id) ?? 0) + 1
    nextOrder.set(category.id, order)
    return [{
      id: `feed-error:${source.source}`,
      categoryId: category.id,
      title: `${source.source.toUpperCase()} FEED 404`,
      description: '精选内容加载失败。点击进入站点，或稍后刷新主页重试。',
      href: source.hrefPrefix,
      appearance: 'text' as const,
      tags: ['404', 'FEED'],
      order,
    }]
  })

  return { ...config, content: [...permanent, ...remote, ...fallback] }
}

async function fetchFeed(
  source: ContentSourceConfig,
  categoryIds: Set<string>,
  fetcher: Fetcher,
): Promise<{ source: ContentSourceConfig; feed: HomepageFeed }> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), feedTimeoutMs)
  try {
    const response = await fetcher(source.url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return { source, feed: validateHomepageFeed(await response.json(), source, categoryIds) }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export async function loadHomepageFeeds(config: PortalConfig, fetcher: Fetcher = fetch): Promise<PortalConfig> {
  const sources = config.contentSources ?? []
  if (!sources.length) return config

  const categoryIds = new Set(config.categories.map((category) => category.id))
  const results = await Promise.allSettled(sources.map((source) => fetchFeed(source, categoryIds, fetcher)))
  const feeds: Array<{ source: ContentSourceConfig; feed: HomepageFeed }> = []
  const failedSources: ContentSourceConfig[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      feeds.push(result.value)
      return
    }
    failedSources.push(sources[index])
    console.warn(`主页内容源 ${sources[index].source} 加载失败，已跳过该来源。`, result.reason)
  })

  return mergeHomepageFeeds(config, feeds, failedSources)
}

import { describe, expect, it, vi } from 'vitest'
import { loadHomepageFeeds, validateHomepageFeed } from './contentFeeds'
import type { ContentSourceConfig, PortalConfig } from './types'

const blogSource: ContentSourceConfig = {
  source: 'blog',
  url: '/blog/homepage-feed.json',
  hrefPrefix: '/blog/',
}

const researchSource: ContentSourceConfig = {
  source: 'research',
  url: '/research/homepage-feed.json',
  hrefPrefix: '/research/',
}

const config = {
  categories: [
    { id: 'research' },
    { id: 'blog' },
    { id: 'pokemon' },
    { id: 'projects' },
  ],
  contentSources: [blogSource, researchSource],
  content: [
    { id: 'research-home', categoryId: 'research', title: '研究知识库', order: 1, example: false },
    { id: 'research-example', categoryId: 'research', title: '示例', order: 2, example: true },
    { id: 'blog-home', categoryId: 'blog', title: '博客入口', order: 1, example: false },
  ],
} as PortalConfig

function feed(source: string, items: unknown[]) {
  return {
    schemaVersion: 1,
    source,
    generatedAt: '2026-11-06T01:00:00.000Z',
    items,
  }
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    bind: 'research',
    title: '研究文章',
    summary: '主页摘要。',
    href: '/blog/research-article/',
    appearance: 'text',
    tags: ['研究'],
    order: 10,
    ...overrides,
  }
}

describe('homepage feeds', () => {
  it('validates the no-id contract and rejects unknown categories', () => {
    const categories = new Set(['research', 'blog', 'pokemon', 'projects'])
    expect(validateHomepageFeed(feed('blog', [item()]), blogSource, categories).items).toHaveLength(1)
    expect(() => validateHomepageFeed(feed('blog', [item({ id: 'manual' })]), blogSource, categories)).toThrow(/不应包含 id/)
    expect(() => validateHomepageFeed(feed('blog', [item({ bind: 'missing' })]), blogSource, categories)).toThrow(/主页选项/)
  })

  it('merges successful feeds, derives ids, keeps permanent entries and removes examples', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/blog/')
        ? feed('blog', [item(), item({ bind: 'pokemon', title: '宝可梦文章', href: '/blog/pokemon/', order: 20 })])
        : feed('research', [item({ href: '/research/papers/note', title: '论文笔记' })])
      return new Response(JSON.stringify(body), { status: 200 })
    })

    const result = await loadHomepageFeeds(config, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.content.map((entry) => entry.title)).toEqual([
      '研究知识库',
      '博客入口',
      '研究文章',
      '论文笔记',
      '宝可梦文章',
    ])
    expect(result.content.some((entry) => entry.example)).toBe(false)
    expect(result.content.find((entry) => entry.title === '研究文章')?.id).toBe('feed:blog:/blog/research-article/')
    expect(result.content.filter((entry) => entry.categoryId === 'research').map((entry) => entry.order)).toEqual([1, 2, 3])
  })

  it('replaces examples with a visible 404 item for every failed source', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = await loadHomepageFeeds(config, async () => new Response('', { status: 404 }))
    expect(result).not.toBe(config)
    expect(result.content.some((entry) => entry.example)).toBe(false)
    expect(result.content.filter((entry) => entry.id.startsWith('feed-error:')).map((entry) => ({
      categoryId: entry.categoryId,
      title: entry.title,
      href: entry.href,
    }))).toEqual([
      { categoryId: 'blog', title: 'BLOG FEED 404', href: '/blog/' },
      { categoryId: 'research', title: 'RESEARCH FEED 404', href: '/research/' },
    ])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

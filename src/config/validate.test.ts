import { describe, expect, it } from 'vitest'
import { validateConfig } from './validate'

const minimal = {
  configVersion: 1,
  site: { name: 'Test', title: 'Test' },
  character: { mode: 'single' },
  categories: [{ id: 'a', label: 'A', selection: 'ordered', slots: ['slot-a'] }],
  content: [{ id: 'one', categoryId: 'a', appearance: 'text', href: '#' }],
  theme: { lineWidth: 4, halftone: { density: 12, intensity: 0.5 } },
  layout: {
    mode: 'reference-physics',
    slots: [{
      id: 'slot-a', angle: 0,
      positions: Object.fromEntries(['desktop', 'tablet', 'mobile'].map((key) => [key, { anchor: 'top-left', width: 200, height: 200, maxContentHeight: 180 }]))
    }],
  },
  motion: { duration: 300, hoverScale: 1.05 },
}

describe('validateConfig', () => {
  it('accepts a fifth configured category without code changes', () => {
    const value = structuredClone(minimal) as any
    value.categories.push({ id: 'fifth', label: 'Fifth', selection: 'random', slots: ['slot-a'] })
    expect(validateConfig(value).categories).toHaveLength(2)
  })

  it('reports duplicate ids and invalid references clearly', () => {
    const value = structuredClone(minimal) as any
    value.content.push({ ...value.content[0], categoryId: 'missing' })
    expect(() => validateConfig(value)).toThrow(/内容 ID 重复：one/)
    expect(() => validateConfig(value)).toThrow(/不存在的栏目 missing/)
  })
})

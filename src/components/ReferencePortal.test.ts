import { describe, expect, it } from 'vitest'
import { essayExpandedHeight, popupPosition } from './ReferencePortal'

describe('essayExpandedHeight', () => {
  it('grows with the wrapped summary instead of using one fixed aspect ratio', () => {
    const short = essayExpandedHeight('短摘要。', 280, 64)
    const long = essayExpandedHeight('这是一段需要换行展示的长摘要。'.repeat(12), 280, 64)
    const forcedLines = essayExpandedHeight('第一段\n第二段\n第三段\n第四段\n第五段\n第六段', 280, 64)

    expect(short).toBeGreaterThanOrEqual(160)
    expect(long).toBeGreaterThan(short)
    expect(forcedLines).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(520)
  })
})

describe('popupPosition', () => {
  it('uses vertical space on a portrait phone when side gaps cannot fit the item', () => {
    const item = {
      id: 'mobile-card', kind: 'content', spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 220, baseHeight: 200, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const profile = {
      id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 1, baseWidth: 359, baseHeight: 259, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const position = popupPosition(item as Parameters<typeof popupPosition>[0], { width: 390, height: 844 }, [profile as Parameters<typeof popupPosition>[0]])

    expect(Math.abs(position.y)).toBeGreaterThan(Math.abs(position.x))
    expect(Math.abs(position.x)).toBeLessThan(30)
  })

  it('can use side space on the same phone after rotating to landscape', () => {
    const item = {
      id: 'landscape-card', kind: 'content', spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 220, baseHeight: 200, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const profile = {
      id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 1, baseWidth: 359, baseHeight: 259, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const position = popupPosition(item as Parameters<typeof popupPosition>[0], { width: 844, height: 390 }, [profile as Parameters<typeof popupPosition>[0]])

    expect(Math.abs(position.x)).toBeGreaterThan(Math.abs(position.y))
    expect(Math.abs(position.y)).toBeLessThan(30)
  })
})

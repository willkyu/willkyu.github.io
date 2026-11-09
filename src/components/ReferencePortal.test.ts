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
  it('uses the available area below compact navigation on a portrait phone', () => {
    const item = {
      id: 'mobile-card', kind: 'content', spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 220, baseHeight: 200, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const profile = {
      id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 1, baseWidth: 359, baseHeight: 259, x: 0, y: -383, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const position = popupPosition(item as Parameters<typeof popupPosition>[0], { width: 390, height: 844 }, [profile as Parameters<typeof popupPosition>[0]])

    expect(position.y).toBeGreaterThan(profile.y + 29)
    expect(position.x).toBeCloseTo(0, 5)
    expect(position.y).toBeCloseTo(0, 5)
  })

  it('keeps popup content below the navigation bar after rotating a phone to landscape', () => {
    const item = {
      id: 'landscape-card', kind: 'content', spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 220, baseHeight: 200, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const profile = {
      id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 1, baseWidth: 359, baseHeight: 259, x: 0, y: -159, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const position = popupPosition(item as Parameters<typeof popupPosition>[0], { width: 844, height: 390 }, [profile as Parameters<typeof popupPosition>[0]])

    expect(position.y).toBeGreaterThan(profile.y + 26)
    expect(position.x).toBeCloseTo(0, 5)
    expect(position.y).toBeCloseTo(0, 5)
  })

  it('uses the closest free mobile position when the viewport centre is occupied', () => {
    const item = {
      id: 'mobile-card', kind: 'content', spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 220, baseHeight: 200, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const profile = {
      id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 1, baseWidth: 359, baseHeight: 259, x: 0, y: -390, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const centreObstacle = {
      id: 'centre-link', kind: 'link', spawned: true, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 64, baseHeight: 64, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: true,
    }
    const position = popupPosition(
      item as Parameters<typeof popupPosition>[0],
      { width: 390, height: 844 },
      [profile, centreObstacle] as Parameters<typeof popupPosition>[2],
    )

    expect(Math.hypot(position.x, position.y)).toBeGreaterThan(90)
    expect(Math.hypot(position.x, position.y)).toBeLessThan(230)
  })

  it('keeps desktop popup positions on the first ring around the centre profile', () => {
    const item = {
      id: 'desktop-card', kind: 'content', spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 0, baseWidth: 250, baseHeight: 190, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const profile = {
      id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false,
      attractStrength: 1, baseWidth: 359, baseHeight: 259, x: 0, y: 0, vx: 0, vy: 0, scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const position = popupPosition(item as Parameters<typeof popupPosition>[0], { width: 1440, height: 900 }, [profile as Parameters<typeof popupPosition>[0]])

    expect(Math.hypot(position.x, position.y)).toBeLessThan(410)
    expect(Math.hypot(position.x, position.y)).toBeGreaterThan(250)
  })
})

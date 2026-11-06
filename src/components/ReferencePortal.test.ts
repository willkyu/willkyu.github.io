import { describe, expect, it } from 'vitest'
import { essayExpandedHeight } from './ReferencePortal'

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

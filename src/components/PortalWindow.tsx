import type { CSSProperties } from 'react'
import type { CategoryConfig, ContentConfig, SlotConfig, SlotPosition } from '../config/types'
import { CardRenderer } from './CardRenderer'

interface PortalWindowProps {
  slot: SlotConfig
  content: ContentConfig
  category: CategoryConfig
  active: boolean
  closing: boolean
  onActivate: () => void
  onClose: () => void
}

function anchorOffset(anchor: SlotPosition['anchor']) {
  const values: Record<SlotPosition['anchor'], [string, string]> = {
    'top-left': ['0%', '0%'], center: ['-50%', '-50%'], 'top-right': ['-100%', '0%'],
    'bottom-left': ['0%', '-100%'], 'bottom-right': ['-100%', '-100%'],
  }
  return values[anchor]
}

export function PortalWindow({ slot, content, category, active, closing, onActivate, onClose }: PortalWindowProps) {
  const appearanceSize = {
    text: [180, 64], essay: [280, 64], browser: [240, 150], book: [182, 257], disc: [220, 200], gallery: [250, 190],
  }[content.appearance]
  const cssVars: Record<string, string | number> = {
    '--slot-angle': `${slot.angle}deg`, '--slot-z': slot.zIndex,
    '--card-width': `${appearanceSize[0]}px`, '--card-height': `${appearanceSize[1]}px`,
  }
  ;(['desktop', 'tablet', 'mobile'] as const).forEach((name) => {
    const position = slot.positions[name]
    const [anchorX, anchorY] = anchorOffset(position.anchor)
    cssVars[`--${name}-x`] = `${position.x}%`
    cssVars[`--${name}-y`] = `${position.y}%`
    cssVars[`--${name}-width`] = `${position.width}px`
    cssVars[`--${name}-height`] = `${position.height}px`
    cssVars[`--${name}-max-content`] = `${position.maxContentHeight}px`
    cssVars[`--${name}-anchor-x`] = anchorX
    cssVars[`--${name}-anchor-y`] = anchorY
  })

  return (
    <section
      className="slot-position"
      data-slot={slot.id}
      data-enter={slot.enterFrom}
      data-active={active}
      data-closing={closing}
      data-appearance={content.appearance}
      style={cssVars as CSSProperties}
      aria-label={`${category.label}：${content.title}`}
      onPointerDown={onActivate}
    >
      <div className="window-angle">
        <div className="portal-window" key={content.id} tabIndex={-1}>
          <div className="window-content"><CardRenderer content={content} /></div>
          {category.viewAllHref && <a className="window-category" href={category.viewAllHref} aria-label={`查看全部：${category.label}`} title={`查看全部 ${category.label}`} onPointerDown={(event) => event.stopPropagation()}>{category.label} / ALL</a>}
          <button className="window-close" type="button" onClick={(event) => { event.stopPropagation(); onClose() }} aria-label={`关闭 ${content.title}`}>×</button>
        </div>
      </div>
    </section>
  )
}

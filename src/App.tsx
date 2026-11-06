import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Character } from './components/Character'
import { Navigation } from './components/Navigation'
import { PortalWindow } from './components/PortalWindow'
import { HalftoneBackground } from './components/HalftoneBackground'
import { ReferencePortal } from './components/ReferencePortal'
import { loadHomepageFeeds } from './config/contentFeeds'
import { ConfigValidationError, loadBaseConfig } from './config/validate'
import type { CategoryConfig, PortalConfig } from './config/types'

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

export function App() {
  const [config, setConfig] = useState<PortalConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [occupied, setOccupied] = useState<Record<string, string>>({})
  const [activeSlot, setActiveSlot] = useState<string | null>(null)
  const [closing, setClosing] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('请选择一个栏目。')
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const closeTimers = useRef(new Map<string, number>())

  useEffect(() => {
    let active = true
    loadBaseConfig().then(async (baseConfig) => {
      if (!active) return
      setConfig(baseConfig)
      const mergedConfig = await loadHomepageFeeds(baseConfig)
      if (active) setConfig(mergedConfig)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof ConfigValidationError ? reason.message : `门户启动失败：${reason instanceof Error ? reason.message : String(reason)}`)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!config) return
    const update = () => setBreakpoint(window.innerWidth <= config.layout.breakpoints.mobile ? 'mobile' : window.innerWidth <= config.layout.breakpoints.tablet ? 'tablet' : 'desktop')
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [config])

  useEffect(() => () => closeTimers.current.forEach((timer) => window.clearTimeout(timer)), [])

  const contentsById = useMemo(() => new Map(config?.content.map((item) => [item.id, item]) ?? []), [config])
  const categoriesById = useMemo(() => new Map(config?.categories.map((item) => [item.id, item]) ?? []), [config])
  const contentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    config?.content.forEach((item) => counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1))
    return counts
  }, [config])
  const activeCategoryIds = useMemo(() => new Set(Object.values(occupied).map((id) => contentsById.get(id)?.categoryId).filter(Boolean) as string[]), [occupied, contentsById])

  const openCategory = useCallback((category: CategoryConfig) => {
    if (!config) return
    const candidates = config.content.filter((item) => item.categoryId === category.id).sort((a, b) => a.order - b.order)
    if (!candidates.length) {
      setStatus(`“${category.label}”暂时没有配置内容。`)
      return
    }

    setOccupied((current) => {
      const currentIds = new Set(Object.values(current))
      const unopened = candidates.filter((item) => !currentIds.has(item.id))
      if (!unopened.length) {
        const existingSlot = category.slots.find((slotId) => candidates.some((item) => item.id === current[slotId]))
        if (existingSlot) {
          setActiveSlot(existingSlot)
          setStatus(`“${category.label}”的内容已全部打开；已聚焦现有窗口。`)
        }
        return current
      }

      const chosen = category.selection === 'random' ? randomItem(unopened) : unopened[0]
      const emptySlot = category.slots.find((slotId) => !current[slotId])
      const targetSlot = emptySlot ?? (category.slots.includes(activeSlot ?? '') ? activeSlot! : category.slots[0])
      if (!targetSlot) {
        setStatus(`“${category.label}”没有可用槽位，请检查配置。`)
        return current
      }
      const previousTimer = closeTimers.current.get(targetSlot)
      if (previousTimer) window.clearTimeout(previousTimer)
      setClosing((value) => { const next = new Set(value); next.delete(targetSlot); return next })
      setActiveSlot(targetSlot)
      setStatus(`${emptySlot ? '已打开' : '已切换为'}“${chosen.title}”。`)
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#category=${encodeURIComponent(category.id)}`)
      return { ...current, [targetSlot]: chosen.id }
    })
  }, [activeSlot, config])

  useEffect(() => {
    if (!config) return
    const id = new URLSearchParams(window.location.hash.slice(1)).get('category')
    const category = config.categories.find((item) => item.id === id)
    if (category) openCategory(category)
  }, [config]) // eslint-disable-line react-hooks/exhaustive-deps

  const closeSlot = useCallback((slotId: string) => {
    if (!config || !occupied[slotId] || closing.has(slotId)) return
    setClosing((current) => new Set(current).add(slotId))
    const delay = config.motion.enabled ? config.motion.fastDuration : 0
    const timer = window.setTimeout(() => {
      setOccupied((current) => {
        const next = { ...current }
        delete next[slotId]
        setActiveSlot((active) => active === slotId ? (Object.keys(next)[0] ?? null) : active)
        return next
      })
      setClosing((current) => { const next = new Set(current); next.delete(slotId); return next })
      closeTimers.current.delete(slotId)
      setStatus('窗口已关闭；其他窗口位置保持不变。')
    }, delay)
    closeTimers.current.set(slotId, timer)
  }, [closing, config, occupied])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeSlot) closeSlot(activeSlot)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSlot, closeSlot])

  if (error) return <main className="config-error"><p>CONFIG ERROR</p><h1>门户配置需要修正</h1><pre>{error}</pre><span>请检查 public/portal.config.json；详细字段见 docs/CONFIGURATION.md。</span></main>
  if (!config) return <main className="portal-bootstrap" aria-label="正在准备主页" />

  const rootVars = {
    '--paper': config.theme.paper, '--ink': config.theme.ink, '--accent': config.theme.accent, '--muted': config.theme.muted,
    '--font-display': config.theme.fontDisplay, '--font-body': config.theme.fontBody,
    '--line-width': `${config.theme.lineWidth}px`, '--shadow-offset': `${config.theme.shadowOffset}px`, '--radius': `${config.theme.radius}px`,
    '--dot-size': `${config.theme.halftone.density}px`, '--halftone-opacity': config.theme.halftone.enabled ? config.theme.halftone.intensity : 0,
    '--fade-radius': `${config.theme.halftone.fadeRadius}%`, '--motion-duration': `${config.motion.enabled ? config.motion.duration : 0}ms`,
    '--motion-fast': `${config.motion.enabled ? config.motion.fastDuration : 0}ms`, '--motion-easing': config.motion.easing,
    '--hover-scale': config.motion.enabled ? config.motion.hoverScale : 1, '--hover-tilt': `${config.motion.enabled ? config.motion.hoverTilt : 0}deg`,
    '--press-scale': config.motion.enabled ? config.motion.pressScale : 1, '--enter-distance': `${config.motion.enterDistance}px`,
    '--tablet-breakpoint': `${config.layout.breakpoints.tablet}px`, '--mobile-breakpoint': `${config.layout.breakpoints.mobile}px`,
    '--identity-target-width': `${680 / config.layout.referenceWidth * 100}vw`, '--identity-target-height': `${460 / config.layout.referenceHeight * 100}vh`,
  } as CSSProperties

  const openSlots = config.layout.slots.filter((slot) => occupied[slot.id] && contentsById.has(occupied[slot.id]))

  if (config.layout.mode === 'reference-physics') return <ReferencePortal config={config} style={rootVars} />

  return (
    <main className="portal" style={rootVars} data-breakpoint={breakpoint}>
      <div className="portal-scene">
        <HalftoneBackground paper={config.theme.paper} ink={config.theme.ink} config={config.theme.halftone} />
        <div className="floating-links" aria-label="站点链接">
          {config.site.links.map((link, index) => <a key={link.label} href={link.href} data-index={index}><span>{link.label}</span><i>{link.label}</i></a>)}
        </div>

        <section className="identity-panel" aria-label="个人身份与分类导航">
          <div className="identity-black" aria-hidden="true" />
          <h1 className="identity-name">{config.site.name}</h1>
          <div className="speech-bubble">{config.site.bubble}</div>
          <div className="character-frame"><Character config={config.character} motion={config.motion} /></div>
          <div className="identity-copy">
            <p className="sr-only">{config.site.description}</p>
            <Navigation categories={config.categories} activeCategoryIds={activeCategoryIds} onSelect={openCategory} contentCounts={contentCounts} />
          </div>
        </section>

        {openSlots.length > 0 && <div className="window-dock" aria-label="已打开窗口">
          {openSlots.map((slot) => {
            const content = contentsById.get(occupied[slot.id])!
            return <button type="button" key={slot.id} data-active={activeSlot === slot.id} onClick={() => setActiveSlot(slot.id)}>{content.title}</button>
          })}
        </div>}

        <div className="window-layer">
          {openSlots.map((slot) => {
            const content = contentsById.get(occupied[slot.id])!
            const category = categoriesById.get(content.categoryId)!
            return <PortalWindow key={slot.id} slot={slot} content={content} category={category} active={activeSlot === slot.id} closing={closing.has(slot.id)} onActivate={() => setActiveSlot(slot.id)} onClose={() => closeSlot(slot.id)} />
          })}
        </div>

        <p className="sr-only" aria-live="polite">{status}</p>
      </div>
    </main>
  )
}

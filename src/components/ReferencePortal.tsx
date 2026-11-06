import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import type { CategoryConfig, ContentConfig, PortalConfig } from '../config/types'
import { CardRenderer } from './CardRenderer'
import { Character } from './Character'
import { HalftoneBackground } from './HalftoneBackground'
import { Navigation } from './Navigation'

type ItemKind = 'profile' | 'link' | 'credit' | 'content'

function captureLinkPointer(event: PointerEvent<HTMLAnchorElement>) {
  if (event.button === 0 && event.isPrimary) event.currentTarget.setPointerCapture(event.pointerId)
}

function activateWrappedLink(event: MouseEvent<HTMLDivElement>) {
  if (event.button !== 0 || event.defaultPrevented || (event.target as Element).closest('a')) return
  event.currentTarget.querySelector<HTMLAnchorElement>('a[href]')?.click()
}

interface SceneItem {
  id: string
  kind: ItemKind
  content?: ContentConfig
  label?: string
  href?: string
  categoryId?: string
  spawned: boolean
  queued: boolean
  fixed: boolean
  hovered: boolean
  pressed: boolean
  attractStrength: number
  baseWidth: number
  baseHeight: number
  x: number
  y: number
  vx: number
  vy: number
  scale: number
  targetScale: number
  expansion: number
  targetExpansion: number
}

interface ViewportSize {
  width: number
  height: number
}

const appearanceSize: Record<ContentConfig['appearance'], [number, number]> = {
  text: [180, 64], essay: [280, 64], browser: [240, 150], book: [182, 257], disc: [220, 200], gallery: [250, 190],
}

export function essayExpandedHeight(description: string, width: number, baseHeight: number) {
  const bodyFontSize = Math.min(17, Math.max(14, width * .048))
  const lineCapacity = Math.max(1, (width - 28) / (bodyFontSize * .9))
  const paragraphs = description.split(/\r?\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
  const bodyLines = Math.max(1, paragraphs.reduce((lines, paragraph) => lines + Math.max(1, Math.ceil(titleUnits(paragraph) / lineCapacity)), 0))
  const paragraphGaps = Math.max(0, paragraphs.length - 1) * 5
  const contentHeight = baseHeight + 5 + bodyLines * bodyFontSize * 1.55 + paragraphGaps + 36
  return Math.min(520, Math.max(baseHeight + 96, contentHeight))
}

function essayExpansion(item: SceneItem) {
  if (item.content?.appearance !== 'essay') return 1
  const expandedHeight = essayExpandedHeight(item.content.description, item.baseWidth, item.baseHeight)
  return expandedHeight / item.baseHeight
}

function titleUnits(value: string) {
  return Array.from(value.trim()).reduce((total, character) => {
    if (/\s/.test(character)) return total + .34
    return total + (/[^\u0000-\u00ff]/.test(character) ? 1 : .56)
  }, 0)
}

function contentSize(entry: ContentConfig): [number, number] {
  if (entry.appearance !== 'text' && entry.appearance !== 'essay') return appearanceSize[entry.appearance]
  const units = Math.max(1, titleUnits(entry.title))
  const minimumWidth = entry.appearance === 'essay' ? 260 : 180
  const width = Math.round(Math.min(360, Math.max(minimumWidth, 90 + units * 9)))
  const fontSize = Math.min(22, Math.max(15, width * .065))
  const lineCapacity = Math.max(1, (width - 32) / (fontSize * 1.12))
  const lines = Math.max(1, Math.ceil(units / lineCapacity))
  const height = Math.round(Math.min(150, Math.max(64, 18 + lines * fontSize * 1.3)))
  return [width, height]
}

function itemScale(item: SceneItem, viewport: ViewportSize) {
  const shortHeight = viewport.height < 650 ? .9 : 1
  const sceneBoost = 1.08
  if (item.kind === 'profile') {
    if (viewport.width <= 420) return .9 * shortHeight
    if (viewport.width <= 700) return .94 * shortHeight
    if (viewport.width <= 1100) return .96 * shortHeight
    return 1
  }
  if (viewport.width <= 420) return (item.kind === 'link' ? .72 : item.kind === 'credit' ? .76 : .7) * shortHeight * sceneBoost
  if (viewport.width <= 700) return (item.kind === 'link' ? .8 : item.kind === 'credit' ? .82 : .76) * shortHeight * sceneBoost
  if (viewport.width <= 1100) return .88 * shortHeight * sceneBoost
  return sceneBoost
}

function visualSize(item: SceneItem, viewport: ViewportSize) {
  const scale = itemScale(item, viewport) * item.scale
  const labelWidth = item.kind === 'link' ? Math.max(item.baseWidth, (item.label?.length ?? 0) * 18) : item.baseWidth
  return { width: labelWidth * scale, height: item.baseHeight * scale * item.expansion }
}

function clampPosition(item: SceneItem, viewport: ViewportSize, position = { x: item.x, y: item.y }) {
  if (item.kind === 'profile') return { x: 0, y: 0 }
  const size = visualSize(item, viewport)
  const margin = viewport.width <= 700 ? 10 : 18
  const halfWidth = size.width / 2
  const halfHeight = size.height / 2
  const minX = -viewport.width / 2 + margin + halfWidth
  const maxX = viewport.width / 2 - margin - halfWidth
  if (item.content?.appearance === 'essay') {
    const maximumHeight = item.baseHeight * itemScale(item, viewport) * item.scale * essayExpansion(item)
    const minimumTop = -viewport.height / 2 + margin
    const maximumTop = viewport.height / 2 - margin - maximumHeight
    const requestedTop = position.y - halfHeight
    const top = minimumTop > maximumTop ? minimumTop : Math.max(minimumTop, Math.min(maximumTop, requestedTop))
    return {
      x: minX > maxX ? 0 : Math.max(minX, Math.min(maxX, position.x)),
      y: top + halfHeight,
    }
  }
  const minY = -viewport.height / 2 + margin + halfHeight
  const maxY = viewport.height / 2 - margin - halfHeight
  return {
    x: minX > maxX ? 0 : Math.max(minX, Math.min(maxX, position.x)),
    y: minY > maxY ? 0 : Math.max(minY, Math.min(maxY, position.y)),
  }
}

function popupPosition(item: SceneItem, viewport: ViewportSize, items: SceneItem[]) {
  const compactRadius = Math.min(viewport.width, viewport.height) * (viewport.width <= 700 ? .36 : .25)
  const radius = Math.max(viewport.width <= 700 ? 145 : 165, compactRadius)
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ].sort(() => Math.random() - .5)
  const occupied = items.filter((entry) => entry.spawned && entry.id !== item.id)
  const itemSize = visualSize(item, viewport)

  return directions
    .map((direction) => {
      const perpendicularJitter = (Math.random() - .5) * radius * .34
      const position = clampPosition(item, viewport, {
        x: direction.x * radius - direction.y * perpendicularJitter,
        y: direction.y * radius + direction.x * perpendicularJitter,
      })
      const score = occupied.reduce((total, other) => {
        const otherSize = visualSize(other, viewport)
        const clearanceX = Math.abs(position.x - other.x) - (itemSize.width + otherSize.width) / 2
        const clearanceY = Math.abs(position.y - other.y) - (itemSize.height + otherSize.height) / 2
        if (clearanceX < 0 && clearanceY < 0) {
          return total - 100_000 - Math.abs(clearanceX * clearanceY)
        }
        const edgeDistance = Math.hypot(Math.max(0, clearanceX), Math.max(0, clearanceY))
        return total + Math.min(edgeDistance, 320)
      }, 0)
      return { position, score }
    })
    .sort((a, b) => b.score - a.score)[0].position
}

function radialPosition(item: SceneItem, viewport: ViewportSize, angle: number, radius: number) {
  return clampPosition(item, viewport, {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  })
}

function creditPosition(item: SceneItem, viewport: ViewportSize) {
  const size = visualSize(item, viewport)
  const margin = viewport.width <= 700 ? 18 : 24
  return clampPosition(item, viewport, {
    x: 0,
    y: viewport.height / 2 - margin - size.height / 2,
  })
}

function clampVector(x: number, y: number, max: number) {
  const magnitude = Math.hypot(x, y)
  return magnitude > max ? { x: x * max / magnitude, y: y * max / magnitude } : { x, y }
}

function repel(distance: number, halfSize: number, gap: number) {
  const separation = Math.abs(distance) - halfSize
  const sign = distance >= 0 ? 1 : -1
  return separation < gap ? sign * (gap - separation) : 0
}

function physicsStep(items: SceneItem[], viewport: ViewportSize) {
  const next = items.map((item) => ({ ...item }))
  for (const item of next) {
    const previousHeight = visualSize(item, viewport).height
    const difference = item.targetScale - item.scale
    if (Math.abs(difference) > .001) item.scale += difference * .2
    else item.scale = item.targetScale
    const expansionDifference = item.targetExpansion - item.expansion
    if (Math.abs(expansionDifference) > .001) item.expansion += expansionDifference * .2
    else item.expansion = item.targetExpansion
    if (item.content?.appearance === 'essay') {
      const nextHeight = visualSize(item, viewport).height
      item.y += (nextHeight - previousHeight) / 2
      const position = clampPosition(item, viewport)
      item.x = position.x
      item.y = position.y
    }
  }
  const spawned = next.filter((item) => item.spawned)
  const gap = viewport.width <= 700 ? 10 : 16

  for (const item of spawned) {
    if (item.fixed || item.hovered) continue
    const itemSize = visualSize(item, viewport)
    let attractionX = 0
    let attractionY = 0
    let repelX = 0
    let repelY = 0
    let repelCountX = 0
    let repelCountY = 0

    for (const other of spawned) {
      if (other.id === item.id) continue
      const otherSize = visualSize(other, viewport)
      const dx = other.x - item.x
      const dy = other.y - item.y
      const halfWidth = (itemSize.width + otherSize.width) / 2
      const halfHeight = (itemSize.height + otherSize.height) / 2
      const gapX = Math.max(0, Math.abs(dx) - halfWidth)
      const gapY = Math.max(0, Math.abs(dy) - halfHeight)
      attractionX += (dx >= 0 ? 1 : -1) * gapX * other.attractStrength
      attractionY += (dy >= 0 ? 1 : -1) * gapY * other.attractStrength

      const separationX = Math.abs(item.x - other.x) - halfWidth
      const separationY = Math.abs(item.y - other.y) - halfHeight
      if (separationX < gap && separationY < gap) {
        if (separationX >= separationY) {
          repelX += repel(item.x - other.x, halfWidth, gap)
          repelCountX += 1
        } else {
          repelY += repel(item.y - other.y, halfHeight, gap)
          repelCountY += 1
        }
      }
    }

    if (repelCountX) repelX /= repelCountX
    if (repelCountY) repelY /= repelCountY
    if (attractionX * repelX < 0) attractionX = 0
    if (attractionY * repelY < 0) attractionY = 0
    const velocity = clampVector(attractionX + repelX, attractionY + repelY, 320)
    item.vx = velocity.x
    item.vy = velocity.y
    const position = clampPosition(item, viewport, {
      x: item.x + velocity.x * .033,
      y: item.y + velocity.y * .033,
    })
    item.x = position.x
    item.y = position.y
  }
  return next
}

function createContentItem(entry: ContentConfig): SceneItem {
  const [width, height] = contentSize(entry)
  return {
    id: entry.id, kind: 'content', content: entry, categoryId: entry.categoryId,
    spawned: false, queued: false, fixed: false, hovered: false, pressed: false, attractStrength: 0,
    baseWidth: width, baseHeight: height, x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
  }
}

function createItems(config: PortalConfig, viewport: ViewportSize): SceneItem[] {
  const profile: SceneItem = {
    id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, pressed: false, attractStrength: 1,
    baseWidth: 359, baseHeight: 259, x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
  }
  const links = config.site.links.map((link, index) => {
    const item: SceneItem = {
      id: `link-${index}-${link.label}`, kind: 'link', label: link.label, href: link.href,
      spawned: false, queued: false, fixed: false, hovered: false, pressed: false, attractStrength: 0,
      baseWidth: 64, baseHeight: 64, x: 0, y: 0, vx: 0, vy: 0,
      scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
    }
    const angle = -Math.PI / 2 + index / Math.max(config.site.links.length, 1) * Math.PI * 2 + (Math.random() - .5) * .35
    const radius = Math.min(viewport.width, viewport.height) * (viewport.width <= 700 ? .35 : .27)
    return { ...item, ...radialPosition(item, viewport, angle, Math.max(155, radius)) }
  })
  const creditBase: SceneItem = {
    id: 'reference-credit', kind: 'credit', label: 'NIKUKIKAI.ART', href: 'https://nikukikai.art/',
    spawned: false, queued: false, fixed: true, hovered: false, pressed: false, attractStrength: 0,
    baseWidth: 360, baseHeight: 54, x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1,
  }
  const credit = { ...creditBase, ...creditPosition(creditBase, viewport) }
  const content = config.content.map(createContentItem)
  return [profile, ...links, credit, ...content]
}

interface ReferencePortalProps {
  config: PortalConfig
  style: CSSProperties
}

export function ReferencePortal({ config, style }: ReferencePortalProps) {
  const initialViewport = useMemo(() => ({ width: window.innerWidth, height: window.innerHeight }), [])
  const initialItems = useMemo(() => createItems(config, initialViewport), [config, initialViewport])
  const itemsRef = useRef<SceneItem[]>(initialItems)
  const viewportRef = useRef<ViewportSize>(initialViewport)
  const spawnTimers = useRef<number[]>([])
  const [viewport, setViewport] = useState<ViewportSize>(initialViewport)
  const [items, setItems] = useState<SceneItem[]>(initialItems)
  const [mouse, setMouse] = useState({ x: initialViewport.width / 2, y: initialViewport.height / 2 })

  const updateItems = useCallback((updater: (current: SceneItem[]) => SceneItem[]) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    setItems(next)
  }, [])

  useEffect(() => {
    const delays = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? [0, 20, 40, 60]
      : [360, 500, 640, 820]
    const introItems = itemsRef.current.filter((item) => item.kind === 'link' || item.kind === 'credit')
    const timers = introItems.map((item, index) => window.setTimeout(() => {
      updateItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, spawned: true } : entry))
    }, delays[index] ?? delays.at(-1) ?? 0))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [updateItems])

  useEffect(() => {
    updateItems((current) => {
      const currentContent = new Map(current.filter((item) => item.kind === 'content').map((item) => [item.id, item]))
      const nonContent = current.filter((item) => item.kind !== 'content')
      const content = config.content.map((entry) => {
        const existing = currentContent.get(entry.id)
        return existing
          ? { ...existing, content: entry, categoryId: entry.categoryId }
          : createContentItem(entry)
      })
      return [...nonContent, ...content]
    })
  }, [config.content, updateItems])

  useEffect(() => {
    const update = () => {
      const previous = viewportRef.current
      const nextViewport = { width: window.innerWidth, height: window.innerHeight }
      viewportRef.current = nextViewport
      setViewport(nextViewport)
      updateItems((current) => current.map((item) => {
        if (item.kind === 'profile' || !item.spawned) return item
        if (item.kind === 'credit') return { ...item, ...creditPosition(item, nextViewport) }
        const projected = {
          x: item.x * nextViewport.width / Math.max(previous.width, 1),
          y: item.y * nextViewport.height / Math.max(previous.height, 1),
        }
        return { ...item, ...clampPosition(item, nextViewport, projected) }
      }))
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [updateItems])

  useEffect(() => {
    let animation = 0
    const tick = () => {
      const next = physicsStep(itemsRef.current, viewportRef.current)
      itemsRef.current = next
      setItems(next)
      animation = window.requestAnimationFrame(tick)
    }
    animation = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animation)
  }, [])

  useEffect(() => () => spawnTimers.current.forEach((timer) => window.clearTimeout(timer)), [])

  const resetScenePointer = useCallback(() => {
    const current = viewportRef.current
    setMouse({ x: current.width / 2, y: current.height / 2 })
  }, [])

  useEffect(() => {
    window.addEventListener('blur', resetScenePointer)
    document.documentElement.addEventListener('mouseleave', resetScenePointer)
    return () => {
      window.removeEventListener('blur', resetScenePointer)
      document.documentElement.removeEventListener('mouseleave', resetScenePointer)
    }
  }, [resetScenePointer])

  const remainingCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (item.kind === 'content' && !item.spawned && !item.queued && item.categoryId) {
        counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
      }
    }
    return counts
  }, [items])

  const spawnCategory = useCallback((category: CategoryConfig) => {
    const candidates = itemsRef.current
      .filter((item) => item.kind === 'content' && item.categoryId === category.id && !item.spawned && !item.queued)
      .sort(() => Math.random() - .5)
    if (!candidates.length) return
    const candidateIds = new Set(candidates.map((item) => item.id))
    updateItems((current) => current.map((item) => candidateIds.has(item.id) ? { ...item, queued: true } : item))

    candidates.forEach((candidate, index) => {
      const timer = window.setTimeout(() => {
        updateItems((current) => current.map((item) => {
          if (item.id !== candidate.id) return item
          return {
            ...item,
            ...popupPosition(item, viewportRef.current, current),
            spawned: true,
            queued: false,
            vx: 0,
            vy: 0,
          }
        }))
      }, index * 170)
      spawnTimers.current.push(timer)
    })
  }, [updateItems])

  const setHover = useCallback((id: string, hovered: boolean) => {
    updateItems((current) => current.map((item) => {
      if (item.id !== id) return item
      if (item.pressed) return { ...item, hovered }
      const isExpandableText = item.content?.appearance === 'text'
      const isEssay = item.content?.appearance === 'essay'
      return {
        ...item,
        hovered,
        targetScale: item.fixed || !hovered ? 1 : isEssay ? 1 : isExpandableText ? 1.35 : config.motion.hoverScale,
        targetExpansion: hovered && isEssay ? essayExpansion(item) : hovered && isExpandableText && config.motion.enabled ? 1.85 : 1,
      }
    }))
  }, [config.motion.enabled, config.motion.hoverScale, updateItems])

  const pressItem = useCallback((id: string, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    resetTilt(event)
    updateItems((current) => current.map((item) => item.id === id ? {
      ...item,
      pressed: true,
      hovered: true,
      vx: 0,
      vy: 0,
      targetScale: item.scale,
      targetExpansion: item.expansion,
    } : item))
  }, [updateItems])

  const releaseItem = useCallback((id: string) => {
    window.setTimeout(() => updateItems((current) => current.map((item) => {
      if (item.id !== id) return item
      const isExpandableText = item.content?.appearance === 'text'
      const isEssay = item.content?.appearance === 'essay'
      return {
        ...item,
        pressed: false,
        targetScale: item.fixed || !item.hovered ? 1 : isEssay ? 1 : isExpandableText ? 1.35 : config.motion.hoverScale,
        targetExpansion: item.hovered && isEssay ? essayExpansion(item) : item.hovered && isExpandableText && config.motion.enabled ? 1.85 : 1,
      }
    })), 0)
  }, [config.motion.enabled, config.motion.hoverScale, updateItems])

  const tiltCard = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.currentTarget.dataset.pressed === 'true') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - .5) * 2
    const y = ((event.clientY - rect.top) / rect.height - .5) * 2
    event.currentTarget.style.setProperty('--card-tilt-x', `${-y * 22}deg`)
    event.currentTarget.style.setProperty('--card-tilt-y', `${x * 22}deg`)
    event.currentTarget.style.setProperty('--surface-x', `${Math.round(x * 3)}px`)
    event.currentTarget.style.setProperty('--surface-y', `${Math.round(y * 2)}px`)
    event.currentTarget.style.setProperty('--surface-angle', `${(x * 1.4).toFixed(2)}deg`)
    event.currentTarget.style.setProperty('--layer-near-x', `${Math.round(x * 12)}px`)
    event.currentTarget.style.setProperty('--layer-near-y', `${Math.round(y * 9)}px`)
    event.currentTarget.style.setProperty('--layer-mid-x', `${Math.round(x * 6)}px`)
    event.currentTarget.style.setProperty('--layer-mid-y', `${Math.round(y * 4)}px`)
    event.currentTarget.style.setProperty('--layer-far-x', `${Math.round(-x * 4)}px`)
    event.currentTarget.style.setProperty('--layer-far-y', `${Math.round(-y * 3)}px`)
    event.currentTarget.style.setProperty('--disc-spine-x', `${Math.round(x * 2)}px`)
    event.currentTarget.style.setProperty('--disc-spine-y', `${Math.round(y * 1.5)}px`)
  }

  const resetTilt = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--card-tilt-x', '0deg')
    event.currentTarget.style.setProperty('--card-tilt-y', '0deg')
    event.currentTarget.style.setProperty('--surface-x', '0px')
    event.currentTarget.style.setProperty('--surface-y', '0px')
    event.currentTarget.style.setProperty('--surface-angle', '0deg')
    event.currentTarget.style.setProperty('--layer-near-x', '0px')
    event.currentTarget.style.setProperty('--layer-near-y', '0px')
    event.currentTarget.style.setProperty('--layer-mid-x', '0px')
    event.currentTarget.style.setProperty('--layer-mid-y', '0px')
    event.currentTarget.style.setProperty('--layer-far-x', '0px')
    event.currentTarget.style.setProperty('--layer-far-y', '0px')
    event.currentTarget.style.setProperty('--disc-spine-x', '0px')
    event.currentTarget.style.setProperty('--disc-spine-y', '0px')
  }

  const gaze = {
    x: (mouse.x / Math.max(viewport.width, 1) * 2 - 1) * config.character.eyeFollow.maxX,
    y: (mouse.y / Math.max(viewport.height, 1) * 2 - 1) * config.character.eyeFollow.maxY,
  }
  const centrePointer = {
    x: (mouse.x / Math.max(viewport.width, 1) - .5) * 2,
    y: (mouse.y / Math.max(viewport.height, 1) - .5) * 2,
  }
  const spawned = items.filter((item) => item.spawned)

  return (
    <main className="portal reference-portal" style={style}>
      <div className="reference-viewport" onPointerMove={(event) => setMouse({ x: event.clientX, y: event.clientY })} onPointerLeave={resetScenePointer}>
        <HalftoneBackground paper={config.theme.paper} ink={config.theme.ink} config={config.theme.halftone} cameraX={0} cameraY={0} />
        <div className="reference-world">
          {spawned.map((item) => {
            const responsiveScale = itemScale(item, viewport)
            const itemWidth = item.baseWidth * item.scale * responsiveScale
            const itemHeight = item.baseHeight * item.scale * item.expansion * responsiveScale
            const itemStyle = {
              left: item.x - itemWidth / 2,
              top: item.y - itemHeight / 2,
              width: itemWidth,
              height: itemHeight,
              zIndex: item.kind === 'profile' ? 20 : item.scale > 1.01 || item.expansion > 1.01 ? 30 : 10,
              '--responsive-scale': 1,
              '--disc-title-font-size': `${Math.min(26, Math.max(10, 16 * responsiveScale * item.scale))}px`,
              '--disc-copy-font-size': `${Math.min(16, Math.max(9, 10 * responsiveScale * item.scale))}px`,
              '--popup-overshoot-scale': 1.08,
              '--popup-settle-scale': .96,
            } as CSSProperties
            if (item.kind === 'profile') {
              const profileStyle = {
                ...itemStyle,
                '--centre-far-x': `${Math.round(-centrePointer.x * 3)}px`,
                '--centre-far-y': `${Math.round(-centrePointer.y * 2)}px`,
                '--centre-mid-x': `${Math.round(centrePointer.x * 2)}px`,
                '--centre-mid-y': `${Math.round(centrePointer.y * 1.5)}px`,
                '--centre-near-x': `${Math.round(centrePointer.x * 5)}px`,
                '--centre-near-y': `${Math.round(centrePointer.y * 3)}px`,
                '--centre-option-x': `${Math.round(centrePointer.x * 6)}px`,
                '--centre-option-y': `${Math.round(centrePointer.y * 4)}px`,
                '--profile-transform': 'none',
              } as CSSProperties
              return (
              <section className="identity-panel physics-item profile-popup" style={profileStyle} aria-label="个人身份与分类导航" key={item.id}>
                <div className="identity-black" aria-hidden="true" />
                <h1 className="identity-name">{config.site.name}</h1>
                <div className="speech-bubble">{config.site.bubble}</div>
                <div className="character-frame"><Character config={config.character} motion={config.motion} externalGaze={config.motion.eyeFollow && config.character.eyeFollow.enabled ? gaze : { x: 0, y: 0 }} /></div>
                <div className="identity-copy"><p className="sr-only">{config.site.description}</p><Navigation categories={config.categories} activeCategoryIds={new Set()} onSelect={spawnCategory} contentCounts={remainingCounts} /></div>
              </section>
              )
            }
            if (item.kind === 'link') return (
              <div
                className="physics-item popup-item"
                data-pressed={item.pressed || undefined}
                style={itemStyle}
                key={item.id}
                onPointerEnter={() => setHover(item.id, true)}
                onPointerLeave={(event) => { setHover(item.id, false); resetTilt(event) }}
                onFocus={() => setHover(item.id, true)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHover(item.id, false) }}
                onPointerMove={tiltCard}
                onPointerDown={(event) => pressItem(item.id, event)}
                onPointerUp={() => releaseItem(item.id)}
                onPointerCancel={() => releaseItem(item.id)}
                onClick={activateWrappedLink}
              >
                <a className="physics-link-card" href={item.href} draggable={false} onPointerDown={captureLinkPointer}><span>{item.label}</span><i>{item.label}</i></a>
              </div>
            )
            if (item.kind === 'credit') return (
              <div
                className="physics-item physics-credit popup-item"
                data-pressed={item.pressed || undefined}
                style={itemStyle}
                key={item.id}
                onPointerEnter={() => setHover(item.id, true)}
                onPointerLeave={(event) => { setHover(item.id, false); resetTilt(event) }}
                onFocus={() => setHover(item.id, true)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHover(item.id, false) }}
                onPointerMove={tiltCard}
                onPointerDown={(event) => pressItem(item.id, event)}
                onPointerUp={() => releaseItem(item.id)}
                onPointerCancel={() => releaseItem(item.id)}
                onClick={activateWrappedLink}
              >
                <a className="physics-credit-card" href={item.href} target="_blank" rel="noreferrer" draggable={false} aria-label="感谢并访问参考主页 NIKUKIKAI.ART" onPointerDown={captureLinkPointer}>
                  <span className="credit-far" aria-hidden="true" />
                  <span className="credit-copy"><small>REFERENCE HOMEPAGE / THANK YOU</small><strong>{item.label}</strong></span>
                  <i aria-hidden="true">↗</i>
                </a>
              </div>
            )
            return item.content ? (
              <div
                className="physics-item physics-content popup-item"
                data-pressed={item.pressed || undefined}
                data-appearance={item.content.appearance}
                data-content-id={item.content.id}
                data-base-width={item.baseWidth}
                data-base-height={item.baseHeight}
                style={itemStyle}
                key={item.id}
                onPointerEnter={() => setHover(item.id, true)}
                onPointerLeave={(event) => { setHover(item.id, false); resetTilt(event) }}
                onFocus={() => setHover(item.id, true)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHover(item.id, false) }}
                onPointerMove={tiltCard}
                onPointerDown={(event) => pressItem(item.id, event)}
                onPointerUp={() => releaseItem(item.id)}
                onPointerCancel={() => releaseItem(item.id)}
                onClick={activateWrappedLink}
              ><CardRenderer content={item.content} /></div>
            ) : null
          })}
        </div>
      </div>
    </main>
  )
}

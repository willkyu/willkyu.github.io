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
  exiting?: boolean
  returned?: boolean
  fixed: boolean
  hovered: boolean
  touchExpanded: boolean
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
  mobileCompact?: boolean
}

interface ViewportSize {
  width: number
  height: number
}

type OrientationPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
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

function usesMobileNavigation(viewport: ViewportSize) {
  return viewport.width <= 700 || (viewport.height <= 500 && viewport.width <= 900)
}

function mobileCompactHeight(viewport: ViewportSize) {
  return viewport.height <= 500 ? 56 : 64
}

const mobileContentClearance = 24

function itemScale(item: SceneItem, viewport: ViewportSize) {
  const shortHeight = viewport.height < 650 ? .9 : 1
  const sceneBoost = 1.08
  if (item.kind === 'profile') {
    if (viewport.width <= 420) return .9 * shortHeight
    if (usesMobileNavigation(viewport)) return .94 * shortHeight
    if (viewport.width <= 1100) return .96 * shortHeight
    return 1
  }
  if (viewport.width <= 420) return (item.kind === 'link' ? .72 : item.kind === 'credit' ? .76 : .7) * shortHeight * sceneBoost
  if (usesMobileNavigation(viewport)) return (item.kind === 'link' ? .8 : item.kind === 'credit' ? .82 : .76) * shortHeight * sceneBoost
  if (viewport.width <= 1100) return .88 * shortHeight * sceneBoost
  return sceneBoost
}

function interactionScale(item: SceneItem, viewport: ViewportSize, hoverScale: number, touch = false) {
  if (item.fixed || item.content?.appearance === 'essay') return 1
  if (item.content?.appearance === 'text') return touch ? (usesMobileNavigation(viewport) ? 1.12 : 1.22) : 1.35
  if (!touch) return hoverScale
  return Math.min(hoverScale, usesMobileNavigation(viewport) ? 1.18 : 1.32)
}

function interactionExpansion(item: SceneItem, active: boolean, motionEnabled: boolean) {
  if (!active) return 1
  if (item.content?.appearance === 'essay') return essayExpansion(item)
  if (item.content?.appearance === 'text' && motionEnabled) return 1.55
  return 1
}

function layoutSize(item: SceneItem, viewport: ViewportSize) {
  if (item.kind === 'profile' && usesMobileNavigation(viewport) && item.mobileCompact) {
    return { width: Math.max(300, viewport.width - 20), height: mobileCompactHeight(viewport) }
  }
  const responsiveScale = itemScale(item, viewport)
  const width = item.baseWidth * responsiveScale
  let height = item.baseHeight * responsiveScale * item.expansion
  if (item.content?.appearance === 'text' && item.expansion <= 1.01) {
    const fontSize = Math.min(22, Math.max(15, width * .065))
    const lineCapacity = Math.max(1, (width - 24) / fontSize)
    const lines = Math.max(1, Math.ceil(titleUnits(item.content.title) / lineCapacity))
    height = Math.max(height, 18 + lines * fontSize * 1.3)
  }
  return { width, height }
}

function visualSize(item: SceneItem, viewport: ViewportSize) {
  const size = layoutSize(item, viewport)
  return { width: size.width * item.scale, height: size.height * item.scale }
}

function profilePosition(item: SceneItem, viewport: ViewportSize) {
  if (!usesMobileNavigation(viewport) || !item.mobileCompact) return { x: 0, y: 0 }
  const size = layoutSize(item, viewport)
  return { x: 0, y: -viewport.height / 2 + 10 + size.height / 2 }
}

function collisionSize(item: SceneItem, viewport: ViewportSize) {
  return visualSize(item, viewport)
}

function clampPosition(item: SceneItem, viewport: ViewportSize, position = { x: item.x, y: item.y }) {
  if (item.kind === 'profile') return profilePosition(item, viewport)
  const size = visualSize(item, viewport)
  const mobile = usesMobileNavigation(viewport)
  const margin = mobile ? 10 : 18
  const mobileContentTop = mobile && item.mobileCompact ? -viewport.height / 2 + 10 + mobileCompactHeight(viewport) + mobileContentClearance : -viewport.height / 2 + margin
  const halfWidth = size.width / 2
  const halfHeight = size.height / 2
  const minX = -viewport.width / 2 + margin + halfWidth
  const maxX = viewport.width / 2 - margin - halfWidth
  if (item.content?.appearance === 'essay') {
    const maximumHeight = item.baseHeight * itemScale(item, viewport) * item.scale * essayExpansion(item)
    const minimumTop = mobileContentTop
    const maximumTop = viewport.height / 2 - margin - maximumHeight
    const requestedTop = position.y - halfHeight
    const top = minimumTop > maximumTop ? minimumTop : Math.max(minimumTop, Math.min(maximumTop, requestedTop))
    return {
      x: minX > maxX ? 0 : Math.max(minX, Math.min(maxX, position.x)),
      y: top + halfHeight,
    }
  }
  const minY = mobileContentTop + halfHeight
  const maxY = viewport.height / 2 - margin - halfHeight
  return {
    x: minX > maxX ? 0 : Math.max(minX, Math.min(maxX, position.x)),
    y: minY > maxY ? 0 : Math.max(minY, Math.min(maxY, position.y)),
  }
}

export function popupPosition(item: SceneItem, viewport: ViewportSize, items: SceneItem[]) {
  const mobile = usesMobileNavigation(viewport)
  const margin = mobile ? 10 : 18
  const gap = mobile ? 12 : 18
  const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }].sort(() => Math.random() - .5)
  const occupied = items.filter((entry) => entry.spawned && entry.kind !== 'credit' && entry.id !== item.id)
  const itemSize = visualSize(item, viewport)
  const centreItem = occupied.find((entry) => entry.kind === 'profile')
  const centreSize = centreItem ? collisionSize(centreItem, viewport) : { width: 0, height: 0 }
  const centre = centreItem ?? { x: 0, y: 0 }

  if (mobile && item.mobileCompact) {
    const halfWidth = itemSize.width / 2
    const halfHeight = itemSize.height / 2
    const contentTop = -viewport.height / 2 + 10 + mobileCompactHeight(viewport) + mobileContentClearance
    const minY = contentTop + halfHeight
    const maxY = viewport.height / 2 - margin - halfHeight
    const maxX = Math.max(0, viewport.width / 2 - margin - halfWidth)
    if (maxY <= minY) return clampPosition(item, viewport, { x: 0, y: minY })

    const preferred = clampPosition(item, viewport, {
      x: 0,
      y: Math.max(minY, Math.min(maxY, 0)),
    })
    const nearbyX = Math.min(maxX, itemSize.width * .72)
    const nearbyY = Math.min((maxY - minY) / 2, itemSize.height * .72)
    const nearby = [
      preferred,
      { x: preferred.x + nearbyX, y: preferred.y },
      { x: preferred.x - nearbyX, y: preferred.y },
      { x: preferred.x, y: preferred.y + nearbyY },
      { x: preferred.x, y: preferred.y - nearbyY },
      { x: preferred.x + nearbyX, y: preferred.y + nearbyY },
      { x: preferred.x - nearbyX, y: preferred.y - nearbyY },
    ].map((position) => clampPosition(item, viewport, position))
    const grid = Array.from({ length: 20 }, (_, index) => {
      const column = index % 4
      const row = Math.floor(index / 4)
      const gridX = -maxX + (maxX * 2 * column) / 3
      const gridY = minY + ((maxY - minY) * row) / 4
      return clampPosition(item, viewport, {
        x: gridX + (Math.random() - .5) * Math.min(42, maxX * .24),
        y: gridY + (Math.random() - .5) * Math.min(52, (maxY - minY) * .16),
      })
    })
    const candidates = [...nearby, ...grid]
    const obstacles = occupied.filter((entry) => entry.kind !== 'profile')
    return candidates.map((position) => {
      let overlapArea = 0
      const clearance = obstacles.length ? Math.min(...obstacles.map((other) => {
        const otherSize = collisionSize(other, viewport)
        const overlapX = (itemSize.width + otherSize.width) / 2 - Math.abs(position.x - other.x)
        const overlapY = (itemSize.height + otherSize.height) / 2 - Math.abs(position.y - other.y)
        if (overlapX > 0 && overlapY > 0) {
          overlapArea += overlapX * overlapY
          return 0
        }
        return Math.hypot(Math.max(0, -overlapX), Math.max(0, -overlapY))
      })) : 120
      const centreDistance = Math.hypot(position.x - preferred.x, position.y - preferred.y)
      const centreBias = Math.max(0, 300 - centreDistance * 1.1)
      const score = overlapArea > 0
        ? -100_000 - overlapArea
        : Math.min(40, clearance) + centreBias + Math.random() * 2
      return { position, score }
    }).sort((a, b) => b.score - a.score)[0].position
  }

  const candidates = directions
    .flatMap((direction) => {
      const horizontal = direction.x !== 0
      const itemExtent = (horizontal ? itemSize.width : itemSize.height) / 2
      const centreExtent = (horizontal ? centreSize.width : centreSize.height) / 2
      const centreAxis = horizontal ? centre.x : centre.y
      const directionSign = horizontal ? direction.x : direction.y
      const halfViewport = (horizontal ? viewport.width : viewport.height) / 2
      const maximumDistance = directionSign > 0
        ? halfViewport - margin - itemExtent - centreAxis
        : centreAxis + halfViewport - margin - itemExtent
      const minimumDistance = centreExtent + itemExtent + gap
      const availableSpace = maximumDistance - minimumDistance
      if (availableSpace < 0) return []

      const perpendicularLimit = Math.max(0, (horizontal ? viewport.height : viewport.width) / 2 - margin - (horizontal ? itemSize.height : itemSize.width) / 2)
      const firstDistance = minimumDistance + Math.min(48, availableSpace * .28)
      const distances = [firstDistance]

      return distances.map((distance) => {
        const perpendicularJitter = (Math.random() - .5) * Math.min(72, perpendicularLimit * .35)
        const position = clampPosition(item, viewport, {
          x: centre.x + direction.x * distance - direction.y * perpendicularJitter,
          y: centre.y + direction.y * distance + direction.x * perpendicularJitter,
        })
        const score = occupied.reduce((total, other) => {
          const otherSize = collisionSize(other, viewport)
          const clearanceX = Math.abs(position.x - other.x) - (itemSize.width + otherSize.width) / 2
          const clearanceY = Math.abs(position.y - other.y) - (itemSize.height + otherSize.height) / 2
          if (clearanceX < 0 && clearanceY < 0) {
            return total - 100_000 - Math.abs(clearanceX * clearanceY)
          }
          const edgeDistance = Math.hypot(Math.max(0, clearanceX), Math.max(0, clearanceY))
          return total + Math.min(edgeDistance, 320)
        }, Math.min(availableSpace, 320) * 2 - (distance - minimumDistance) * 4)
        return { position, score, availableSpace }
      })
    })

  if (!candidates.length) {
    return clampPosition(item, viewport, {
      x: centre.x,
      y: centre.y + centreSize.height / 2 + itemSize.height / 2 + gap,
    })
  }
  return candidates.sort((a, b) => b.score - a.score)[0].position
}

function creditPosition(item: SceneItem, viewport: ViewportSize) {
  const size = visualSize(item, viewport)
  const margin = usesMobileNavigation(viewport) ? 18 : 24
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

function applyMobileCollisionForces(items: SceneItem[], viewport: ViewportSize, gap: number) {
  const objects = items.filter((item) => item.kind !== 'profile')
  const movable = (item: SceneItem) => !item.fixed && !item.hovered && !item.pressed
  for (const item of objects) {
    if (movable(item)) {
      item.vx *= .68
      item.vy *= .68
    } else {
      item.vx = 0
      item.vy = 0
    }
  }

  for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
    const first = objects[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < objects.length; secondIndex += 1) {
      const second = objects[secondIndex]
      const firstCanMove = movable(first)
      const secondCanMove = movable(second)
      if (!firstCanMove && !secondCanMove) continue
      const firstSize = collisionSize(first, viewport)
      const secondSize = collisionSize(second, viewport)
      const dx = second.x - first.x
      const dy = second.y - first.y
      const requiredX = (firstSize.width + secondSize.width) / 2 + gap
      const requiredY = (firstSize.height + secondSize.height) / 2 + gap
      const overlapX = requiredX - Math.abs(dx)
      const overlapY = requiredY - Math.abs(dy)
      if (overlapX <= 0 || overlapY <= 0) continue

      const pairHash = Array.from(`${first.id}:${second.id}`).reduce((value, character) => value + character.charCodeAt(0), 0)
      const horizontalRatio = overlapX / requiredX
      const verticalRatio = overlapY / requiredY
      const exactOverlap = Math.abs(dx) < .5 && Math.abs(dy) < .5
      const useHorizontal = exactOverlap ? pairHash % 2 === 0 : horizontalRatio <= verticalRatio
      const penetration = useHorizontal ? overlapX : overlapY
      const rawDistance = useHorizontal ? dx : dy
      const direction = Math.abs(rawDistance) > .5 ? Math.sign(rawDistance) : pairHash % 4 < 2 ? 1 : -1
      const impulse = Math.min(118, 12 + penetration * 1.06)
      const firstShare = firstCanMove ? secondCanMove ? .5 : 1 : 0
      const secondShare = secondCanMove ? firstCanMove ? .5 : 1 : 0
      if (useHorizontal) {
        first.vx -= direction * impulse * firstShare
        second.vx += direction * impulse * secondShare
      } else {
        first.vy -= direction * impulse * firstShare
        second.vy += direction * impulse * secondShare
      }
    }
  }

  for (const item of objects) {
    if (!movable(item)) continue
    const velocity = clampVector(item.vx, item.vy, 360)
    const intended = { x: item.x + velocity.x * .033, y: item.y + velocity.y * .033 }
    const position = clampPosition(item, viewport, intended)
    item.x = position.x
    item.y = position.y
    item.vx = Math.abs(position.x - intended.x) > .1 ? 0 : Math.abs(velocity.x) < .35 ? 0 : velocity.x
    item.vy = Math.abs(position.y - intended.y) > .1 ? 0 : Math.abs(velocity.y) < .35 ? 0 : velocity.y
  }
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
    }
    if (item.spawned && item.kind !== 'profile' && item.kind !== 'credit') {
      const position = clampPosition(item, viewport)
      item.x = position.x
      item.y = position.y
    }
  }
  const spawned = next.filter((item) => item.spawned && item.kind !== 'credit')
  const mobileCompact = usesMobileNavigation(viewport) && spawned.some((item) => item.mobileCompact)
  const gap = mobileCompact ? 20 : usesMobileNavigation(viewport) ? 10 : 16
  if (mobileCompact) {
    applyMobileCollisionForces(spawned, viewport, gap)
    return next
  }

  for (const item of spawned) {
    if (item.fixed || item.hovered || item.pressed) continue
    const itemSize = collisionSize(item, viewport)
    let attractionX = 0
    let attractionY = 0
    let repelX = 0
    let repelY = 0
    let repelCountX = 0
    let repelCountY = 0

    for (const other of spawned) {
      if (other.id === item.id) continue
      const otherSize = collisionSize(other, viewport)
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

function hasVisiblePhysicsChange(previous: SceneItem[], next: SceneItem[]) {
  return next.some((item, index) => {
    const before = previous[index]
    return !before
      || Math.abs(item.x - before.x) > .05
      || Math.abs(item.y - before.y) > .05
      || Math.abs(item.scale - before.scale) > .002
      || Math.abs(item.expansion - before.expansion) > .002
  })
}

function createContentItem(entry: ContentConfig, mobileCompact = false): SceneItem {
  const [width, height] = contentSize(entry)
  return {
    id: entry.id, kind: 'content', content: entry, categoryId: entry.categoryId,
    spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false, attractStrength: 0,
    baseWidth: width, baseHeight: height, x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact,
  }
}

function createItems(config: PortalConfig, viewport: ViewportSize): SceneItem[] {
  const profile: SceneItem = {
    id: 'profile', kind: 'profile', spawned: true, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false, attractStrength: 1,
    baseWidth: 359, baseHeight: 259, x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: false,
  }
  Object.assign(profile, profilePosition(profile, viewport))
  const creditBase: SceneItem = {
    id: 'reference-credit', kind: 'credit', label: 'NIKUKIKAI.ART', href: 'https://nikukikai.art/',
    spawned: false, queued: false, fixed: true, hovered: false, touchExpanded: false, pressed: false, attractStrength: 0,
    baseWidth: 360, baseHeight: 54, x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: false,
  }
  const credit = { ...creditBase, ...creditPosition(creditBase, viewport) }
  const placementItems: SceneItem[] = [profile]
  const links = config.site.links.map((link, index) => {
    const item: SceneItem = {
      id: `link-${index}-${link.label}`, kind: 'link', label: link.label, href: link.href,
      spawned: false, queued: false, fixed: false, hovered: false, touchExpanded: false, pressed: false, attractStrength: 0,
      baseWidth: 64, baseHeight: 64, x: 0, y: 0, vx: 0, vy: 0,
      scale: 1, targetScale: 1, expansion: 1, targetExpansion: 1, mobileCompact: false,
    }
    const positioned = { ...item, ...popupPosition(item, viewport, placementItems) }
    placementItems.push({ ...positioned, spawned: true })
    return positioned
  })
  const content = config.content.map((entry) => createContentItem(entry))
  return [profile, ...links, credit, ...content]
}

interface ReferencePortalProps {
  config: PortalConfig
  style: CSSProperties
}

type MobileDockPhase = 'idle' | 'fade' | 'reveal' | 'return-nav' | 'return-profile'

export function ReferencePortal({ config, style }: ReferencePortalProps) {
  const initialViewport = useMemo(() => ({ width: window.innerWidth, height: window.innerHeight }), [])
  const initialItems = useMemo(() => createItems(config, initialViewport), [config, initialViewport])
  const itemsRef = useRef<SceneItem[]>(initialItems)
  const renderedItemsRef = useRef<SceneItem[]>(initialItems)
  const viewportRef = useRef<ViewportSize>(initialViewport)
  const spawnTimers = useRef<number[]>([])
  const activeCategoryRef = useRef<string | null>(null)
  const mobileDockTimers = useRef<number[]>([])
  const mobileDockingRef = useRef(false)
  const mobileReturningRef = useRef(false)
  const orientationListening = useRef(false)
  const orientationPermissionTried = useRef(false)
  const orientationBaseline = useRef<{ beta: number; gamma: number } | null>(null)
  const orientationValue = useRef({ x: 0, y: 0 })
  const pointerTimer = useRef(0)
  const lastPointerCommit = useRef(0)
  const pendingPointer = useRef<{ x: number; y: number } | null>(null)
  const [viewport, setViewport] = useState<ViewportSize>(initialViewport)
  const [items, setItems] = useState<SceneItem[]>(initialItems)
  const [mouse, setMouse] = useState({ x: initialViewport.width / 2, y: initialViewport.height / 2 })
  const [touchMode, setTouchMode] = useState(() => window.matchMedia('(hover: none), (pointer: coarse)').matches)
  const [orientationActive, setOrientationActive] = useState(false)
  const [orientationPointer, setOrientationPointer] = useState({ x: 0, y: 0 })
  const [mobileDockPhase, setMobileDockPhase] = useState<MobileDockPhase>('idle')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  const updateItems = useCallback((updater: (current: SceneItem[]) => SceneItem[]) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    renderedItemsRef.current = next
    setItems(next)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(hover: none), (pointer: coarse)')
    const update = () => setTouchMode(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return
    if (!orientationBaseline.current) {
      orientationBaseline.current = { beta: event.beta, gamma: event.gamma }
      orientationValue.current = { x: 0, y: 0 }
      setOrientationActive(true)
      setOrientationPointer({ x: 0, y: 0 })
      return
    }
    const deltaBeta = event.beta - orientationBaseline.current.beta
    const deltaGamma = event.gamma - orientationBaseline.current.gamma
    const angle = window.screen.orientation?.angle ?? 0
    const raw = angle === 90
      ? { x: deltaBeta / 22, y: -deltaGamma / 18 }
      : angle === 270
        ? { x: -deltaBeta / 22, y: deltaGamma / 18 }
        : angle === 180
          ? { x: -deltaGamma / 18, y: -deltaBeta / 22 }
          : { x: deltaGamma / 18, y: deltaBeta / 22 }
    const target = {
      x: Math.max(-1, Math.min(1, raw.x)),
      y: Math.max(-1, Math.min(1, raw.y)),
    }
    const next = {
      x: orientationValue.current.x * .82 + target.x * .18,
      y: orientationValue.current.y * .82 + target.y * .18,
    }
    orientationValue.current = next
    setOrientationActive(true)
    setOrientationPointer(next)
  }, [])

  const startOrientation = useCallback(async (mayRequestPermission: boolean) => {
    if (!touchMode || orientationListening.current || typeof DeviceOrientationEvent === 'undefined') return
    const orientationEvent = DeviceOrientationEvent as OrientationPermissionEvent
    if (typeof orientationEvent.requestPermission === 'function') {
      if (!mayRequestPermission || orientationPermissionTried.current) return
      orientationPermissionTried.current = true
      try {
        if (await orientationEvent.requestPermission() !== 'granted') return
      } catch {
        return
      }
    }
    window.addEventListener('deviceorientation', handleOrientation)
    orientationListening.current = true
  }, [handleOrientation, touchMode])

  useEffect(() => {
    if (touchMode) void startOrientation(false)
    else {
      if (orientationListening.current) window.removeEventListener('deviceorientation', handleOrientation)
      orientationListening.current = false
      orientationBaseline.current = null
      orientationValue.current = { x: 0, y: 0 }
      setOrientationActive(false)
      setOrientationPointer({ x: 0, y: 0 })
    }
    return () => {
      if (orientationListening.current) window.removeEventListener('deviceorientation', handleOrientation)
      orientationListening.current = false
    }
  }, [handleOrientation, startOrientation, touchMode])

  useEffect(() => {
    const delays = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? [0, 20, 40, 60]
      : [360, 500, 640, 820]
    const introItems = itemsRef.current.filter((item) => item.kind === 'link' || item.kind === 'credit')
    const timers = introItems.map((item, index) => window.setTimeout(() => {
      updateItems((current) => {
        const profileIsCompact = current.find((entry) => entry.kind === 'profile')?.mobileCompact
        const suppressMobileCredit = item.kind === 'credit'
          && usesMobileNavigation(viewportRef.current)
          && (mobileDockingRef.current || profileIsCompact)
        return current.map((entry) => entry.id === item.id && !suppressMobileCredit ? { ...entry, spawned: true, exiting: false } : entry)
      })
    }, delays[index] ?? delays.at(-1) ?? 0))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [updateItems])

  useEffect(() => {
    updateItems((current) => {
      const currentContent = new Map(current.filter((item) => item.kind === 'content').map((item) => [item.id, item]))
      const nonContent = current.filter((item) => item.kind !== 'content')
      const mobileCompact = current.find((item) => item.kind === 'profile')?.mobileCompact ?? false
      const content = config.content.map((entry) => {
        const existing = currentContent.get(entry.id)
        return existing
          ? { ...existing, content: entry, categoryId: entry.categoryId }
          : createContentItem(entry, mobileCompact)
      })
      return [...nonContent, ...content]
    })
  }, [config.content, updateItems])

  useEffect(() => {
    const update = () => {
      const previous = viewportRef.current
      const nextViewport = { width: window.innerWidth, height: window.innerHeight }
      orientationBaseline.current = null
      orientationValue.current = { x: 0, y: 0 }
      setOrientationPointer({ x: 0, y: 0 })
      viewportRef.current = nextViewport
      setViewport(nextViewport)
      updateItems((current) => {
        const mobileCompact = usesMobileNavigation(nextViewport)
          && current.some((item) => item.mobileCompact || (item.kind === 'content' && item.spawned))
        const projected = current.map((currentItem) => {
          const item = { ...currentItem, mobileCompact }
          if (item.kind === 'profile') return { ...item, ...profilePosition(item, nextViewport) }
          if (item.kind === 'link' || !item.spawned) return item
          if (item.kind === 'credit') return mobileCompact
            ? { ...item, spawned: false, exiting: false }
            : { ...item, spawned: true, exiting: false, ...creditPosition(item, nextViewport) }
          return {
            ...item,
            ...clampPosition(item, nextViewport, {
              x: item.x * nextViewport.width / Math.max(previous.width, 1),
              y: item.y * nextViewport.height / Math.max(previous.height, 1),
            }),
          }
        })
        const occupied = projected.filter((item) => item.kind !== 'link' && item.spawned)
        return projected.map((item) => {
          if (item.kind !== 'link') return item
          const positioned = { ...item, ...popupPosition(item, nextViewport, occupied) }
          occupied.push({ ...positioned, spawned: true })
          return positioned
        })
      })
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [updateItems])

  useEffect(() => {
    let animation = 0
    let previousTime = 0
    const frameDuration = 1000 / 30
    const tick = (time: number) => {
      if (time - previousTime >= frameDuration) {
        previousTime = time - ((time - previousTime) % frameDuration)
        const next = physicsStep(itemsRef.current, viewportRef.current)
        itemsRef.current = next
        if (hasVisiblePhysicsChange(renderedItemsRef.current, next)) {
          renderedItemsRef.current = next
          setItems(next)
        }
      }
      animation = window.requestAnimationFrame(tick)
    }
    animation = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animation)
  }, [])

  useEffect(() => () => {
    spawnTimers.current.forEach((timer) => window.clearTimeout(timer))
    mobileDockTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const resetScenePointer = useCallback(() => {
    const current = viewportRef.current
    pendingPointer.current = null
    if (pointerTimer.current) window.clearTimeout(pointerTimer.current)
    pointerTimer.current = 0
    setMouse({ x: current.width / 2, y: current.height / 2 })
  }, [])

  const moveViewport = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (touchMode) return
    pendingPointer.current = { x: event.clientX, y: event.clientY }
    if (pointerTimer.current) return
    const delay = Math.max(0, 33 - (performance.now() - lastPointerCommit.current))
    pointerTimer.current = window.setTimeout(() => {
      pointerTimer.current = 0
      lastPointerCommit.current = performance.now()
      if (pendingPointer.current) setMouse(pendingPointer.current)
    }, delay)
  }, [touchMode])

  useEffect(() => () => {
    if (pointerTimer.current) window.clearTimeout(pointerTimer.current)
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

  const activeCategoryIds = useMemo(
    () => new Set(activeCategoryId ? [activeCategoryId] : []),
    [activeCategoryId],
  )

  const spawnCategory = useCallback((category: CategoryConfig) => {
    if (mobileReturningRef.current) return
    if (activeCategoryRef.current === category.id) return
    const candidates = itemsRef.current
      .filter((item) => item.kind === 'content' && item.categoryId === category.id && !item.spawned)
      .sort(() => Math.random() - .5)
    const hasCategoryContent = itemsRef.current.some((item) => item.kind === 'content' && item.categoryId === category.id)
    if (!hasCategoryContent) return
    spawnTimers.current.forEach((timer) => window.clearTimeout(timer))
    spawnTimers.current = []
    activeCategoryRef.current = category.id
    setActiveCategoryId(category.id)
    const candidateIds = new Set(candidates.map((item) => item.id))
    const compactMobile = usesMobileNavigation(viewportRef.current)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hasVisiblePreviousCategory = itemsRef.current.some((item) => (
      item.kind === 'content'
      && item.spawned
      && item.categoryId !== category.id
    ))
    const exitDelay = hasVisiblePreviousCategory && !reducedMotion ? 240 : 0
    const firstMobileDock = compactMobile
      && !mobileDockingRef.current
      && !itemsRef.current.find((item) => item.kind === 'profile')?.mobileCompact
    const animateMobileDock = firstMobileDock && !reducedMotion
    if (animateMobileDock) {
      mobileDockingRef.current = true
      setMobileDockPhase('fade')
      const revealTimer = window.setTimeout(() => {
        updateItems((current) => current.map((currentItem) => {
          let item = { ...currentItem, mobileCompact: true }
          if (item.kind === 'profile') item = { ...item, ...profilePosition(item, viewportRef.current) }
          return item
        }))
        setMobileDockPhase('reveal')
      }, 180)
      const finishTimer = window.setTimeout(() => {
        mobileDockingRef.current = false
        setMobileDockPhase('idle')
      }, 520)
      const hideCreditTimer = window.setTimeout(() => {
        updateItems((current) => current.map((item) => item.kind === 'credit' ? { ...item, spawned: false, exiting: false } : item))
      }, 260)
      mobileDockTimers.current.push(revealTimer, hideCreditTimer, finishTimer)
    }
    updateItems((current) => {
      const compactNow = compactMobile && !mobileDockingRef.current
      return current.map((currentItem) => {
        let item = compactNow ? { ...currentItem, mobileCompact: true } : currentItem
        if (item.kind === 'profile' && compactNow) item = { ...item, ...profilePosition(item, viewportRef.current) }
        if (item.kind === 'credit' && firstMobileDock) {
          item = animateMobileDock
            ? { ...item, exiting: item.spawned }
            : { ...item, spawned: false, exiting: false }
        }
        if (item.kind !== 'content') return item
        if (item.categoryId === category.id) {
          return {
            ...item,
            exiting: false,
            queued: candidateIds.has(item.id),
            hovered: item.spawned ? item.hovered : false,
            touchExpanded: item.spawned ? item.touchExpanded : false,
            pressed: false,
            targetScale: item.spawned ? item.targetScale : 1,
            targetExpansion: item.spawned ? item.targetExpansion : 1,
          }
        }
        if (!item.spawned) return { ...item, queued: false, exiting: false }
        return {
          ...item,
          queued: false,
          exiting: true,
          hovered: false,
          touchExpanded: false,
          pressed: false,
          targetScale: 1,
          targetExpansion: 1,
          vx: 0,
          vy: 0,
        }
      })
    })

    if (hasVisiblePreviousCategory) {
      const hidePreviousTimer = window.setTimeout(() => {
        updateItems((current) => current.map((item) => {
          if (item.kind !== 'content' || item.categoryId === activeCategoryRef.current) return item
          return {
            ...item,
            spawned: false,
            queued: false,
            exiting: false,
            hovered: false,
            touchExpanded: false,
            pressed: false,
            scale: 1,
            targetScale: 1,
            expansion: 1,
            targetExpansion: 1,
            vx: 0,
            vy: 0,
          }
        }))
      }, exitDelay)
      spawnTimers.current.push(hidePreviousTimer)
    }

    const dockDelay = mobileDockingRef.current ? 430 : 0
    const appearanceDelay = Math.max(dockDelay, exitDelay)
    candidates.forEach((candidate, index) => {
      const timer = window.setTimeout(() => {
        updateItems((current) => current.map((item) => {
          if (item.id !== candidate.id) return item
          if (item.categoryId !== activeCategoryRef.current) return { ...item, queued: false }
          return {
            ...item,
            ...popupPosition(item, viewportRef.current, current),
            spawned: true,
            queued: false,
            vx: 0,
            vy: 0,
          }
        }))
      }, appearanceDelay + index * 170)
      spawnTimers.current.push(timer)
    })
  }, [updateItems])

  const returnToProfile = useCallback(() => {
    if (mobileReturningRef.current || !usesMobileNavigation(viewportRef.current)) return
    const profile = itemsRef.current.find((item) => item.kind === 'profile')
    if (!profile?.mobileCompact) return

    spawnTimers.current.forEach((timer) => window.clearTimeout(timer))
    spawnTimers.current = []
    mobileDockTimers.current.forEach((timer) => window.clearTimeout(timer))
    mobileDockTimers.current = []
    mobileReturningRef.current = true
    mobileDockingRef.current = true
    activeCategoryRef.current = null
    setActiveCategoryId(null)
    setMobileDockPhase('return-nav')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const revealDelay = reducedMotion ? 0 : 260
    const finishDelay = reducedMotion ? 20 : 820

    updateItems((current) => current.map((item) => {
      if (item.kind !== 'content') return item
      if (!item.spawned) return { ...item, queued: false, exiting: false }
      return {
        ...item,
        queued: false,
        exiting: true,
        hovered: false,
        touchExpanded: false,
        pressed: false,
        targetScale: 1,
        targetExpansion: 1,
        vx: 0,
        vy: 0,
      }
    }))

    const revealTimer = window.setTimeout(() => {
      updateItems((current) => current.map((currentItem) => {
        if (currentItem.kind === 'profile') {
          const item = { ...currentItem, mobileCompact: false }
          return { ...item, ...profilePosition(item, viewportRef.current) }
        }
        if (currentItem.kind === 'credit') {
          const item = { ...currentItem, spawned: true, exiting: false, returned: true }
          return { ...item, ...creditPosition(item, viewportRef.current) }
        }
        if (currentItem.kind !== 'content') return currentItem
        return {
          ...currentItem,
          spawned: false,
          queued: false,
          exiting: false,
          hovered: false,
          touchExpanded: false,
          pressed: false,
          scale: 1,
          targetScale: 1,
          expansion: 1,
          targetExpansion: 1,
          vx: 0,
          vy: 0,
          mobileCompact: false,
        }
      }))
      setMobileDockPhase('return-profile')
    }, revealDelay)
    const finishTimer = window.setTimeout(() => {
      mobileReturningRef.current = false
      mobileDockingRef.current = false
      setMobileDockPhase('idle')
    }, finishDelay)
    mobileDockTimers.current.push(revealTimer, finishTimer)
  }, [updateItems])

  const setHover = useCallback((id: string, hovered: boolean) => {
    updateItems((current) => current.map((item) => {
      if (item.id !== id) return item
      if (touchMode) return item
      if (item.pressed) return { ...item, hovered }
      return {
        ...item,
        hovered,
        targetScale: hovered ? interactionScale(item, viewportRef.current, config.motion.hoverScale) : 1,
        targetExpansion: interactionExpansion(item, hovered, config.motion.enabled),
      }
    }))
  }, [config.motion.enabled, config.motion.hoverScale, touchMode, updateItems])

  const setTouchPreview = useCallback((id: string | null) => {
    updateItems((current) => current.map((item) => {
      if (item.kind !== 'content') return item
      const active = item.id === id
      return {
        ...item,
        hovered: active,
        touchExpanded: active,
        pressed: false,
        targetScale: active ? interactionScale(item, viewportRef.current, config.motion.hoverScale, true) : 1,
        targetExpansion: interactionExpansion(item, active, config.motion.enabled),
      }
    }))
  }, [config.motion.enabled, config.motion.hoverScale, updateItems])

  const activateContent = useCallback((event: MouseEvent<HTMLDivElement>, item: SceneItem) => {
    if (!touchMode) {
      activateWrappedLink(event)
      return
    }
    if (!item.touchExpanded) {
      event.preventDefault()
      event.stopPropagation()
      setTouchPreview(item.id)
      return
    }
    activateWrappedLink(event)
  }, [setTouchPreview, touchMode])

  const handleViewportPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (touchMode) void startOrientation(true)
    if (!(event.target instanceof Element) || event.target.closest('.physics-item')) return
    if (touchMode && document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setTouchPreview(null)
  }, [setTouchPreview, startOrientation, touchMode])

  const pressItem = useCallback((id: string, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    resetTilt(event)
    updateItems((current) => current.map((item) => item.id === id ? {
      ...item,
      pressed: true,
      hovered: touchMode ? item.touchExpanded : true,
      vx: 0,
      vy: 0,
      targetScale: item.scale,
      targetExpansion: item.expansion,
    } : item))
  }, [touchMode, updateItems])

  const releaseItem = useCallback((id: string) => {
    window.setTimeout(() => updateItems((current) => current.map((item) => {
      if (item.id !== id) return item
      const active = touchMode ? item.touchExpanded : item.hovered
      return {
        ...item,
        pressed: false,
        hovered: active,
        targetScale: active ? interactionScale(item, viewportRef.current, config.motion.hoverScale, touchMode) : 1,
        targetExpansion: interactionExpansion(item, active, config.motion.enabled),
      }
    })), 0)
  }, [config.motion.enabled, config.motion.hoverScale, touchMode, updateItems])

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

  const centrePointer = touchMode
    ? orientationActive ? orientationPointer : { x: 0, y: 0 }
    : {
        x: (mouse.x / Math.max(viewport.width, 1) - .5) * 2,
        y: (mouse.y / Math.max(viewport.height, 1) - .5) * 2,
      }
  const gaze = {
    x: centrePointer.x * config.character.eyeFollow.maxX,
    y: centrePointer.y * config.character.eyeFollow.maxY,
  }
  const spawned = items.filter((item) => item.spawned)

  return (
    <main
      className="portal reference-portal"
      style={style}
      data-input={touchMode ? 'touch' : 'pointer'}
      data-touch-parallax={touchMode ? orientationActive ? 'gyro' : 'off' : 'pointer'}
      data-active-category={activeCategoryId ?? undefined}
      data-mobile-docking={mobileDockPhase !== 'idle' || undefined}
      data-mobile-dock-phase={mobileDockPhase !== 'idle' ? mobileDockPhase : undefined}
    >
      <div
        className="reference-viewport"
        onPointerMove={moveViewport}
        onPointerLeave={resetScenePointer}
        onPointerDown={handleViewportPointerDown}
      >
        <HalftoneBackground paper={config.theme.paper} ink={config.theme.ink} config={config.theme.halftone} />
        <div className="reference-world">
          {spawned.map((item) => {
            const responsiveScale = itemScale(item, viewport)
            const size = layoutSize(item, viewport)
            const itemWidth = size.width
            const itemHeight = size.height
            const renderedPosition = item.kind === 'credit' ? creditPosition(item, viewport) : item
            const itemStyle = {
              left: renderedPosition.x - itemWidth / 2,
              top: renderedPosition.y - itemHeight / 2,
              width: itemWidth,
              height: itemHeight,
              zIndex: item.kind === 'credit' ? 1000 : item.kind === 'profile' ? 20 : item.scale > 1.01 || item.expansion > 1.01 ? 30 : 10,
              '--item-hover-scale': item.scale,
              '--responsive-scale': 1,
              '--disc-title-font-size': `${Math.min(26, Math.max(10, 16 * responsiveScale))}px`,
              '--disc-copy-font-size': `${Math.min(16, Math.max(9, 10 * responsiveScale))}px`,
              '--popup-overshoot-scale': 1.08,
              '--popup-settle-scale': .96,
            } as CSSProperties & Record<`--${string}`, string | number | undefined>
            if (touchMode && item.kind === 'link') {
              itemStyle['--layer-far-x'] = `${Math.round(-centrePointer.x * 3)}px`
              itemStyle['--layer-far-y'] = `${Math.round(-centrePointer.y * 2)}px`
              itemStyle['--layer-near-x'] = `${Math.round(centrePointer.x * 6)}px`
              itemStyle['--layer-near-y'] = `${Math.round(centrePointer.y * 4)}px`
            }
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
              <section className="identity-panel physics-item profile-popup" data-mobile-compact={item.mobileCompact || undefined} style={profileStyle} aria-label="个人身份与分类导航" key={item.id}>
                <div className="identity-black" aria-hidden="true" />
                <h1 className="identity-name">{config.site.name}</h1>
                <div className="speech-bubble">{config.site.bubble}</div>
                <div className="character-frame"><Character config={config.character} motion={config.motion} externalGaze={config.motion.eyeFollow && config.character.eyeFollow.enabled ? gaze : { x: 0, y: 0 }} /></div>
                <div className="identity-copy">
                  <p className="sr-only">{config.site.description}</p>
                  {item.mobileCompact && (
                    <button className="mobile-return-block" type="button" onClick={returnToProfile} aria-label="返回中心导航">
                      <span aria-hidden="true">BACK</span><strong>返回</strong>
                    </button>
                  )}
                  <Navigation categories={config.categories} activeCategoryIds={activeCategoryIds} onSelect={spawnCategory} contentCounts={remainingCounts} />
                </div>
              </section>
              )
            }
            if (item.kind === 'link') return (
              <div
                className="physics-item popup-item"
                data-pressed={item.pressed || undefined}
                data-exiting={item.exiting || undefined}
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
                data-exiting={item.exiting || undefined}
                data-returned={item.returned || undefined}
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
                data-exiting={item.exiting || undefined}
                data-touch-expanded={item.touchExpanded || undefined}
                data-appearance={item.content.appearance}
                data-category-id={item.categoryId}
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
                onClick={(event) => activateContent(event, item)}
              ><CardRenderer content={item.content} /></div>
            ) : null
          })}
        </div>
      </div>
    </main>
  )
}

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { CharacterConfig } from '../config/types'

type MotionSubset = { eyeFollow: boolean }

interface CharacterProps {
  config: CharacterConfig
  motion: MotionSubset
  externalGaze?: { x: number; y: number }
  preloadSources?: string[]
}

export function Character({ config, motion, externalGaze, preloadSources = [] }: CharacterProps) {
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const preloadCache = useRef(new Map<string, HTMLImageElement>())

  const handlePointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (externalGaze || !config.eyeFollow.enabled || !motion.eyeFollow) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1))
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1))
    setGaze({ x: x * config.eyeFollow.maxX, y: y * config.eyeFollow.maxY })
  }, [config.eyeFollow, motion.eyeFollow])

  const markResolved = (key: string) => setResolved((current) => {
    if (current.has(key)) return current
    return new Set(current).add(key)
  })
  const markFailed = (key: string) => {
    setFailed((current) => new Set(current).add(key))
    markResolved(key)
  }
  const anchorPositions: Record<CharacterConfig['anchor'], string> = {
    'top-left': 'left top', center: 'center center', 'top-right': 'right top',
    'bottom-left': 'left bottom', 'bottom-right': 'right bottom',
  }
  const baseStyle = {
    '--character-scale': config.scale,
    '--character-x': `${config.x}px`,
    '--character-y': `${config.y}px`,
    '--character-fit': config.crop,
    '--character-origin': anchorPositions[config.anchor],
    '--character-position': anchorPositions[config.anchor],
  } as CSSProperties

  const layers = config.mode === 'layered' && config.layers.length
    ? config.layers
    : [{ id: 'single', src: config.singleImage, zIndex: 1, kind: 'base' as const }]
  const layerKey = (id: string, src: string) => `${id}\u0000${src}`
  const ready = layers.every((layer) => resolved.has(layerKey(layer.id, layer.src)))
  const hasBase = layers.some((layer) => layer.kind === 'base' && !failed.has(layerKey(layer.id, layer.src)))
  const preloadList = [...new Set(preloadSources.filter(Boolean))]
  const preloadSignature = preloadList.join('\n')

  useEffect(() => {
    if (!ready || !preloadList.length) return
    const timer = window.setTimeout(() => {
      for (const source of preloadList) {
        if (preloadCache.current.has(source)) continue
        const image = new Image()
        image.decoding = 'async'
        image.fetchPriority = 'low'
        image.src = source
        preloadCache.current.set(source, image)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [preloadSignature, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="character-stage" data-ready={ready || undefined} aria-busy={!ready} style={baseStyle} onPointerMove={handlePointer} onPointerLeave={() => setGaze({ x: 0, y: 0 })}>
      {ready && !hasBase && <div className="character-fallback" aria-label={config.alt}><span>?</span></div>}
      {layers.map((layer) => {
        const key = layerKey(layer.id, layer.src)
        if (failed.has(key)) return null
        const follows = layer.kind === 'eye' && layer.followPointer
        const effectiveGaze = externalGaze ?? gaze
        const transform = follows
          ? `translate(${effectiveGaze.x + (layer.offsetX ?? 0)}px, ${effectiveGaze.y + (layer.offsetY ?? 0)}px)`
          : `translate(${layer.offsetX ?? 0}px, ${layer.offsetY ?? 0}px)`
        return (
          <img
            key={layer.id}
            className={`character-layer character-layer--${layer.kind}`}
            src={layer.src}
            alt={layer.kind === 'base' ? config.alt : ''}
            aria-hidden={layer.kind !== 'base'}
            draggable={false}
            decoding="async"
            fetchPriority={layer.kind === 'base' ? 'high' : 'auto'}
            onLoad={() => markResolved(key)}
            onError={() => markFailed(key)}
            style={{ zIndex: layer.zIndex, transform }}
          />
        )
      })}
    </div>
  )
}

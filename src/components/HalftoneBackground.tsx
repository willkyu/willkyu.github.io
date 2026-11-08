import { useEffect, useRef } from 'react'
import type { PortalConfig } from '../config/types'

interface HalftoneBackgroundProps {
  paper: string
  ink: string
  config: PortalConfig['theme']['halftone']
  cameraX?: number
  cameraY?: number
}

export function HalftoneBackground({ paper, ink, config, cameraX = 0, cameraY = 0 }: HalftoneBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = () => {
      const overscan = Math.max(2, config.density)
      const width = window.innerWidth + overscan * 2
      const viewportHeight = Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      const height = Math.max(viewportHeight, 660) + overscan * 2
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.style.left = `${-overscan}px`
      canvas.style.top = `${-overscan}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = paper
      context.fillRect(0, 0, width, height)
      if (!config.enabled) return

      const step = config.density
      const centerX = width / 2
      const centerY = height / 2
      const whiteRadius = Math.max(170, Math.min(320, Math.min(width, height) * 0.31))
      const fadeRadius = 700 * (config.fadeRadius / 62)
      context.fillStyle = ink
      context.globalAlpha = config.intensity

      const fract = (value: number) => value - Math.floor(value)
      const hashCell = (cellX: number, cellY: number) => {
        let px = fract(cellX * 0.1031)
        let py = fract(cellY * 0.103)
        const dot = px * (py + 33.33) + py * (px + 33.33)
        px += dot
        py += dot
        return fract((px + py) * px)
      }

      for (let y = step / 2; y < height + step; y += step) {
        for (let x = step / 2; x < width + step; x += step) {
          const worldX = cameraX + x - centerX
          const worldY = cameraY + y - centerY
          const distance = Math.hypot(worldX, worldY)
          const t = Math.max(0, Math.min(1, (distance - whiteRadius) / fadeRadius))
          const cellX = Math.floor(worldX / step)
          const cellY = Math.floor(worldY / step)
          const dither = (hashCell(cellX, cellY) - 0.5) * 0.08
          const coverage = Math.max(0, Math.min(1, t + dither))
          const radius = step * 0.5 * 0.9 * Math.sqrt(coverage)
          if (radius <= 0.05) continue
          context.beginPath()
          context.arc(x, y, radius, 0, Math.PI * 2)
          context.fill()
        }
      }
      context.globalAlpha = 1
    }

    draw()
    window.addEventListener('resize', draw)
    window.visualViewport?.addEventListener('resize', draw)
    return () => {
      window.removeEventListener('resize', draw)
      window.visualViewport?.removeEventListener('resize', draw)
    }
  }, [cameraX, cameraY, config, ink, paper])

  return <canvas ref={canvasRef} className="halftone-canvas" aria-hidden="true" />
}

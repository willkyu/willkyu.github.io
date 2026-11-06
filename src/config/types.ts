export type CardAppearance = 'text' | 'essay' | 'browser' | 'book' | 'disc' | 'gallery'
export type SelectionMode = 'ordered' | 'random'
export type CharacterMode = 'single' | 'layered'
export type BreakpointName = 'desktop' | 'tablet' | 'mobile'
export type Anchor = 'top-left' | 'center' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface SiteConfig {
  name: string
  eyebrow: string
  title: string
  description: string
  bubble: string
  links: Array<{ label: string; href: string }>
}

export interface CharacterLayer {
  id: string
  src: string
  zIndex: number
  kind: 'base' | 'eye' | 'foreground'
  followPointer?: boolean
  offsetX?: number
  offsetY?: number
}

export interface CharacterConfig {
  mode: CharacterMode
  singleImage: string
  layers: CharacterLayer[]
  alt: string
  scale: number
  x: number
  y: number
  anchor: Anchor
  crop: 'contain' | 'cover'
  eyeFollow: { enabled: boolean; maxX: number; maxY: number }
}

export interface CategoryConfig {
  id: string
  label: string
  icon: string
  visible: boolean
  order: number
  selection: SelectionMode
  slots: string[]
  viewAllHref?: string
}

export interface ContentConfig {
  id: string
  categoryId: string
  title: string
  description: string
  cover?: string
  tags: string[]
  appearance: CardAppearance
  href: string
  order: number
  external?: boolean
  example?: boolean
  spawnAngle?: number
}

export interface ContentSourceConfig {
  source: string
  url: string
  hrefPrefix: string
}

export interface SlotPosition {
  x: number
  y: number
  width: number
  height: number
  maxContentHeight: number
  anchor: Anchor
}

export interface SlotConfig {
  id: string
  zIndex: number
  angle: number
  enterFrom: 'left' | 'right' | 'top' | 'bottom' | 'scale'
  positions: Record<BreakpointName, SlotPosition>
}

export interface PortalConfig {
  configVersion: number
  site: SiteConfig
  character: CharacterConfig
  categories: CategoryConfig[]
  content: ContentConfig[]
  contentSources?: ContentSourceConfig[]
  theme: {
    paper: string
    ink: string
    accent: string
    muted: string
    fontDisplay: string
    fontBody: string
    lineWidth: number
    shadowOffset: number
    radius: number
    halftone: { enabled: boolean; density: number; intensity: number; fadeRadius: number }
  }
  layout: {
    mode: 'reference-physics' | 'fixed-slots'
    referenceWidth: number
    referenceHeight: number
    breakpoints: { tablet: number; mobile: number }
    slots: SlotConfig[]
  }
  motion: {
    enabled: boolean
    duration: number
    fastDuration: number
    easing: string
    hoverScale: number
    hoverTilt: number
    pressScale: number
    enterDistance: number
    eyeFollow: boolean
  }
}

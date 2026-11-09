import { useEffect, useState, type PointerEvent } from 'react'
import type { ContentConfig } from '../config/types'

interface CardRendererProps {
  content: ContentConfig
}

function linkProps(content: ContentConfig) {
  return {
    href: content.href,
    target: content.external ? '_blank' : undefined,
    rel: content.external ? 'noreferrer' : undefined,
    'aria-label': `打开 ${content.title}`,
    draggable: false,
    onPointerDown: (event: PointerEvent<HTMLAnchorElement>) => {
      if (event.button === 0 && event.isPrimary) event.currentTarget.setPointerCapture(event.pointerId)
    },
  }
}

function DiscCard({ content }: CardRendererProps) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error' | 'empty'>(content.cover ? 'loading' : 'empty')

  useEffect(() => setImageState(content.cover ? 'loading' : 'empty'), [content.cover])

  return (
    <a className="card card--disc" {...linkProps(content)}>
      <div className="disc-art" data-state={imageState}>
        <div className="disc-placeholder" aria-hidden="true">
          <span>{imageState === 'error' ? 'IMAGE 404' : imageState === 'empty' ? 'NO COVER' : 'LOADING COVER'}</span>
          <small>{content.title}</small>
        </div>
        {content.cover && <img className="disc-image disc-image--shadow" src={content.cover} alt="" />}
        {content.cover && <img
          className="disc-image"
          src={content.cover}
          alt=""
          decoding="async"
          ref={(image) => {
            if (image?.complete) setImageState(image.naturalWidth > 0 ? 'loaded' : 'error')
          }}
          onLoad={() => setImageState('loaded')}
          onError={() => setImageState('error')}
        />}
      </div>
      <div className="disc-spine"><strong>{content.title}</strong><span>{content.description}</span></div>
    </a>
  )
}

export function CardRenderer({ content }: CardRendererProps) {
  if (content.appearance === 'essay') {
    const paragraphs = content.description.split(/\r?\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
    return (
      <a className="card card--essay" {...linkProps(content)}>
        <h3>{content.title}</h3>
        {paragraphs[0] && <p className="essay-preview" aria-hidden="true">{paragraphs[0]}</p>}
        <div className="essay-copy">
          {paragraphs.map((paragraph, index) => <p key={`${index}:${paragraph}`}>{paragraph}</p>)}
        </div>
        <div className="essay-fade" aria-hidden="true"><span>・・・</span></div>
      </a>
    )
  }

  if (content.appearance === 'browser') {
    return (
      <a className="card card--browser" {...linkProps(content)}>
        <div className="browser-bar" aria-hidden="true"><i /><i /><i /><span>{content.href}</span></div>
        <div className="browser-screen">
          {content.cover && <img src={content.cover} alt="" />}
          <div className="browser-overlay"><h3>{content.title}</h3><p>{content.description}</p></div>
        </div>
      </a>
    )
  }

  if (content.appearance === 'book') {
    return (
      <a className="card card--book" {...linkProps(content)}>
        <div className="book-rings" aria-hidden="true" />
        {content.cover && <img src={content.cover} alt="" />}
        <div className="book-spine"><strong>{content.title}</strong><span>{content.description}</span></div>
      </a>
    )
  }

  if (content.appearance === 'disc') {
    return <DiscCard content={content} />
  }

  if (content.appearance === 'gallery') {
    return (
      <a className="card card--gallery" {...linkProps(content)}>
        <div className="gallery-stage" aria-hidden="true">
          <div className="gallery-plane gallery-plane--back">{content.cover && <img src={content.cover} alt="" />}</div>
          <div className="gallery-plane gallery-plane--middle">{content.cover && <img src={content.cover} alt="" />}</div>
          <div className="gallery-plane gallery-plane--front">
            {content.cover && <img src={content.cover} alt="" />}
            <span className="gallery-mat" />
          </div>
        </div>
        <div className="gallery-placard">
          <h3>{content.title}</h3>
          <small>{content.tags.join(' / ')}</small>
          <p>{content.description}</p>
        </div>
      </a>
    )
  }

  return (
    <a className="card card--text" {...linkProps(content)}>
      <h3>{content.title}</h3>
      <p>{content.description}</p>
    </a>
  )
}

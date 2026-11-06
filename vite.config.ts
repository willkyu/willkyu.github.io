import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const feedTargets = new Map([
  ['/blog/homepage-feed.json', 'https://willkyu.github.io/blog/homepage-feed.json'],
  ['/research/homepage-feed.json', 'https://willkyu.github.io/research/homepage-feed.json'],
])

const retryDelay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function homepageFeedDevProxy(): Plugin {
  const cache = new Map<string, { body: string; expiresAt: number }>()
  const pending = new Map<string, Promise<string>>()

  const download = async (target: string) => {
    const cached = cache.get(target)
    if (cached && cached.expiresAt > Date.now()) return cached.body
    const existing = pending.get(target)
    if (existing) return existing

    const request = (async () => {
      let failure: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(target, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5_000),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const body = await response.text()
          JSON.parse(body)
          cache.set(target, { body, expiresAt: Date.now() + 30_000 })
          return body
        } catch (error) {
          failure = error
          if (attempt === 0) await retryDelay(120)
        }
      }
      throw failure
    })().finally(() => pending.delete(target))

    pending.set(target, request)
    return request
  }

  return {
    name: 'homepage-feed-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split(/[?#]/, 1)[0] ?? ''
        const target = feedTargets.get(pathname)
        if (!target || !['GET', 'HEAD'].includes(request.method ?? 'GET')) {
          next()
          return
        }

        try {
          const body = await download(target)
          response.statusCode = 200
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.setHeader('cache-control', 'no-store')
          response.end(request.method === 'HEAD' ? undefined : body)
        } catch (error) {
          server.config.logger.error(`homepage feed dev proxy failed for ${pathname}: ${error instanceof Error ? error.message : String(error)}`)
          response.statusCode = 502
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: 'homepage feed is temporarily unavailable' }))
        }
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), homepageFeedDevProxy()],
  // Feed 中的 cover 使用部署后的站内绝对路径。开发环境没有 /blog 和
  // /research 的静态文件，因此把封面资源交给对应的 GitHub Pages 站点。
  server: {
    proxy: {
      '/blog/assets': {
        target: 'https://willkyu.github.io',
        changeOrigin: true,
      },
      '/research/assets': {
        target: 'https://willkyu.github.io',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: true },
})

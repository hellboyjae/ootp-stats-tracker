import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import http from 'http'

const ROUTES = [
  '/',
  '/stats',
  '/info',
  '/videos',
  '/articles',
  '/submit',
  '/draft-assistant',
  '/re-viewer',
  '/database',
  '/pack-simulator',
  '/pt-live',
  '/live-spec',
]

function prerenderPlugin() {
  let outDir

  return {
    name: 'vite:prerender',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.join(config.root, config.build.outDir)
    },
    async closeBundle() {
      const chromium = await import('@sparticuz/chromium')
      const puppeteer = await import('puppeteer-core')

      console.log(`\n[prerender] Starting static server...`)

      // Save original index.html (before any prerender writes)
      const originalIndex = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')

      // Simple static server with SPA fallback
      const server = http.createServer((req, res) => {
        let filePath = path.join(outDir, req.url === '/' ? '/index.html' : req.url)

        // If no file extension, serve original index.html (SPA fallback)
        if (!path.extname(filePath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(originalIndex)
          return
        }

        try {
          const content = fs.readFileSync(filePath)
          const ext = path.extname(filePath)
          const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.webp': 'image/webp',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
          }
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
          res.end(content)
        } catch {
          res.writeHead(404)
          res.end('Not found')
        }
      })

      const port = await new Promise((resolve) => {
        server.listen(0, () => resolve(server.address().port))
      })

      console.log(`[prerender] Static server on port ${port}`)
      console.log(`[prerender] Prerendering ${ROUTES.length} routes...`)

      const browser = await puppeteer.default.launch({
        args: chromium.default.args,
        executablePath: await chromium.default.executablePath(),
        headless: 'shell',
      })
      const results = []

      try {
        for (const route of ROUTES) {
          const page = await browser.newPage()

          page.on('pageerror', err => {
            // Only log non-hydration errors
            if (!err.message.includes('Minified React error')) {
              console.error(`[prerender][${route}] ${err.message}`)
            }
          })

          await page.goto(`http://localhost:${port}${route}`, {
            waitUntil: 'networkidle0',
            timeout: 30000,
          })

          // Wait for React to render into #root
          await page.waitForFunction(
            () => document.getElementById('root')?.children.length > 0,
            { timeout: 10000 }
          )

          const html = await page.content()
          await page.close()
          results.push({ route, html })
          console.log(`[prerender] Captured: ${route}`)
        }

        // Write all files after capturing
        for (const { route, html } of results) {
          const filePath = route === '/'
            ? path.join(outDir, 'index.html')
            : path.join(outDir, route, 'index.html')
          const dir = path.dirname(filePath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(filePath, html)
        }

        console.log(`[prerender] Written ${results.length} files`)
        console.log('[prerender] All routes prerendered successfully!')
      } catch (err) {
        console.error('[prerender] Failed:', err)
        throw err
      } finally {
        await browser.close()
        server.close()
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), prerenderPlugin()],
})

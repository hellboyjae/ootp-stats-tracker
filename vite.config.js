import { defineConfig, build as viteBuild } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
      console.log('\n[prerender] Building SSR bundle...')

      const ssrOutDir = path.join(outDir, '.ssr')

      // Build the SSR bundle from entry-server.jsx
      await viteBuild({
        configFile: false,
        plugins: [react()],
        build: {
          ssr: true,
          rollupOptions: { input: path.join(__dirname, 'src', 'entry-server.jsx') },
          outDir: ssrOutDir,
        },
      })

      // Load the SSR bundle
      const { render } = await import(path.join(ssrOutDir, 'entry-server.js'))

      // Read the HTML template
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')

      console.log(`[prerender] Rendering ${ROUTES.length} routes...`)

      for (const route of ROUTES) {
        try {
          const appHtml = render(route)
          const page = template.replace(
            '<div id="root"></div>',
            `<div id="root">${appHtml}</div>`
          )

          const filePath = route === '/'
            ? path.join(outDir, 'index.html')
            : path.join(outDir, route, 'index.html')
          const dir = path.dirname(filePath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(filePath, page)
          console.log(`[prerender] Written: ${route}`)
        } catch (err) {
          console.error(`[prerender] Failed to render ${route}:`, err.message)
        }
      }

      // Clean up SSR bundle
      fs.rmSync(ssrOutDir, { recursive: true, force: true })
      console.log('[prerender] All routes prerendered successfully!')
    },
  }
}

export default defineConfig({
  plugins: [react(), prerenderPlugin()],
})

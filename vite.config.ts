import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Extra hostnames the dev and preview servers will answer to.
 *
 * Vite refuses unrecognised Host headers, which blocks reaching the dev server
 * from another machine by name. Set ALMANAK_ALLOWED_HOSTS to a comma-separated
 * list when serving over a private network such as a Tailscale tailnet.
 *
 * The server only ever hands out static files. No archive is stored on it: an
 * archive is read by whichever browser opens it, from that device's own disk.
 */
const extraHosts = (process.env.ALMANAK_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

export default defineConfig({
  /*
    The app lives under /app/ so the landing page can own the root and embed it
    in an iframe from the same origin — one deploy, no CORS, and the demo in the
    hero is the real thing rather than a video of it.

    Paths are relative rather than rooted at /app/, so the same build works
    whether it is served from a domain root or from a subdirectory. GitHub
    Pages project sites are served from /<repo>/, and absolute paths would
    resolve above it and 404.
  */
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: { target: 'es2022', outDir: 'dist/app', emptyOutDir: true },
  server: {
    host: true,
    allowedHosts: extraHosts,
  },
  preview: {
    host: true,
    port: 4190,
    allowedHosts: extraHosts,
  },
})

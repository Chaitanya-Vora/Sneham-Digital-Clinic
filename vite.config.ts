import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

// Stamped into the app so anyone can see exactly which build a phone is running.
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
let sha = 'dev'
let buildNumber = 0
try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* not a git checkout */ }
// Counts up with every commit. Live updates use it so an older update can
// never replace newer code (a freshly installed APK always outranks old bundles).
try { buildNumber = parseInt(execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10) || 0 } catch { /* not a git checkout */ }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify({ version: pkg.version, sha, date: new Date().toISOString().slice(0, 10), number: buildNumber }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5178,
    host: true,
  },
})

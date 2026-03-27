import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Auto-regenera src/data/devStats.js (SLOC, archivos) en cada build/dev start
function devStatsPlugin() {
  return {
    name: 'dev-stats',
    buildStart() {
      try {
        execSync('bash scripts/update-dev-stats.sh', { stdio: 'ignore' })
      } catch (_) { /* skip if git unavailable */ }
    },
  }
}

export default defineConfig({
  plugins: [react(), devStatsPlugin()],
})

import { defineConfig } from '@playwright/test'

// Walks the practice round (the tutorial) in a phone-sized browser. Reuses a dev server that is already running.
export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results/artifacts',
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', viewport: { width: 390, height: 844 } },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// the site is served from samstauffer.net/808s/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/808s/' : '/',
  plugins: [svelte()],
}))

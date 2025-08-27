import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use BASE_PATH from env (set by GitHub Actions) or '/' locally
const basePath = process.env.BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
})

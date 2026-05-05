import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  test: {
    testTimeout: 15000,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})

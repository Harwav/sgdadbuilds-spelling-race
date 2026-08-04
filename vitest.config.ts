import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    // Mirror tsconfig.json "@/*" path alias so lib tests can use @/ imports.
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.{ts,tsx}'],
  },
})

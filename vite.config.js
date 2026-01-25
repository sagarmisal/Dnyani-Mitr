import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  base: './', // CRITICAL: Makes paths relative for file:// protocol
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // No manualChunks needed as singleFile inlines everything
  },
  server: {
    port: 3000,
    open: true
  }
})

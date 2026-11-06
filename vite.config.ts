/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'

// Sürüm numarası package.json'dan derlemeye gömülür (başlıkta görünür)
const APP_VERSION: string = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8')).version

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // Program tek HTML dosyası olarak (file://) açılır; göreli yollar gerekir.
  base: './',
  server: {
    watch: { ignored: ['**/release/**', '**/dist/**'] },
  },
  build: {
    // scripts/build-web.cjs tek dosyaya gömer: tek JS ve tek CSS parçası olsun
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 2500,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
})

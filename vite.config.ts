import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      exclude: ['e2e/**/*', '**/*.spec.ts', '**/*.test.ts', 'vite.config.ts', 'vite.css.config.ts', 'katex/*'],
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Exclude e2e directory from build
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      fileName: () => 'index.js',
      formats: ['es']
    },
    rollupOptions: {
      external: [/^react/, /^@?react-dom/],
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    // Exclude e2e and other unnecessary directories from build
    outDir: 'dist',
    emptyOutDir: true,
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
})

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@jupyter-kit/core',
  },
  resolve: {
    // Self-import: tsc paths config maps these for type checks, but vitest
    // resolves at runtime via Vite — alias it here so esbuild's auto-injected
    // `import { jsxDEV } from '@jupyter-kit/core/jsx-dev-runtime'` resolves
    // to the local source files (we're inside the @jupyter-kit/core package).
    alias: {
      '@jupyter-kit/core/jsx-runtime': here('./src/jsx-runtime.ts'),
      '@jupyter-kit/core/jsx-dev-runtime': here('./src/jsx-dev-runtime.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});

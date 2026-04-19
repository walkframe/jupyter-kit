import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  external: [
    '@jupyter-kit/core',
    '@jupyter-kit/comm',
    '@jupyter-widgets/base',
    '@jupyter-widgets/controls',
    '@jupyter-widgets/html-manager',
    '@jupyter-widgets/output',
  ],
  loader: { '.css': 'empty' },
});

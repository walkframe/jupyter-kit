import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/jsx-runtime.ts',
    'src/jsx-dev-runtime.ts',
    'src/langs/python.ts',
    'src/langs/javascript.ts',
    'src/langs/r.ts',
    'src/langs/julia.ts',
    'src/langs/haskell.ts',
    'src/langs/ruby.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  minify: true,
  splitting: false,
});

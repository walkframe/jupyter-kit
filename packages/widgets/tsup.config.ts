import { defineConfig } from 'tsup';

export default defineConfig({
  // jquery-shim and jquery-ui-shim are separate entries so each becomes
  // its own JS module file in dist/. ES module post-order then enforces:
  //   jquery-shim runs (sets globalThis.jQuery) → jquery-ui-shim runs
  //   (imports jquery-ui, which mutates window.$.ui) → html-manager runs
  //   (controls/slider sees $.ui.mouse).
  // Collapsing into a single file would let the JS engine hoist all the
  // imports together, defeating the ordering.
  entry: [
    'src/index.ts',
    'src/runtime.ts',
    'src/jquery-shim.ts',
    'src/jquery-ui-shim.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  // @jupyter-widgets/* and friends stay external — bundling them in
  // surfaces esbuild's __require/__commonJS shims into the published dist,
  // and those break in some browser scenarios (Proxy traps trip on init,
  // Node-only branches throw). Downstream bundlers (Vite/webpack) handle
  // the upstream CJS-flavoured ESM without our intervention; we only need
  // to document the one Vite-specific config tweak (commonjsOptions).
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

import { defineConfig } from 'tsup';

export default defineConfig({
  // jquery-shim is a separate entry (rather than inlined into runtime.ts)
  // so the consuming JS engine evaluates it as its own module — ES module
  // post-order then guarantees `globalThis.jQuery = ...` completes before
  // any html-manager import body (and the jquery-ui graph it pulls)
  // begins evaluating. Inlining loses that ordering because all `import`s
  // within a single file hoist above the body.
  entry: ['src/index.ts', 'src/runtime.ts', 'src/jquery-shim.ts'],
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

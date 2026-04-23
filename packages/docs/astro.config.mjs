import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  integrations: [
    starlight({
      title: '@jupyter-kit',
      description: 'Framework-agnostic Jupyter notebook renderer for the browser.',
      logo: {
        src: './src/assets/logo.svg',
      },
      favicon: '/favicon.svg',
      social: {
        github: 'https://github.com/walkframe/jupyter-kit',
      },
      // `sanitize-html` (pulled transitively by @jupyter-widgets/html-manager)
      // touches `postcss` → `source-map-js` / Node `path` / `url`, which Vite
      // dev-mode stubs for the browser. The stubs run fine at runtime but
      // Vite's `console.warn` fires per access. Filter those out of the dev
      // console — production builds don't emit them so this is a no-op there.
      head: [
        // Google Tag Manager — container GTM-MV78VXS5. Loads gtm.js in the
        // background; per-page tracking is then wired up in GTM itself.
        {
          tag: 'script',
          content: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MV78VXS5');`,
        },
        {
          tag: 'script',
          content: `(() => {
  const orig = console.warn;
  console.warn = function (...args) {
    if (typeof args[0] === 'string' && args[0].includes('has been externalized for browser compatibility')) return;
    orig.apply(console, args);
  };
})();`,
        },
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', slug: 'index' },
            { label: 'Getting started', slug: 'getting-started' },
            { label: 'Install wizard', slug: 'install-wizard' },
          ],
        },
        {
          label: 'Live demos',
          items: [
            { label: 'Theme switcher', slug: 'demos/themes' },
            { label: 'Run Python in-browser', slug: 'demos/pyodide' },
            { label: 'Run R + plots in-browser', slug: 'demos/webr' },
            { label: 'Try in StackBlitz', slug: 'demos/stackblitz' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Overview', slug: 'reference' },
            { label: '@jupyter-kit/core', slug: 'reference/core' },
            { label: '@jupyter-kit/react', slug: 'reference/react' },
            { label: '@jupyter-kit/vue', slug: 'reference/vue' },
            { label: '@jupyter-kit/svelte', slug: 'reference/svelte' },
            { label: '@jupyter-kit/wc', slug: 'reference/wc' },
            { label: '@jupyter-kit/editor-codemirror', slug: 'reference/editor-codemirror' },
            { label: '@jupyter-kit/executor-pyodide', slug: 'reference/executor-pyodide' },
            { label: '@jupyter-kit/executor-webr', slug: 'reference/executor-webr' },
            { label: '@jupyter-kit/executor-jupyter', slug: 'reference/executor-jupyter' },
            { label: '@jupyter-kit/widgets', slug: 'reference/widgets' },
            { label: '@jupyter-kit/comm', slug: 'reference/comm' },
            { label: 'Math plugins', slug: 'reference/math-plugins' },
            { label: 'Themes', slug: 'reference/themes' },
            { label: 'Security model', slug: 'reference/security' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Architecture', slug: 'development/architecture' },
            { label: 'Contributing', slug: 'development/contributing' },
            { label: 'Versioning', slug: 'development/versioning' },
          ],
        },
        {
          label: 'History',
          items: [
            { label: 'v3 — @jupyter-kit', slug: 'history/v3' },
            { label: 'v2 — react-ipynb-renderer', slug: 'history/v2' },
            { label: 'v1 — react-ipynb-renderer', slug: 'history/v1' },
            { label: 'Migration guide', slug: 'history/migration-guide' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
    react(),
  ],
  vite: {
    // pnpm hoists `@jupyter-kit/react`'s own devDep copy of React/ReactDOM
    // into a separate store path. Without dedupe Vite loads two React
    // instances — the hooks dispatcher is null on the "wrong" copy and any
    // useState call throws "Cannot read properties of null".
    resolve: {
      dedupe: ['react', 'react-dom'],
      // Rewrite the published per-chrome theme paths
      //   `@jupyter-kit/theme-<name>/<name>.css`
      //   `@jupyter-kit/theme-<name>/syntax/<syntax>.css`
      // to the workspace's single theme package so `docs` / `storybook`
      // source uses the same import strings users will paste into their
      // own projects. Keeps the `?inline` query suffix intact.
      alias: [
        {
          find: /^@jupyter-kit\/theme-([^/]+)\/\1\.css(\?.*)?$/,
          replacement: '@jupyter-kit/theme/chrome/$1.css$2',
        },
        {
          find: /^@jupyter-kit\/theme-[^/]+\/syntax\/(.+)$/,
          replacement: '@jupyter-kit/theme/syntax/$1',
        },
      ],
    },
    // Pyodide / WebR demos pull their runtimes from CDNs at runtime — these
    // packages publish ESM with heavy top-level side-effects. Exclude them
    // from optimizeDeps so Vite doesn't try to prebundle the Workers.
    optimizeDeps: {
      exclude: ['pyodide', 'webr'],
    },
    // @jupyter-widgets/* ship as CJS-style `.js` imports without file
    // extensions (pre-ESM Node resolution). Force Vite to bundle them during
    // SSR so the MDX that references <PyodideDemo client:only="react"> can
    // resolve the module graph without hitting "Cannot find module" errors.
    ssr: {
      noExternal: [
        '@jupyter-widgets/base',
        '@jupyter-widgets/base-manager',
        '@jupyter-widgets/controls',
        '@jupyter-widgets/html-manager',
        '@jupyter-widgets/output',
      ],
    },
    // @jupyter-widgets/* were bundled with webpack and reference
    // `__webpack_public_path__` at runtime for chunk loading. Vite has no
    // such global — replace with an empty string so the reference doesn't
    // throw ReferenceError when html-manager loads.
    define: {
      __webpack_public_path__: '""',
    },
    build: {
      commonjsOptions: {
        // @jupyter-widgets/* (and some of their @jupyterlab transitives) ship
        // ESM modules that still call `require()` at runtime — Rollup leaves
        // those untouched by default, which surfaces in production as
        // `ReferenceError: require is not defined`. transformMixedEsModules
        // lets the CommonJS plugin rewrite those `require` calls into static
        // imports at build time.
        transformMixedEsModules: true,
      },
    },
  },
});

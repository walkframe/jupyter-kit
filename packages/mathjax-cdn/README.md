# `@jupyter-kit/mathjax-cdn`

MathJax loaded from a CDN at runtime. Tiny bundle (~1KB gz); the actual
MathJax SVG renderer (~600KB) is fetched from jsdelivr the first time a math
cell renders.

## Install

```sh
pnpm add @jupyter-kit/mathjax-cdn @jupyter-kit/core
```

## Usage

```ts
import { createMathjaxCdnPlugin } from '@jupyter-kit/mathjax-cdn';

createRenderer({
  plugins: [createMathjaxCdnPlugin()],
});
```

## How it works

- `remark-math` tokenises `$...$` early so markdown escape processing can't
  mangle the LaTeX source.
- A small rehype plugin re-wraps math nodes back into bare `$…$` text so
  MathJax's auto-render finds them.
- The CDN script (`mathjax@3/es5/tex-svg.js`) is injected once into
  `document.head`; subsequent cells reuse it via `MathJax.typesetPromise`.

## Options

```ts
createMathjaxCdnPlugin({
  src: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js', // default
  config: { /* full window.MathJax config (overrides our defaults) */ },
  forceReload: false,
});
```

## License

Apache-2.0. MathJax itself is Apache-2.0 and lives on the CDN; this package
just orchestrates loading.

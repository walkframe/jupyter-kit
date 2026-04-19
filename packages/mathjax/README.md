# `@jupyter-kit/mathjax`

Bundled MathJax SVG renderer for `@jupyter-kit/core`. Adds `remark-math` +
`rehype-mathjax/svg` to the markdown pipeline; math is converted to inline
SVG during the unified pass — no external script tag, no DOM-time work.

## Install

```sh
pnpm add @jupyter-kit/mathjax @jupyter-kit/core
```

## Usage

```ts
import { createMathjaxPlugin } from '@jupyter-kit/mathjax';

createRenderer({
  plugins: [createMathjaxPlugin()],
});
```

## Trade-off vs `@jupyter-kit/mathjax-cdn`

| | bundled (this) | `mathjax-cdn` |
|---|---|---|
| Bundle size | **~610KB gz** (full MathJax + fonts) | ~0.5KB gz (script loader) |
| First paint | instant | waits for CDN download |
| Offline | ✓ | ✗ |
| SSR-friendly | ✓ (renders to SVG strings) | ✗ (client-side typeset) |

Pick bundled if you ship to environments without internet, need SSR, or want
deterministic output. Otherwise the CDN variant is much lighter.

## Options

```ts
createMathjaxPlugin({
  remarkMathOptions: { /* remark-math options */ },
  mathjaxOptions:    { /* rehype-mathjax options */ },
});
```

## License

Apache-2.0.

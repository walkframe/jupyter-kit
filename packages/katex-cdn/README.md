# `@jupyter-kit/katex-cdn`

KaTeX loaded from a CDN at runtime. Tiny bundle (~1KB gz); KaTeX core
(~88KB) plus its stylesheet is fetched from jsdelivr on first use.

## Install

```sh
pnpm add @jupyter-kit/katex-cdn @jupyter-kit/core
```

## Usage

```ts
import { createKatexCdnPlugin } from '@jupyter-kit/katex-cdn';

createRenderer({
  plugins: [createKatexCdnPlugin()],
});
```

The plugin injects `katex.min.css`, `katex.min.js`, and
`contrib/auto-render.min.js` into `document.head` on first use, then calls
`renderMathInElement` for every markdown cell.

## How it works

- `remark-math` tokenises `$...$` early so markdown escapes survive.
- A small rehype plugin re-emits `$…$` / `$$…$$` text so KaTeX auto-render
  finds the delimiters.

## Options

```ts
createKatexCdnPlugin({
  version: '0.16.22',                   // CDN version pin
  baseUrl: 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist',
  delimiters: [...],                     // override default $ / $$ / \( / \[
  rendererOptions: { /* renderMathInElement opts */ },
});
```

## License

Apache-2.0. KaTeX itself is MIT and served from the CDN.

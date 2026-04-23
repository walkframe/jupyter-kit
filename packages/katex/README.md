# `@jupyter-kit/katex`

Bundled KaTeX renderer for `@jupyter-kit/core`. Adds `remark-math` +
`rehype-katex` to the markdown pipeline; math is converted to HTML+MathML
during the unified pass.

## Install

```sh
pnpm add @jupyter-kit/katex @jupyter-kit/core katex
```

You also need to include KaTeX's stylesheet once in your app:

```ts
import 'katex/dist/katex.min.css';
```

## Usage

```ts
import { createKatexPlugin } from '@jupyter-kit/katex';

createRenderer({
  plugins: [createKatexPlugin()],
});
```

## Trade-off vs `@jupyter-kit/katex-cdn`

| | bundled (this) | `katex-cdn` |
|---|---|---|
| Bundle size | ~88KB gz | ~1KB gz |
| First paint | instant | waits for CDN |
| Offline | ✓ | ✗ |
| SSR-friendly | ✓ | ✗ |

KaTeX is lighter than MathJax bundled, so this is often the sweet spot. Use
the CDN variant if you absolutely need the smallest possible client bundle.

## Pre-processing

`\begin{eqnarray}…\end{eqnarray}` (which KaTeX doesn't support) is rewritten
to `\begin{aligned}…\end{aligned}` before parsing.

## Options

```ts
createKatexPlugin({
  remarkMathOptions: { /* … */ },
  katexOptions:      { /* KaTeX options */ },
});
```

## License

Apache-2.0.

# `@jupyter-kit/executor-webr`

In-browser R executor for `@jupyter-kit/core`. Wraps
[WebR](https://docs.r-wasm.org/webr/) (`webr` on npm) which runs the R
interpreter compiled to WebAssembly inside its own dedicated worker.

> ## ⚠️ License caveat — this package is GPL
>
> R itself is licensed under **GPL-2.0-or-later**. The `webr` npm package
> bundles R, so it inherits GPL. Because this wrapper imports `webr` at
> runtime, it is also distributed under **GPL-2.0-or-later**.
>
> If you ship an app that uses `@jupyter-kit/executor-webr`, your
> distribution as a whole must comply with GPL — typically that means
> **publishing your application's source under a GPL-compatible licence**
> when you distribute the binary/bundle.
>
> The other packages in this monorepo (`core`, `react`, `theme`, `syntax`,
> `mathjax`, `mathjax-cdn`, `katex`, `katex-cdn`, `editor-codemirror`,
> `executor-pyodide`) remain Apache-2.0 — they don't link against R, so
> they're unaffected.
>
> If you're not OK with GPL, swap this package out for a server-side R
> executor (HTTP/WebSocket bridge to a hosted Rserve) and keep your client
> Apache-2.0.

## Install

```sh
pnpm add @jupyter-kit/executor-webr @jupyter-kit/core
```

## Usage

```ts
import { createWebRExecutor } from '@jupyter-kit/executor-webr';
import { r as rHighlight } from '@jupyter-kit/core/langs/r';
import { StreamLanguage } from '@codemirror/language';
import { r as rEditor } from '@codemirror/legacy-modes/mode/r';

const executor = createWebRExecutor({
  packages: ['ggplot2'],   // optional: install on boot
  onStatus: (s) => console.log('webr:', s),
});

createRenderer({
  language: 'r',
  languages: [rHighlight],
  executor,
  plugins: [createEditorPlugin({ languages: { r: StreamLanguage.define(rEditor) } })],
});
```

## What you get

- **stdout / stderr** captured per cell.
- **Last-evaluated value** as `text/plain` (R's `print()` output).
- **Errors** with R's `conditionMessage` as the traceback.
- Persistent R session across cells (variables retained).

## Options

| Option | Default | Notes |
|---|---|---|
| `baseURL` | `https://webr.r-wasm.org/latest/` | WASM / worker assets prefix |
| `packages` | `[]` | R packages to `install` on boot |
| `onStatus` | — | `'idle'` / `'loading'` / `'installing'` / `'running'` / `'ready'` / `'error'` |

## Bundle size

~1.5KB gz for the wrapper. WebR itself (~30MB including R + base packages)
is fetched lazily from `baseURL` on first execution.

## License

[GPL-2.0-or-later](./LICENSE) — see warning above.

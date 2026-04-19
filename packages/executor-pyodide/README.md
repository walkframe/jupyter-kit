# `@jupyter-kit/executor-pyodide`

In-browser Python executor for `@jupyter-kit/core`. Pyodide runs in a
dedicated Web Worker so the main thread stays responsive during execution.

## Install

```sh
pnpm add @jupyter-kit/executor-pyodide @jupyter-kit/core
```

## Usage

```ts
import { createPyodideExecutor } from '@jupyter-kit/executor-pyodide';

const executor = createPyodideExecutor({
  packages: ['numpy', 'pandas'],   // preload
  autoloadImports: true,           // auto-install from `import` statements
  figureFormats: ['svg'],          // matplotlib output formats
  onStatus: (s) => console.log('pyodide:', s),
});

createRenderer({
  executor,
  plugins: [createEditorPlugin({...})],
});
```

## What you get

- **stdout / stderr** captured and streamed as Jupyter `stream` outputs.
- **Last-expression value** rendered via IPython-style `_repr_*_` methods
  (`_repr_html_`, `_repr_latex_`, `_repr_png_`, `_repr_svg_`, `_repr_markdown_`,
  `_repr_json_`). Pandas DataFrames, sympy matrices, etc. work out of the box.
- **matplotlib figures** auto-captured at end of cell as `display_data`
  (SVG by default; configurable via `figureFormats: ['svg' | 'png']`).
- **Errors** with IPython-style ANSI-coloured tracebacks (helper frames
  filtered out).
- **IPython magics** (`%matplotlib`, `%autosave`, `!pip ...`) are commented
  out before execution rather than raising SyntaxError.
- **Sympy tuples / lists** render as combined LaTeX when `sympy` is loaded.

## Options

| Option | Default | Notes |
|---|---|---|
| `src` | jsdelivr full build | URL of `pyodide.js` |
| `indexURL` | derived from `src` | Directory for `.wasm` / `.whl` |
| `version` | `'0.26.2'` | Pyodide version pin |
| `packages` | `[]` | Preload list |
| `autoloadImports` | `false` | Scan source for imports |
| `figureFormats` | `['svg']` | `['svg']`, `['png']`, or both |
| `onStatus` | — | `'idle'` / `'loading'` / `'installing'` / `'running'` / `'ready'` / `'error'` |

## Bundle size

~3KB gz (script + worker code). Pyodide itself (~10MB compressed) is fetched
from the CDN at first use.

## License

Apache-2.0. Pyodide itself is MPL-2.0 and served from the CDN.

# `@jupyter-kit/core`

Framework-agnostic Jupyter notebook renderer. Pure DOM, with a small plugin
runtime, a built-in syntax highlighter (Lezer), and a Markdown / DOMPurify
pipeline. React and Vue wrappers (or anything else) sit on top of this.

## Install

```sh
pnpm add @jupyter-kit/core
```

## Usage

```ts
import { createRenderer } from '@jupyter-kit/core';
import { python } from '@jupyter-kit/core/langs/python';
import '@jupyter-kit/theme/themes/default.css';
import '@jupyter-kit/syntax/themes/one-dark.css';

const renderer = createRenderer({
  language: 'python',
  languages: [python],
  filename: 'my-notebook.ipynb',
});

const handle = renderer.mount(document.getElementById('app')!, notebook);
// handle.update(newNotebook), handle.cell(i), handle.destroy()
```

## What it ships

- **`createRenderer(opts)`** — main entry point.
- **`langs/{python,javascript,r,julia,haskell,ruby}`** — Lezer parsers (and
  StreamLanguage wrappers for languages without first-party Lezer support).
  Only Python ships out of the box; everything else is **opt-in** via
  optional peer deps. See *Per-language install* below.
- **JSX runtime** at `@jupyter-kit/core/jsx-runtime` — internal, but usable
  by plugin authors who want to write JSX without React.
- **Plugin API** (`Plugin`) — hooks for `remarkPlugins` / `rehypePlugins`,
  `onCodeBlock`, `renderOutput`, `cellToolbar`, etc.
- **Mutation API on `RuntimeContext`** — `deleteCell`, `moveCell`,
  `duplicateCell`, `download(filename)`. `Ctrl/Cmd+S` saves the notebook.

## Per-language install

`@lezer/python` is bundled as a regular dependency so the most common case
works without any extra steps. Other languages declare their grammars as
optional peer deps; install only what you use:

| Language | Extra packages |
|---|---|
| `python` | (none — included) |
| `javascript` | `pnpm add @lezer/javascript` |
| `r`, `julia`, `haskell`, `ruby` | `pnpm add @codemirror/legacy-modes @codemirror/language @codemirror/state` |

Without these, importing the corresponding `@jupyter-kit/core/langs/<x>`
will fail at bundle time with a clear "module not found" error.

## Sibling packages

| Package | Purpose |
|---|---|
| `@jupyter-kit/react` | React wrapper |
| `@jupyter-kit/vue` | Vue 3 wrapper |
| `@jupyter-kit/wc` | Web Component (`<jk-notebook>`) |
| `@jupyter-kit/theme` | Notebook chrome CSS (per theme) |
| `@jupyter-kit/syntax` | Code highlight CSS (per theme) |
| `@jupyter-kit/mathjax` / `mathjax-cdn` | Math via MathJax |
| `@jupyter-kit/katex` / `katex-cdn` | Math via KaTeX |
| `@jupyter-kit/editor-codemirror` | Editable cells via CodeMirror 6 |
| `@jupyter-kit/executor-pyodide` | Run Python in the browser |
| `@jupyter-kit/executor-webr` | Run R in the browser (GPL-2.0+) |

## License

Apache-2.0.

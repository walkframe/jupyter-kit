# `@jupyter-kit/editor-codemirror`

CodeMirror 6 inline editor for `@jupyter-kit/core`. Replaces the static
`<pre>` of each code cell with an editable CodeMirror view, adds a hover
toolbar (run / duplicate / delete) and a Shift+Enter run keybinding.

## Install

```sh
pnpm add @jupyter-kit/editor-codemirror @jupyter-kit/core \
  @codemirror/state @codemirror/view @codemirror/language @codemirror/commands
```

`@codemirror/*` are peer deps so your app can pick its own version.

## Usage

```ts
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { python } from '@codemirror/lang-python';

createRenderer({
  plugins: [
    createEditorPlugin({
      languages: { python: python() },  // per-language extensions
      readOnly: false,
      lineNumbers: false,
      fontFamily: "'Fira Code', monospace",
    }),
  ],
  executor: someExecutor,  // gives the toolbar a ▶ button + Shift+Enter
});
```

## Options

| Option | Default | Notes |
|---|---|---|
| `languages` | `{}` | CodeMirror `Extension` per language id (e.g. `'python'`) |
| `extensions` | `[]` | Extra extensions applied to every editor |
| `readOnly` | `false` | Render as read-only |
| `lineNumbers` | `false` | Notebook cells are short — off by default |
| `fontFamily` | system mono stack | Editor font |
| `fontSize` | `inherit` | |
| `backgroundColor` | `transparent` | Inherits theme |
| `inactiveBorderColor` / `focusBorderColor` | both `transparent` | Themes drive `.cell:focus-within` instead |
| `runButton` | `true` | Show ▶ when an executor is configured |
| `runLabel` | `'Run (Shift+Enter)'` | Tooltip |

## Highlight integration

CodeMirror's `syntaxHighlighting(classHighlighter)` is applied automatically,
emitting the same `tok-*` classes as `@jupyter-kit/core/langs/*` — so a
`@jupyter-kit/syntax/themes/<name>.css` file styles both modes
identically.

## License

Apache-2.0.

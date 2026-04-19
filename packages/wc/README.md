# `@jupyter-kit/wc`

Web Component wrapper around `@jupyter-kit/core`. Defines
`<jk-notebook>` as a CustomElement, so a notebook can be embedded in any
HTML page or framework with no JS-side mounting.

## Install

```sh
pnpm add @jupyter-kit/wc
```

## Usage

### Plain HTML

```html
<script type="module">
  import '@jupyter-kit/wc';
  import { python } from '@jupyter-kit/core/langs/python';
  import { createKatexPlugin } from '@jupyter-kit/katex';

  const el = document.querySelector('jk-notebook');
  el.ipynb = await fetch('demo.ipynb').then((r) => r.json());
  el.languages = [python];
  el.plugins = [createKatexPlugin()];
</script>

<link rel="stylesheet" href="/path/to/@jupyter-kit/theme/themes/default.css" />
<link rel="stylesheet" href="/path/to/@jupyter-kit/syntax/themes/one-dark.css" />

<jk-notebook language="python" filename="demo.ipynb" math-align="left"></jk-notebook>
```

Importing the package auto-registers `<jk-notebook>` via
`customElements.define`. To use a different tag name:

```ts
import { defineNotebook } from '@jupyter-kit/wc';
defineNotebook('my-notebook');
```

### Inside React / Vue / Svelte / Astro

```html
<jk-notebook ref={el => { el.ipynb = nb; el.languages = [python]; }} />
```

Or, if your framework supports custom element prop forwarding (Vue 3, Svelte,
React 19+), pass props directly.

## Attributes vs properties

| Input | How to set | Why |
|---|---|---|
| `notebook`, `plugins`, `languages`, `executor`, `htmlFilter` | property only | Object-shaped, can't ride on attributes |
| `language` | attr `language="python"` or property | string |
| `filename` | attr `filename="demo.ipynb"` | string |
| `math-align` | attr `math-align="center"` | `'left' \| 'center' \| 'right'` |
| `class-name` | attr `class-name="my-cls"` | string (rendered as className on root) |
| `bg-transparent` | attr (presence = true) | boolean |
| `seq-as-execution-count` | attr (presence = true) | boolean |

## Events

- `load` — `CustomEvent` fired once after the renderer has mounted.

## Programmatic access

```ts
const el = document.querySelector('jk-notebook');
el.rendererHandle?.download();   // save .ipynb
el.rendererHandle?.cell(0);      // CellHandle
```

`Cmd/Ctrl+S` inside the element saves the notebook (handled by core).

## Design notes

- **Light DOM**, not Shadow DOM. This keeps theme CSS imported at the page
  level applicable, and keeps the rendered HTML SSR-serialisable.
- **Bundle**: ~1.6KB gz on top of core (~114KB gz). All other behaviour and
  cost lives in core.

## License

Apache-2.0.

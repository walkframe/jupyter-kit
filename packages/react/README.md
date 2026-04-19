# `@jupyter-kit/react`

> Renamed from [`react-ipynb-renderer`](https://www.npmjs.com/package/react-ipynb-renderer)
> starting with v3. The old package is the v2 React-only renderer; v3 is a
> rewrite as a framework-agnostic core (`@jupyter-kit/core`) with this thin
> React wrapper on top. API is not compatible with v2.

Thin React wrapper around `@jupyter-kit/core`. Mounts the renderer into a
`<div>` and forwards prop changes through to `RendererHandle.update()`.

## Install

```sh
pnpm add @jupyter-kit/react
```

`@jupyter-kit/core` is pulled in transitively.

## Usage

```tsx
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';

import notebook from './notebook.json';
import '@jupyter-kit/theme/themes/default.css';
import '@jupyter-kit/syntax/themes/one-dark.css';
import 'katex/dist/katex.min.css';

export default function App() {
  return (
    <Notebook
      ipynb={notebook}
      language="python"
      languages={[python]}
      plugins={[createKatexPlugin()]}
      filename="notebook.ipynb"
      mathAlign="left"
    />
  );
}
```

## Props

All `RendererOptions` from core are accepted, plus:

- `ipynb: Notebook` — the notebook JSON.
- `onLoad?: () => void` — fired once after first mount.

`ref` exposes `{ handle(), el() }` for imperative access.

## License

Apache-2.0.

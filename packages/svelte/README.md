# @jupyter-kit/svelte

Svelte 5 wrapper around [`@jupyter-kit/core`](../core).

```svelte
<script lang="ts">
  import { Notebook } from '@jupyter-kit/svelte';
  import notebook from './example.ipynb';
</script>

<Notebook ipynb={notebook} />
```

The component mounts the renderer once into an internal `<div>` and re-uses
the same `RendererHandle` across `ipynb` updates via `handle.update(...)` —
DOM and any active CodeMirror editors are not torn down between updates.
Option-shape changes (plugins, executor, htmlFilter, etc.) trigger a full
remount.

## Props

All props mirror [`RendererOptions`](../core/src/types.ts).

| Prop | Type | Notes |
|---|---|---|
| `ipynb` (required) | `Ipynb` | The notebook document |
| `language` | `string` | Default cell language |
| `languages` | `LanguageDef[]` | Lezer parsers |
| `plugins` | `Plugin[]` | e.g. `@jupyter-kit/widgets`, `@jupyter-kit/katex` |
| `executor` | `Executor` | e.g. `@jupyter-kit/executor-pyodide` |
| `htmlFilter` | `HtmlFilter` | Sanitizer for raw HTML cells |
| `bgTransparent` | `boolean` | |
| `seqAsExecutionCount` | `boolean` | |
| `className` | `string` | Extra class on the wrapper |
| `filename` | `string` | Displayed name |
| `mathAlign` | `'left' \| 'center' \| 'right'` | |
| `onload` | `() => void` | Fires after first mount |

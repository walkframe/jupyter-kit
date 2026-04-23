# `@jupyter-kit/vue`

Vue 3 wrapper around `@jupyter-kit/core`. Mounts the renderer into an
internal `<div>` once and keeps it alive across prop changes via
`handle.update(...)` (so open editors / executors don't reset when the
notebook is edited).

## Install

```sh
pnpm add @jupyter-kit/vue vue
```

## Usage

```vue
<script setup lang="ts">
import { Notebook } from '@jupyter-kit/vue';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';

import notebook from './notebook.json';
import '@jupyter-kit/theme/themes/default.css';
import '@jupyter-kit/syntax/themes/one-dark.css';
import 'katex/dist/katex.min.css';

const plugins = [createKatexPlugin()];
</script>

<template>
  <Notebook
    :ipynb="notebook"
    language="python"
    :languages="[python]"
    :plugins="plugins"
    filename="notebook.ipynb"
    math-align="left"
    @load="() => console.log('mounted')"
  />
</template>
```

## Props

All `RendererOptions` from core are props, plus:

- `ipynb: Notebook` — the notebook JSON (required).
- `@load` event — fired once after first mount.

The component also exposes `{ handle(), el() }` via `defineExpose`, so a
template ref can reach the underlying `RendererHandle` or the mount element:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
const r = ref();
onMounted(() => r.value.handle()?.download());
</script>

<template><Notebook ref="r" :ipynb="notebook" /></template>
```

## License

Apache-2.0.

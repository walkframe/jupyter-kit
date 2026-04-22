# @jupyter-kit/widgets

ipywidgets plugin for [`@jupyter-kit`](https://jupyter-kit.walkframe.com).
Renders `application/vnd.jupyter.widget-view+json` outputs via
[`@jupyter-widgets/html-manager`](https://www.npmjs.com/package/@jupyter-widgets/html-manager).

## Two modes

| | What you get | Requires |
|---|---|---|
| **Static** | Hydrates `metadata.widgets["application/vnd.jupyter.widget-state+json"]` from the saved notebook. Sliders show their last value but don't fire callbacks. | nothing extra |
| **Live** | Sliders drive Python callbacks and outputs re-render on every change. | an executor with `commProvider` (e.g. [`executor-pyodide`](../executor-pyodide), [`executor-jupyter`](../executor-jupyter)) |

The plugin auto-detects the executor's `commProvider` — no extra wiring.

## Usage

### Static (read-only viewer)

```tsx
import { Notebook } from '@jupyter-kit/react';
import { createWidgetsPlugin } from '@jupyter-kit/widgets';

<Notebook
  plugins={[createWidgetsPlugin()]}
  ipynb={notebook}
/>;
```

### Live (interactive, with Pyodide)

```tsx
import { createPyodideExecutor } from '@jupyter-kit/executor-pyodide';
import { createWidgetsPlugin } from '@jupyter-kit/widgets';

<Notebook
  executor={createPyodideExecutor({ packages: ['ipywidgets'] })}
  plugins={[createWidgetsPlugin()]}
  ipynb={notebook}
/>;
```

### Live (with a remote Jupyter kernel)

```tsx
import { createJupyterExecutor } from '@jupyter-kit/executor-jupyter';
import { createWidgetsPlugin } from '@jupyter-kit/widgets';

<Notebook
  executor={createJupyterExecutor({ baseUrl, token })}
  plugins={[createWidgetsPlugin()]}
  ipynb={notebook}
/>;
```

## Options

| Option | Type | Notes |
|---|---|---|
| `loader` | `(moduleName: string, moduleVersion: string) => Promise<unknown>` | Resolver for custom widget modules outside `@jupyter-widgets/{base,controls,output}`. Return the module exports containing view/model classes. |

## Bundle cost

Pulls in `@jupyter-widgets/{base,base-manager,controls,html-manager,output}`
— ~600 KB – 1 MB minified. The heavy deps are dynamic-imported on first
`setup()` so the initial render path stays light. The plugin lives in a
separate package so notebooks without widgets don't pay this cost.

## Limitations

- Interactivity requires an executor with `commProvider`. Without it the
  plugin still renders saved widget state, but sliders are inert.
- `widget-view` outputs whose `model_id` wasn't saved show
  `[widget — run the cell to render]` until you re-execute.
- `Output` widget + matplotlib auto-capture works for typical
  `@interact(...)` patterns but exotic uses (multi-widget display,
  `clear_output(wait=True)` interleaving) may diverge from classic
  Jupyter.

## More

Full reference: <https://jupyter-kit.walkframe.com/reference/widgets/>

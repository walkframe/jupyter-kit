# @jupyter-kit/comm

Jupyter Comm protocol type definitions for
[`@jupyter-kit`](https://jupyter-kit.walkframe.com). **Types only — zero
runtime bytes.**

Defines the contract between executors (which open / receive comm
messages from a kernel) and plugins (notably
[`@jupyter-kit/widgets`](../widgets), which subscribes to
`comm_open` to drive ipywidgets).

## Who depends on this

| Role | Package | What it does with the contract |
|---|---|---|
| Executor | [`executor-pyodide`](../executor-pyodide) | Implements `CommProvider`; bridges Pyodide's `ipykernel.comm.Comm` to the frontend. |
| Executor | [`executor-jupyter`](../executor-jupyter) | Implements `CommProvider`; routes shell-channel `comm_*` messages to and from a remote Jupyter kernel. |
| Plugin | [`widgets`](../widgets) | Calls `commProvider.onCommOpen('jupyter.widget', ...)` to receive widget model updates. |

If you're writing your own executor or widget-style plugin, `import` from
this package to interop with the rest of the ecosystem.

## Exported types

```ts
import type {
  Comm,
  CommBuffers,
  CommCallbacks,
  CommMsg,
  CommOpenHandler,
  CommOpenMsg,
  CommProvider,
  JSONValue,
} from '@jupyter-kit/comm';
```

The shapes intentionally match the
[Jupyter messaging spec](https://jupyter-client.readthedocs.io/en/latest/messaging.html#custom-messages)
(`comm_open` / `comm_msg` / `comm_close`) so existing kernel-side code
doesn't need adapters.

## Bundle cost

Zero — `dist/index.js` is empty after `tsc`. Only the `.d.ts` file is
referenced at type-check time.

# @jupyter-kit/executor-jupyter

Remote Jupyter kernel executor for `@jupyter-kit`. Talks to a running
**Jupyter Server** (or JupyterHub / BinderHub / Enterprise Gateway) over the
standard kernel WebSocket protocol.

Because it speaks the protocol — not Python directly — it is **language-
agnostic**: any installed Jupyter kernel works (Python via `ipykernel`,
R via `IRkernel`, Julia via `IJulia`, TypeScript via `ITypescript`, ...).

For comparison:

| | runtime | location |
|---|---|---|
| `@jupyter-kit/executor-pyodide` | Python (CPython compiled to WASM) | browser |
| `@jupyter-kit/executor-webr` | R (compiled to WASM) | browser |
| `@jupyter-kit/executor-jupyter` | any Jupyter kernel | remote server |

## Usage

```ts
import { createJupyterExecutor } from '@jupyter-kit/executor-jupyter';

const executor = createJupyterExecutor({
  baseUrl: 'http://localhost:8888',
  token: 'YOUR_JUPYTER_TOKEN',
  kernelName: 'python3', // any installed kernel
  onStatus: (s, detail) => console.log(s, detail),
});

// pass to <Notebook executor={executor} />
```

## Options

| Option | Type | Default | |
|---|---|---|---|
| `baseUrl` (required) | `string` | — | Jupyter Server base URL |
| `token` | `string` | — | Auth token (from `--ServerApp.token=...`) |
| `kernelName` | `string` | `'python3'` | Kernel spec name |
| `kernelId` | `string` | — | Reuse an existing kernel instead of starting one |
| `shutdownOnDispose` | `boolean` | `true` | Shut down kernel on dispose (only when this executor started it) |
| `onStatus` | `(status, detail?) => void` | — | Lifecycle callback |

## Server setup

The Jupyter Server must enable cross-origin access for the renderer page:

```bash
jupyter server \
  --ServerApp.token=YOUR_TOKEN \
  --ServerApp.allow_origin='*' \
  --ServerApp.disable_check_xsrf=True
```

For production, restrict `allow_origin` to your renderer's actual origin.

## Comm support

The executor implements `commProvider` so plugins like `@jupyter-kit/widgets`
work end-to-end with `ipywidgets` running in the remote kernel.

## Limitations

- `allow_stdin: false` — interactive `input()` calls are not supported.
- v1 binary message protocol is not implemented; modern Jupyter Server
  defaults to JSON over WebSocket so this is rarely an issue.
- Reconnect-on-drop is not built in. If the WS closes, the next `execute()`
  call re-establishes a fresh connection but in-flight requests are lost.

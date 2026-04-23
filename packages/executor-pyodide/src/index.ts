import type { Executor, OutputType } from '@jupyter-kit/core';
import type {
  Comm,
  CommBuffers,
  CommMsg,
  CommOpenHandler,
  CommOpenMsg,
  CommProvider,
  JSONValue,
} from '@jupyter-kit/comm';

import { WORKER_SOURCE } from './worker-source';

const DEFAULT_VERSION = '0.26.2';

export type PyodideStatus =
  | 'idle'
  | 'loading'
  | 'installing'
  | 'running'
  | 'ready'
  | 'error';

export type FigureFormat = 'svg' | 'png';

export type { CommProvider } from '@jupyter-kit/comm';

export type PyodideExecutorOptions = {
  /**
   * URL of `pyodide.js` to load inside the worker, or an ordered fallback
   * list. Each entry is tried in turn; the first that loads wins. When an
   * explicit `indexURL` isn't provided, each fallback derives its
   * `indexURL` from the directory of its `src`. Default: a jsdelivr
   * primary with no other built-in fallbacks (jsdelivr hosts Pyodide's
   * wheel files — a different CDN wouldn't have matching assets).
   */
  src?: string | string[];
  /**
   * Directory URL for `.wasm` / `.whl` files, or an ordered fallback list.
   * Must align 1:1 with `src` when both are arrays (each index pair is a
   * self-consistent CDN). Derived from `src` if omitted.
   */
  indexURL?: string | string[];
  /** Pyodide version (used to build default `src`/`indexURL`). */
  version?: string;
  /**
   * Per-candidate boot timeout in milliseconds. If `importScripts` +
   * `loadPyodide` don't complete within this window, the attempt is
   * abandoned and the next fallback in `src` is tried. Default: 10000.
   * Set `0` to disable.
   */
  timeoutMs?: number;
  /** Packages to `loadPackage(...)` up front before any cell runs. */
  packages?: string[];
  /** Scan cell source for imports and auto-install known packages. */
  autoloadImports?: boolean;
  /**
   * matplotlib output formats to capture. Default: `['svg']`. Set to
   * `['png']` for raster output, or `['svg', 'png']` to ship both (Jupyter
   * convention; lets external tools choose the best representation).
   */
  figureFormats?: FigureFormat[];
  /** Status callback — useful for progress UIs. */
  onStatus?: (status: PyodideStatus, detail?: string) => void;
};

type ToMain =
  | { id: number; type: 'stdout'; text: string }
  | { id: number; type: 'stderr'; text: string }
  | { id: number; type: 'installing'; packages?: string[] }
  | { id: number; type: 'running' }
  | {
      id: number;
      type: 'display_data';
      bundle: Record<string, unknown> | null;
    }
  | {
      id: number;
      type: 'result';
      bundle: Record<string, unknown> | null;
    }
  | {
      id: number;
      type: 'error';
      name: string;
      message: string;
      traceback: string[] | null;
    }
  | { id: number; type: 'done' };

/**
 * Browser Python executor. Pyodide runs inside a dedicated Web Worker so the
 * main thread stays responsive during execution; the worker streams stdout /
 * stderr / final MIME bundle back via postMessage.
 */
export function createPyodideExecutor(
  opts: PyodideExecutorOptions = {},
): Executor {
  const version = opts.version ?? DEFAULT_VERSION;
  const defaultSrc = `https://cdn.jsdelivr.net/pyodide/v${version}/full/pyodide.js`;
  const srcList = toArray(opts.src) ?? [defaultSrc];
  const explicitIndex = toArray(opts.indexURL);
  const bootCandidates = srcList.map((src, i) => ({
    src,
    indexURL: explicitIndex?.[i] ?? deriveIndexURL(src),
  }));
  const bootTimeoutMs = opts.timeoutMs ?? 10_000;

  let worker: Worker | null = null;
  let nextId = 0;

  // Comm bridge state. Kernel→frontend traffic arrives on the worker's single
  // message channel; we fan it out by target (for `comm_open`) and by
  // `comm_id` (for subsequent msg/close). The provider below is what plugins
  // like @jupyter-kit/widgets subscribe to.
  type OpenPayload = {
    subtype: 'comm_open';
    comm_id: string;
    target_name: string;
    data?: JSONValue;
    metadata?: Record<string, unknown>;
    buffers?: CommBuffers;
  };
  type MsgPayload = {
    subtype: 'comm_msg' | 'comm_close';
    comm_id: string;
    data?: JSONValue;
    metadata?: Record<string, unknown>;
    buffers?: CommBuffers;
  };
  type CommPayload = OpenPayload | MsgPayload;

  const openHandlers = new Map<string, CommOpenHandler>();
  const msgListeners = new Map<string, (msg: CommMsg) => void>();
  const closeListeners = new Map<string, (msg: CommMsg) => void>();

  const postCommToWorker = (
    subtype: 'comm_msg' | 'comm_close' | 'open_frontend',
    commId: string,
    data?: JSONValue,
    targetName?: string,
    buffers?: CommBuffers,
  ) => {
    const w = getWorker();
    w.postMessage({
      type: 'comm',
      payload: {
        subtype,
        comm_id: commId,
        target_name: targetName,
        data: data ?? {},
        buffers: buffers ?? [],
      },
    });
  };

  const makeComm = (commId: string, targetName: string): Comm => ({
    comm_id: commId,
    target_name: targetName,
    open(data, callbacks) {
      postCommToWorker('open_frontend', commId, data, targetName);
      fakeIdleStatus(callbacks);
      return '';
    },
    send(data, callbacks, _metadata, buffers) {
      postCommToWorker('comm_msg', commId, data, targetName, buffers);
      // @jupyter-widgets/base throttles subsequent sends until it sees an
      // iopub `status: idle` message — the kernel's "done processing" marker.
      // Our Pyodide worker processes synchronously with no iopub stream, so
      // nothing ever fires that status and the 2nd+ `model.save_changes()`
      // get buffered, not sent. Synthesise the idle message right away: by
      // the time the next user input lands, the worker has already handled
      // this message in order, so faking fast completion is safe.
      fakeIdleStatus(callbacks);
      return '';
    },
    close(data) {
      postCommToWorker('comm_close', commId, data ?? null, targetName);
      msgListeners.delete(commId);
      closeListeners.delete(commId);
      return '';
    },
    on_msg(cb) {
      msgListeners.set(commId, cb);
    },
    on_close(cb) {
      closeListeners.set(commId, cb);
    },
  });

  const handleCommFromWorker = (payload: CommPayload) => {
    if (payload.subtype === 'comm_open') {
      const handler = openHandlers.get(payload.target_name);
      if (!handler) return;
      const comm = makeComm(payload.comm_id, payload.target_name);
      const openMsg: CommOpenMsg = {
        content: {
          target_name: payload.target_name,
          comm_id: payload.comm_id,
          data: (payload.data ?? {}) as JSONValue,
        },
        buffers: payload.buffers,
        metadata: payload.metadata,
      };
      try {
        handler(comm, openMsg);
      } catch (err) {
        console.error('[pyodide] comm open handler threw:', err);
      }
      return;
    }
    const msg: CommMsg = {
      content: {
        comm_id: payload.comm_id,
        data: (payload.data ?? {}) as JSONValue,
      },
      buffers: payload.buffers,
      metadata: payload.metadata,
    };
    if (payload.subtype === 'comm_msg') {
      msgListeners.get(payload.comm_id)?.(msg);
    } else if (payload.subtype === 'comm_close') {
      const cb = closeListeners.get(payload.comm_id);
      msgListeners.delete(payload.comm_id);
      closeListeners.delete(payload.comm_id);
      cb?.(msg);
    }
  };

  const commProvider: CommProvider = {
    async createComm(targetName, commId) {
      const id = commId ?? randomId();
      const comm = makeComm(id, targetName);
      return comm;
    },
    onCommOpen(targetName, handler) {
      openHandlers.set(targetName, handler);
      return () => {
        if (openHandlers.get(targetName) === handler) {
          openHandlers.delete(targetName);
        }
      };
    },
    async listComms() {
      return {};
    },
  };

  const getWorker = (): Worker => {
    if (worker) return worker;
    // Inlined via Blob URL so consumers don't need bundler-specific worker
    // plumbing — works with any build tool.
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.addEventListener('error', (e) => {
      console.error('[pyodide worker] error', e);
      opts.onStatus?.('error', e.message);
    });
    // Always-on listener for comm traffic (outside any per-cell scope).
    worker.addEventListener('message', (e: MessageEvent) => {
      const m = e.data as { type?: string; payload?: CommPayload };
      if (m?.type === 'comm' && m.payload) {
        handleCommFromWorker(m.payload);
      }
    });
    return worker;
  };

  return {
    commProvider,
    async execute(source, language, signal): Promise<OutputType[]> {
      if (signal?.aborted) return [];
      if (!isPython(language)) {
        return [
          makeError('LanguageError', `pyodide cannot run language: ${language}`),
        ];
      }

      const id = ++nextId;
      const w = getWorker();
      const outputs: OutputType[] = [];

      // Buffer one contiguous stream run; flush on stream-type change or any
      // non-stream message. This preserves the visual interleaving Jupyter
      // shows (e.g. stdout → stderr → stdout becomes three distinct blocks).
      let currentStream: 'stdout' | 'stderr' | null = null;
      let currentChunks: string[] = [];
      const flushCurrent = () => {
        if (!currentStream || !currentChunks.length) return;
        outputs.push({
          output_type: 'stream',
          name: currentStream,
          text: [currentChunks.join('\n') + '\n'],
        });
        currentStream = null;
        currentChunks = [];
      };

      opts.onStatus?.('loading');

      return new Promise<OutputType[]>((resolve) => {
        const onMessage = (e: MessageEvent) => {
          const m = e.data as ToMain;
          if (!m || m.id !== id) return;
          switch (m.type) {
            case 'stdout':
            case 'stderr':
              if (currentStream && currentStream !== m.type) flushCurrent();
              currentStream = m.type;
              currentChunks.push(m.text);
              break;
            case 'installing':
              opts.onStatus?.('installing', m.packages?.join(', '));
              break;
            case 'running':
              opts.onStatus?.('running');
              break;
            case 'display_data':
              flushCurrent();
              if (m.bundle) {
                outputs.push({
                  output_type: 'display_data',
                  data: normalizeMime(m.bundle),
                });
              }
              break;
            case 'result':
              flushCurrent();
              if (m.bundle) {
                outputs.push({
                  output_type: 'execute_result',
                  data: normalizeMime(m.bundle),
                });
              }
              break;
            case 'error':
              flushCurrent();
              outputs.push(
                toErrorOutput({
                  name: m.name,
                  message: m.message,
                  traceback: m.traceback,
                }),
              );
              break;
            case 'done':
              flushCurrent();
              w.removeEventListener('message', onMessage);
              opts.onStatus?.('ready');
              resolve(outputs);
              break;
          }
        };
        w.addEventListener('message', onMessage);
        w.postMessage({
          type: 'execute',
          id,
          source,
          autoloadImports: opts.autoloadImports ?? false,
          figureFormats: opts.figureFormats ?? ['svg'],
          boot: {
            candidates: bootCandidates,
            timeoutMs: bootTimeoutMs,
            packages: opts.packages ?? [],
          },
        });
      });
    },
  };
}

// -- helpers -----------------------------------------------------------------

function toArray<T>(v: T | T[] | undefined): T[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

function deriveIndexURL(src: string): string {
  // `src` is the URL of `pyodide.js`; `indexURL` is the directory
  // containing it (Pyodide appends wheel filenames to this). Strip the
  // trailing filename but keep the trailing slash.
  const slash = src.lastIndexOf('/');
  return slash >= 0 ? src.slice(0, slash + 1) : src;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

type StatusCallback = (msg: { content: { execution_state: 'idle' } }) => void;
type CommCallbacksWithIopub = {
  iopub?: { status?: StatusCallback };
} | undefined;

function fakeIdleStatus(callbacks: CommCallbacksWithIopub): void {
  const cb = callbacks?.iopub?.status;
  if (typeof cb !== 'function') return;
  // Defer to a microtask so the status arrives AFTER `send_sync_message`
  // runs `_pending_msgs++` on the way back from `comm.send`. Firing
  // synchronously would decrement before the increment lands, tripping
  // the base model's "Pending messages < 0" sanity-check warning.
  queueMicrotask(() => {
    try {
      cb({ content: { execution_state: 'idle' } });
    } catch {
      /* swallow */
    }
  });
}

function isPython(language: string): boolean {
  return language === 'python' || language === 'py' || language === 'python3';
}

function normalizeMime(
  bundle: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [mime, val] of Object.entries(bundle)) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      out[mime] = val;
      continue;
    }
    // Preserve structured values for JSON mime types — notably
    // `application/vnd.jupyter.widget-view+json`, whose payload is an object
    // like `{model_id, version_major, version_minor}`. Stringifying those
    // would break the widgets plugin's model_id lookup.
    if (mime === 'application/json' || mime.endsWith('+json')) {
      if (typeof val === 'object') {
        out[mime] = val;
      } else {
        out[mime] = val;
      }
      continue;
    }
    out[mime] = String(val);
  }
  return out;
}

function toErrorOutput(err: {
  name?: string;
  message?: string;
  traceback?: string[] | null;
}): OutputType {
  const ename = err?.name || 'PythonError';
  const message = err?.message ?? 'Unknown error';
  // Prefer the worker's ANSI-formatted traceback when available — matches
  // Jupyter/IPython styling. Fall back to splitting err.message.
  const traceback =
    err.traceback && err.traceback.length ? err.traceback : message.split('\n');
  const lastLine = (err.traceback && err.traceback[err.traceback.length - 1]) ||
    message.split('\n').pop() || '';
  const stripped = lastLine.replace(/\x1b\[[0-9;]*m/g, '');
  const match = stripped.match(/^([\w.]+)(?::\s*)?(.*)$/);
  const evalue = match ? match[2] || stripped : stripped;
  return {
    output_type: 'error',
    ename,
    evalue,
    traceback,
  };
}

function makeError(ename: string, message: string): OutputType {
  return {
    output_type: 'error',
    ename,
    evalue: message,
    traceback: [`${ename}: ${message}`],
  };
}

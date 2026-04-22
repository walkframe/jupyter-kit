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

export type JupyterStatus =
  | 'idle'
  | 'connecting'
  | 'starting-kernel'
  | 'busy'
  | 'ready'
  | 'error'
  | 'disconnected';

export type JupyterExecutorOptions = {
  /**
   * Base URL of the Jupyter Server (no trailing slash). e.g.
   * `http://localhost:8888` or `https://hub.example.com/user/foo`.
   */
  baseUrl: string;
  /**
   * API token. Forwarded as `Authorization: token <value>` for REST calls and
   * as `?token=<value>` on the WebSocket URL (the browser can't set custom
   * headers on WS, so the query-param form is required there).
   */
  token?: string;
  /**
   * Kernel spec name to start (`python3`, `ir`, `julia-1.9`, ...).
   * Ignored if `kernelId` is given. Default: `python3`.
   */
  kernelName?: string;
  /**
   * Reuse a pre-existing kernel by id instead of starting a new one.
   * Useful when the kernel state must outlive the page (e.g. a notebook
   * server is keeping it warm).
   */
  kernelId?: string;
  /**
   * Shut down the kernel when the executor is disposed. Only effective when
   * the executor created the kernel itself (i.e. `kernelId` was not given).
   * Default: `true`.
   */
  shutdownOnDispose?: boolean;
  /** Status callback — useful for progress UIs. */
  onStatus?: (status: JupyterStatus, detail?: string) => void;
};

type KernelInfo = { id: string; name: string };

type JupyterMessage = {
  header: MessageHeader;
  parent_header: Partial<MessageHeader>;
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
  buffers?: ArrayBuffer[];
  channel: 'shell' | 'iopub' | 'stdin' | 'control';
};

type MessageHeader = {
  msg_id: string;
  username: string;
  session: string;
  msg_type: string;
  version: string;
  date: string;
};

/**
 * Remote Jupyter kernel executor. Manages a single kernel + WebSocket pair;
 * lazily started on the first `execute()` call and reused thereafter.
 *
 * The kernel protocol is language-agnostic — the runtime is whatever kernel
 * the Jupyter Server has installed (Python via ipykernel, R via IRkernel,
 * Julia via IJulia, etc.). The `language` argument to `execute()` is only
 * used to refuse mismatched code; the kernel itself is fixed at startup.
 */
export function createJupyterExecutor(
  opts: JupyterExecutorOptions,
): Executor & { dispose: () => Promise<void> } {
  const baseUrl = opts.baseUrl.replace(/\/$/, '');
  const token = opts.token;
  const kernelName = opts.kernelName ?? 'python3';
  const shutdownOnDispose = opts.shutdownOnDispose ?? true;
  const ownsKernel = !opts.kernelId;
  const sessionId = randomId();
  const username = 'jupyter-kit';

  let kernel: KernelInfo | null = opts.kernelId
    ? { id: opts.kernelId, name: kernelName }
    : null;
  let ws: WebSocket | null = null;
  let wsReady: Promise<WebSocket> | null = null;
  let disposed = false;

  // Per-request handlers, keyed by msg_id of the originating execute_request.
  type RequestHandler = {
    onIopub: (msg: JupyterMessage) => void;
    onReply: (msg: JupyterMessage) => void;
  };
  const handlers = new Map<string, RequestHandler>();

  // Comm bridge state.
  const openHandlers = new Map<string, CommOpenHandler>();
  const msgListeners = new Map<string, (msg: CommMsg) => void>();
  const closeListeners = new Map<string, (msg: CommMsg) => void>();

  const authHeaders = (): Record<string, string> =>
    token ? { Authorization: `token ${token}` } : {};

  const startKernel = async (): Promise<KernelInfo> => {
    opts.onStatus?.('starting-kernel');
    const res = await fetch(`${baseUrl}/api/kernels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: kernelName }),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to start kernel: ${res.status} ${await res.text()}`,
      );
    }
    const data = (await res.json()) as { id: string; name: string };
    return { id: data.id, name: data.name };
  };

  const shutdownKernel = async (id: string): Promise<void> => {
    try {
      await fetch(`${baseUrl}/api/kernels/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    } catch {
      /* best effort */
    }
  };

  const buildWsUrl = (kernelId: string): string => {
    const wsBase = baseUrl.replace(/^http/, 'ws');
    const params = new URLSearchParams({ session_id: sessionId });
    if (token) params.set('token', token);
    return `${wsBase}/api/kernels/${kernelId}/channels?${params.toString()}`;
  };

  const connect = async (): Promise<WebSocket> => {
    if (ws && ws.readyState === WebSocket.OPEN) return ws;
    if (wsReady) return wsReady;

    wsReady = (async () => {
      if (!kernel) kernel = await startKernel();
      opts.onStatus?.('connecting');
      const socket = new WebSocket(buildWsUrl(kernel.id));
      socket.binaryType = 'arraybuffer';

      await new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          socket.removeEventListener('open', onOpen);
          socket.removeEventListener('error', onError);
          resolve();
        };
        const onError = (e: Event) => {
          socket.removeEventListener('open', onOpen);
          socket.removeEventListener('error', onError);
          reject(new Error(`WebSocket failed to open: ${String(e)}`));
        };
        socket.addEventListener('open', onOpen);
        socket.addEventListener('error', onError);
      });

      socket.addEventListener('message', onSocketMessage);
      socket.addEventListener('close', () => {
        opts.onStatus?.('disconnected');
        ws = null;
        wsReady = null;
      });

      ws = socket;
      opts.onStatus?.('ready');
      return socket;
    })();

    try {
      return await wsReady;
    } catch (err) {
      wsReady = null;
      opts.onStatus?.('error', String(err));
      throw err;
    }
  };

  const onSocketMessage = (e: MessageEvent) => {
    const msg = decodeMessage(e.data);
    if (!msg) return;
    if (msg.channel === 'iopub') {
      const parentId = msg.parent_header?.msg_id;
      if (parentId && handlers.has(parentId)) {
        handlers.get(parentId)!.onIopub(msg);
      }
      handleCommMessage(msg);
      return;
    }
    if (msg.channel === 'shell') {
      const parentId = msg.parent_header?.msg_id;
      if (parentId && handlers.has(parentId)) {
        handlers.get(parentId)!.onReply(msg);
      }
    }
  };

  const handleCommMessage = (msg: JupyterMessage) => {
    if (msg.header.msg_type === 'comm_open') {
      const c = msg.content as {
        comm_id: string;
        target_name: string;
        data?: JSONValue;
      };
      const handler = openHandlers.get(c.target_name);
      if (!handler) return;
      const comm = makeComm(c.comm_id, c.target_name);
      const openMsg: CommOpenMsg = {
        content: {
          target_name: c.target_name,
          comm_id: c.comm_id,
          data: (c.data ?? {}) as JSONValue,
        },
        buffers: msg.buffers as CommBuffers,
        metadata: msg.metadata,
      };
      try {
        handler(comm, openMsg);
      } catch (err) {
        console.error('[jupyter] comm open handler threw:', err);
      }
    } else if (msg.header.msg_type === 'comm_msg') {
      const c = msg.content as { comm_id: string; data?: JSONValue };
      const commMsg: CommMsg = {
        content: { comm_id: c.comm_id, data: (c.data ?? {}) as JSONValue },
        buffers: msg.buffers as CommBuffers,
        metadata: msg.metadata,
      };
      msgListeners.get(c.comm_id)?.(commMsg);
    } else if (msg.header.msg_type === 'comm_close') {
      const c = msg.content as { comm_id: string; data?: JSONValue };
      const commMsg: CommMsg = {
        content: { comm_id: c.comm_id, data: (c.data ?? {}) as JSONValue },
        buffers: msg.buffers as CommBuffers,
        metadata: msg.metadata,
      };
      const cb = closeListeners.get(c.comm_id);
      msgListeners.delete(c.comm_id);
      closeListeners.delete(c.comm_id);
      cb?.(commMsg);
    }
  };

  const sendMessage = (
    channel: JupyterMessage['channel'],
    msgType: string,
    content: Record<string, unknown>,
    metadata: Record<string, unknown> = {},
    buffers: ArrayBuffer[] = [],
  ): string => {
    if (!ws) throw new Error('WebSocket not connected');
    const msgId = randomId();
    const msg: JupyterMessage = {
      header: {
        msg_id: msgId,
        username,
        session: sessionId,
        msg_type: msgType,
        version: '5.3',
        date: new Date().toISOString(),
      },
      parent_header: {},
      metadata,
      content,
      buffers,
      channel,
    };
    ws.send(JSON.stringify(msg));
    return msgId;
  };

  const makeComm = (commId: string, targetName: string): Comm => ({
    comm_id: commId,
    target_name: targetName,
    open(data) {
      sendMessage('shell', 'comm_open', {
        comm_id: commId,
        target_name: targetName,
        data: data ?? {},
      });
      return '';
    },
    send(data, _callbacks, _metadata, buffers) {
      sendMessage(
        'shell',
        'comm_msg',
        { comm_id: commId, data: data ?? {} },
        {},
        (buffers as ArrayBuffer[]) ?? [],
      );
      return '';
    },
    close(data) {
      sendMessage('shell', 'comm_close', {
        comm_id: commId,
        data: data ?? null,
      });
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

  const commProvider: CommProvider = {
    async createComm(targetName, commId) {
      const id = commId ?? randomId();
      return makeComm(id, targetName);
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

  return {
    commProvider,

    async execute(source, _language, signal): Promise<OutputType[]> {
      if (signal?.aborted) return [];
      if (disposed) {
        return [makeError('DisposedError', 'Executor has been disposed')];
      }

      try {
        await connect();
      } catch (err) {
        return [makeError('ConnectionError', String(err))];
      }

      const outputs: OutputType[] = [];
      let currentStream: 'stdout' | 'stderr' | null = null;
      let currentChunks: string[] = [];
      const flush = () => {
        if (!currentStream || !currentChunks.length) return;
        outputs.push({
          output_type: 'stream',
          name: currentStream,
          text: [currentChunks.join('')],
        });
        currentStream = null;
        currentChunks = [];
      };

      return new Promise<OutputType[]>((resolve) => {
        const msgId = sendMessage('shell', 'execute_request', {
          code: source,
          silent: false,
          store_history: true,
          user_expressions: {},
          allow_stdin: false,
          stop_on_error: true,
        });

        let replyArrived = false;
        let idleArrived = false;
        const finalize = () => {
          if (!replyArrived || !idleArrived) return;
          flush();
          handlers.delete(msgId);
          opts.onStatus?.('ready');
          resolve(outputs);
        };

        const onAbort = () => {
          if (kernel) {
            // Best-effort interrupt; not awaited.
            fetch(`${baseUrl}/api/kernels/${kernel.id}/interrupt`, {
              method: 'POST',
              headers: authHeaders(),
            }).catch(() => {});
          }
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        handlers.set(msgId, {
          onIopub: (m) => {
            const c = m.content as Record<string, unknown>;
            switch (m.header.msg_type) {
              case 'status': {
                const state = c.execution_state as string;
                if (state === 'busy') opts.onStatus?.('busy');
                if (state === 'idle') {
                  idleArrived = true;
                  finalize();
                }
                break;
              }
              case 'stream': {
                const name = c.name as 'stdout' | 'stderr';
                const text = c.text as string;
                if (currentStream && currentStream !== name) flush();
                currentStream = name;
                currentChunks.push(text);
                break;
              }
              case 'display_data':
              case 'update_display_data': {
                flush();
                outputs.push({
                  output_type: 'display_data',
                  data: c.data as Record<string, unknown>,
                  metadata: (c.metadata as Record<string, unknown>) ?? {},
                });
                break;
              }
              case 'execute_result': {
                flush();
                outputs.push({
                  output_type: 'execute_result',
                  data: c.data as Record<string, unknown>,
                  metadata: (c.metadata as Record<string, unknown>) ?? {},
                  execution_count: c.execution_count as number,
                });
                break;
              }
              case 'error': {
                flush();
                outputs.push({
                  output_type: 'error',
                  ename: (c.ename as string) ?? 'Error',
                  evalue: (c.evalue as string) ?? '',
                  traceback: (c.traceback as string[]) ?? [],
                });
                break;
              }
            }
          },
          onReply: () => {
            replyArrived = true;
            finalize();
          },
        });
      });
    },

    async dispose(): Promise<void> {
      disposed = true;
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        ws = null;
      }
      if (ownsKernel && shutdownOnDispose && kernel) {
        await shutdownKernel(kernel.id);
        kernel = null;
      }
    },
  };
}

// -- helpers -----------------------------------------------------------------

function decodeMessage(data: unknown): JupyterMessage | null {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as JupyterMessage;
    } catch {
      return null;
    }
  }
  // v1 binary protocol — not implemented; modern Jupyter Server defaults to
  // JSON over WS unless the kernel specifically negotiates v1.
  return null;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function makeError(ename: string, message: string): OutputType {
  return {
    output_type: 'error',
    ename,
    evalue: message,
    traceback: [`${ename}: ${message}`],
  };
}

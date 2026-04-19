/**
 * Jupyter Comm protocol types. Matches the shape `@jupyter-widgets/base`
 * expects (`IClassicComm`) so consumers can adapt with minimal glue.
 *
 * Intentionally runtime-free: only types. Executor packages implement
 * `CommProvider`; renderer plugins (notably `@jupyter-kit/widgets`) consume
 * it via `ctx.executor?.commProvider`.
 */

export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };

export type CommBuffers = ArrayBuffer[] | undefined;

export type CommMsg = {
  /** Kernel→frontend payload. `content.data` / `content.comm_id` mirror
   *  Jupyter message spec; buffers are carried alongside for binary data. */
  content: { data: JSONValue; comm_id: string };
  buffers?: CommBuffers;
  metadata?: Record<string, unknown>;
};

/**
 * Callbacks for a single `send` / `open` on a Comm. Widget managers use these
 * to receive iopub replies to a request, but for our purposes only `iopub`
 * message hooks matter — matches the `ICallbacks` shape expected by
 * `@jupyter-widgets/base`.
 */
export type CommCallbacks = {
  iopub?: {
    status?: (msg: unknown) => void;
    clear_output?: (msg: unknown) => void;
    output?: (msg: unknown) => void;
  };
  shell?: {
    reply?: (msg: unknown) => void;
  };
};

/**
 * Single comm channel. Shape matches `IClassicComm` from `@jupyter-widgets/base`
 * so a provider instance can be handed to the widget manager directly.
 */
export interface Comm {
  readonly comm_id: string;
  readonly target_name: string;

  open(
    data: JSONValue,
    callbacks?: CommCallbacks,
    metadata?: Record<string, unknown>,
    buffers?: CommBuffers,
  ): string;
  send(
    data: JSONValue,
    callbacks?: CommCallbacks,
    metadata?: Record<string, unknown>,
    buffers?: CommBuffers,
  ): string;
  close(
    data?: JSONValue,
    callbacks?: CommCallbacks,
    metadata?: Record<string, unknown>,
    buffers?: CommBuffers,
  ): string;

  on_msg(cb: (msg: CommMsg) => void): void;
  on_close(cb: (msg: CommMsg) => void): void;
}

/** Metadata bundle sent by the kernel when it opens a comm. */
export type CommOpenMsg = {
  content: { target_name: string; comm_id: string; data: JSONValue };
  buffers?: CommBuffers;
  metadata?: Record<string, unknown>;
};

export type CommOpenHandler = (comm: Comm, msg: CommOpenMsg) => void;

/**
 * Executor-implemented bridge between the kernel and the frontend. The pyodide
 * executor creates one internally and exposes it via `Executor.commProvider`.
 * Widget managers instantiate `Comm`s through `createComm` and listen for
 * kernel-initiated opens with `onCommOpen`.
 */
export interface CommProvider {
  /**
   * Frontend-initiated comm. Used when the widget manager needs to open a
   * channel toward the kernel. Returns once the comm is registered on both
   * sides; the caller may start `send`-ing immediately.
   */
  createComm(targetName: string, commId?: string): Promise<Comm>;

  /**
   * Subscribe to kernel-initiated opens for `targetName` (e.g.
   * `'jupyter.widget'`). Returns a disposer.
   */
  onCommOpen(targetName: string, handler: CommOpenHandler): () => void;

  /**
   * Snapshot of live comms, keyed by comm_id. Some widget managers call this
   * to restore widget state after a page reload / kernel restart.
   */
  listComms(targetName?: string): Promise<Record<string, { target_name: string }>>;
}

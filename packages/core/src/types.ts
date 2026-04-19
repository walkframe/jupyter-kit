import type { PluggableList } from 'unified';
import type { Parser } from '@lezer/common';
import type { CommProvider } from '@jupyter-kit/comm';

export type OutputType = {
  name?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  data?: {
    'text/plain'?: string[];
    'text/html'?: string[];
    'text/latex'?: string[];
    'image/png'?: string;
    'image/jpeg'?: string;
    'image/gif'?: string;
    'image/svg+xml'?: string;
    'application/javascript'?: string[];
    // JSON mime types (e.g. `application/vnd.jupyter.widget-view+json`) are
    // preserved as structured objects — stringifying them would break plugins
    // that key into the payload. Hence `unknown`.
    [key: string]: unknown;
  };
  output_type?: string;
  png?: string;
  jpeg?: string;
  gif?: string;
  svg?: string;
  text?: string[];
  execution_count?: number;
  metadata?: {
    scrolled?: boolean;
  };
};

export type CellType = {
  attachments?: { [s: string]: { [s: string]: string } };
  cell_type?: string;
  execution_count?: number | null;
  prompt_number?: number;
  auto_number?: number;
  source?: string[] | string;
  outputs?: OutputType[];
  input?: string[] | string;
};

export type Ipynb = {
  cells: CellType[];
  worksheets?: { cells: CellType[] }[];
  /** Free-form notebook metadata as defined by the nbformat spec. Plugins read
   *  their own keys out of here (e.g. `@jupyter-kit/widgets` looks for
   *  `widgets["application/vnd.jupyter.widget-state+json"]`). */
  metadata?: Record<string, unknown>;
};

export type HtmlFilter = (html: string) => string;

export type LanguageDef = {
  /** Canonical language name (matches a cell's language identifier). */
  name: string;
  /** Other names this language should match (e.g. ['py', 'python3']). */
  aliases?: string[];
  /** Lezer-compatible parser instance. */
  parser: Parser;
};

export type Executor = {
  execute(source: string, language: string, signal?: AbortSignal): Promise<OutputType[]>;
  /**
   * Optional Jupyter Comm bridge. Kernels that support comms (e.g. a Pyodide
   * executor that ships an `ipykernel.comm.Comm` shim) expose one here so
   * plugins like `@jupyter-kit/widgets` can drive interactive widgets.
   */
  commProvider?: CommProvider;
};

export type CellHandle = {
  readonly index: number;
  readonly cell: CellType;
  readonly el: HTMLElement;
  /**
   * Update the source string in state without re-rendering the input area.
   * Editor plugins call this on every keystroke; rebuilding the DOM here
   * would destroy the editor mid-input. Call `redrawInput()` separately if
   * the input UI must reflect an external source change.
   */
  setSource(source: string): void;
  /** Force a rebuild of the input area from the current source. */
  redrawInput(): void;
  setOutputs(outputs: OutputType[]): void;
  rerun(): Promise<void>;
};

export type RuntimeContext = {
  readonly root: HTMLElement;
  readonly options: Readonly<ResolvedOptions>;
  readonly executor?: Executor;
  readonly htmlFilter: HtmlFilter;
  getCell(index: number): CellHandle | undefined;
  cells(): CellHandle[];
  /**
   * Allocate the next notebook-wide execution count. Called by `CellHandle.rerun`
   * to tag `In [n]:` / `Out [n]:` consistently across cells.
   */
  nextExecutionCount(): number;

  /** Current notebook state (reflects prior mutations). */
  notebook(): Ipynb;
  /** Remove a cell by index; any subsequent plugins see the renumbered indices. */
  deleteCell(index: number): void;
  /** Reorder a single cell from one index to another. */
  moveCell(from: number, to: number): void;
  /** Insert a cell at the given position. */
  insertCell(index: number, cell: CellType): void;
  /** Duplicate the cell at `index` (outputs are cleared on the clone). */
  duplicateCell(index: number): void;
  /** Trigger a browser download of the current notebook as `filename`.ipynb. */
  download(filename?: string): void;
};

export type Plugin = {
  name: string;
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
  setup?(ctx: RuntimeContext): void | Promise<void>;
  onCodeBlock?(el: HTMLElement, language: string, ctx: RuntimeContext): void | Promise<void>;
  onMarkdownRendered?(el: HTMLElement, ctx: RuntimeContext): void | Promise<void>;
  renderOutput?(
    output: OutputType,
    slot: HTMLElement,
    ctx: RuntimeContext,
  ): boolean | void;
  cellToolbar?(handle: CellHandle, ctx: RuntimeContext): HTMLElement[] | void;
  teardown?(): void;
};

export type SaveHandler = (
  notebook: Ipynb,
  ctx: { download: (filename?: string) => void },
) => void;

export type RendererOptions = {
  plugins?: Plugin[];
  executor?: Executor;
  htmlFilter?: HtmlFilter;
  /**
   * Override the Ctrl/Cmd+S shortcut. Receives the current notebook and a
   * helper to trigger the default download if desired. When omitted, Ctrl+S
   * downloads the notebook as `.ipynb`.
   */
  onSave?: SaveHandler;
  language?: string;
  /**
   * Lezer parsers used for built-in syntax highlighting of code cells. Import
   * one per language from `@jupyter-kit/core/langs/*`. Pair with a CSS
   * theme from `@jupyter-kit/syntax`.
   */
  languages?: LanguageDef[];
  bgTransparent?: boolean;
  seqAsExecutionCount?: boolean;
  className?: string;
  /** Default filename used by `ctx.download()` and Ctrl+S. */
  filename?: string;
  /**
   * Horizontal alignment for display-mode math (`$$...$$` and friends).
   * Surfaces as `data-math-align` on the root element so CSS can target both
   * MathJax (`mjx-container[display="true"]`) and KaTeX (`.katex-display`).
   * Default: `'left'`.
   */
  mathAlign?: 'left' | 'center' | 'right';
};

export type ResolvedOptions = Required<
  Omit<
    RendererOptions,
    'plugins' | 'executor' | 'htmlFilter' | 'languages' | 'onSave'
  >
>;

export type RendererHandle = {
  update(notebook: Ipynb): void;
  cell(index: number): CellHandle | undefined;
  cells(): CellHandle[];
  destroy(): void;
};

export type Renderer = {
  mount(target: HTMLElement, notebook: Ipynb): RendererHandle;
};

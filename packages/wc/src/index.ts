import {
  createRenderer,
  type Executor,
  type HtmlFilter,
  type Ipynb,
  type LanguageDef,
  type Plugin,
  type RendererHandle,
  type RendererOptions,
} from '@jupyter-kit/core';

export const TAG_NAME = 'jk-notebook';

/**
 * `<jk-notebook>` custom element.
 *
 * Object-shaped values (`notebook`, `plugins`, `languages`, `executor`,
 * `htmlFilter`) are property-only — set them via JS, not HTML attributes:
 *
 *     const el = document.querySelector('jk-notebook');
 *     el.ipynb = await fetch('demo.ipynb').then(r => r.json());
 *     el.languages = [python];
 *     el.plugins = [createKatexPlugin()];
 *
 * Primitive options are also exposed as kebab-case attributes:
 *
 *     <jk-notebook language="python" filename="demo.ipynb"
 *                  math-align="center" bg-transparent></jk-notebook>
 */
export class NotebookElement extends HTMLElement {
  static readonly observedAttributes = [
    'language',
    'filename',
    'math-align',
    'class-name',
    'bg-transparent',
    'seq-as-execution-count',
  ] as const;

  #handle: RendererHandle | null = null;
  #mountTarget: HTMLElement | null = null;

  // Property-only inputs (object-shaped, can't ride on attributes).
  #ipynb: Ipynb | null = null;
  #plugins: Plugin[] | undefined;
  #languages: LanguageDef[] | undefined;
  #executor: Executor | undefined;
  #htmlFilter: HtmlFilter | undefined;

  // -- public property API ---------------------------------------------------

  get ipynb(): Ipynb | null {
    return this.#ipynb;
  }
  set ipynb(v: Ipynb | null) {
    this.#ipynb = v;
    if (this.isConnected) {
      // If renderer already mounted, swap in the new notebook cheaply.
      if (this.#handle && v) this.#handle.update(v);
      else this.#remount();
    }
  }

  get plugins(): Plugin[] | undefined {
    return this.#plugins;
  }
  set plugins(v: Plugin[] | undefined) {
    this.#plugins = v;
    if (this.isConnected) this.#remount();
  }

  get languages(): LanguageDef[] | undefined {
    return this.#languages;
  }
  set languages(v: LanguageDef[] | undefined) {
    this.#languages = v;
    if (this.isConnected) this.#remount();
  }

  get executor(): Executor | undefined {
    return this.#executor;
  }
  set executor(v: Executor | undefined) {
    this.#executor = v;
    if (this.isConnected) this.#remount();
  }

  get htmlFilter(): HtmlFilter | undefined {
    return this.#htmlFilter;
  }
  set htmlFilter(v: HtmlFilter | undefined) {
    this.#htmlFilter = v;
    if (this.isConnected) this.#remount();
  }

  /** Direct access to the underlying core handle (post-mount). */
  get rendererHandle(): RendererHandle | null {
    return this.#handle;
  }

  // -- lifecycle -------------------------------------------------------------

  connectedCallback(): void {
    if (!this.#mountTarget) {
      // Light DOM container — keeps content stylable from outer CSS and
      // serializable for SSR. Shadow DOM would isolate styles but break
      // theme/syntax CSS imports.
      this.#mountTarget = document.createElement('div');
      this.#mountTarget.className = 'jupyter-kit-notebook';
      this.append(this.#mountTarget);
    }
    this.#mount();
  }

  disconnectedCallback(): void {
    this.#destroy();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#remount();
  }

  // -- internals -------------------------------------------------------------

  #buildOptions(): RendererOptions {
    const opts: RendererOptions = {
      plugins: this.#plugins,
      executor: this.#executor,
      htmlFilter: this.#htmlFilter,
      languages: this.#languages,
    };
    const lang = this.getAttribute('language');
    if (lang) opts.language = lang;
    const filename = this.getAttribute('filename');
    if (filename) opts.filename = filename;
    const className = this.getAttribute('class-name');
    if (className) opts.className = className;
    const align = this.getAttribute('math-align');
    if (align === 'left' || align === 'center' || align === 'right') {
      opts.mathAlign = align;
    }
    if (this.hasAttribute('bg-transparent')) {
      opts.bgTransparent = parseBool(this.getAttribute('bg-transparent'));
    }
    if (this.hasAttribute('seq-as-execution-count')) {
      opts.seqAsExecutionCount = parseBool(
        this.getAttribute('seq-as-execution-count'),
      );
    }
    return opts;
  }

  #mount(): void {
    if (!this.#mountTarget || !this.#ipynb) return;
    if (this.#handle) return;
    const renderer = createRenderer(this.#buildOptions());
    this.#handle = renderer.mount(this.#mountTarget, this.#ipynb);
    this.dispatchEvent(new CustomEvent('load'));
  }

  #remount(): void {
    this.#destroy();
    this.#mount();
  }

  #destroy(): void {
    this.#handle?.destroy();
    this.#handle = null;
  }
}

function parseBool(v: string | null): boolean {
  // HTML boolean attribute idioms: presence + empty string + 'true' = true.
  // Anything explicitly 'false' / '0' is false.
  if (v == null) return false;
  if (v === '' || v === 'true' || v === '1') return true;
  return false;
}

/** Idempotent registration. Safe to call multiple times. */
export function defineNotebook(tag: string = TAG_NAME): void {
  if (!customElements.get(tag)) {
    customElements.define(tag, NotebookElement);
  }
}

// Auto-register on import for the typical zero-config use case.
if (typeof customElements !== 'undefined') {
  defineNotebook();
}

declare global {
  interface HTMLElementTagNameMap {
    'jk-notebook': NotebookElement;
  }
}

// Re-export core types. The ipynb document type is `Ipynb` in core so it
// never shadows the `<jk-notebook>` element's `NotebookElement` class.
export type {
  CellHandle,
  CellType,
  Executor,
  HtmlFilter,
  Ipynb,
  LanguageDef,
  OutputType,
  Plugin,
  RendererHandle,
  RendererOptions,
} from '@jupyter-kit/core';

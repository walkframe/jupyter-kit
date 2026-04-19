import type { Plugin } from '@jupyter-kit/core';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

export type KatexCdnPluginOptions = {
  /** KaTeX version. Default: 0.16.22. */
  version?: string;
  /**
   * CDN base URL, or an ordered fallback list. Each entry is the
   * directory containing `katex.min.js`, `katex.min.css`, and
   * `contrib/auto-render.min.js`. The list is tried in order; first
   * one that loads wins. Default: single jsdelivr URL. Supply your own
   * array (e.g. `[primary, backup]`) if you need CDN redundancy.
   */
  src?: string | string[];
  /**
   * Per-URL load timeout in milliseconds. If the browser's `onload` /
   * `onerror` doesn't fire within this window, the attempt is treated
   * as a failure and the next fallback URL is tried. Default: 10000.
   * Set `0` to disable (wait indefinitely).
   */
  timeoutMs?: number;
  /** Delimiters passed to renderMathInElement. Defaults to the common four. */
  delimiters?: Array<{ left: string; right: string; display: boolean }>;
  /** Options forwarded to KaTeX renderMathInElement. */
  rendererOptions?: Record<string, unknown>;
};

const SCRIPT_ID = 'jupyter-kit-katex-cdn';
const STYLE_ID = 'jupyter-kit-katex-cdn-style';
const AUTORENDER_ID = 'jupyter-kit-katex-cdn-autorender';

const DEFAULT_DELIMS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
];

declare global {
  interface Window {
    katex?: unknown;
    renderMathInElement?: (
      el: HTMLElement,
      opts?: Record<string, unknown>,
    ) => void;
  }
}

/**
 * Loads KaTeX from a CDN (core + auto-render + CSS) once, then calls
 * renderMathInElement after each markdown cell renders.
 */
export function createKatexCdnPlugin(
  opts: KatexCdnPluginOptions = {},
): Plugin {
  const version = opts.version ?? '0.16.22';
  const bases = resolveBases(opts.src, version);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let loadPromise: Promise<void> | null = null;

  const ensureLoaded = (): Promise<void> => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      // Inject the CSS stylesheet from the first URL — browsers don't give
      // us a reliable `onerror` for <link rel="stylesheet">, so fallback
      // for CSS is best-effort. We still try each base for the JS, which
      // is the load-critical part.
      injectStyle(`${bases[0]}/katex.min.css`);
      const base = await loadScriptFirstOk(
        SCRIPT_ID,
        bases.map((b) => `${b}/katex.min.js`),
        timeoutMs,
      );
      await loadScriptFirstOk(
        AUTORENDER_ID,
        // Re-use whichever base succeeded so core + auto-render come from
        // the same CDN — pinned-version consistency.
        [base.replace(/\/katex\.min\.js$/, '/contrib/auto-render.min.js')],
        timeoutMs,
      );
    })();
    return loadPromise;
  };

  const render = async (el: HTMLElement) => {
    await ensureLoaded();
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(el, {
      delimiters: opts.delimiters ?? DEFAULT_DELIMS,
      throwOnError: false,
      ...opts.rendererOptions,
    });
  };

  return {
    name: '@jupyter-kit/katex-cdn',
    // Same deal as mathjax-cdn: tokenise math early so escape characters
    // survive markdown processing, then re-wrap with `$...$` so KaTeX
    // auto-render can find and typeset them.
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeUnwrapMath],
    setup() {
      void ensureLoaded().catch((err) => {
        console.error('[katex-cdn] preload failed:', err);
      });
    },
    onMarkdownRendered(el) {
      void render(el).catch((err) => {
        console.error('[katex-cdn] render failed:', err);
      });
    },
  };
}

function injectStyle(href: string): void {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

function resolveBases(
  src: string | string[] | undefined,
  version: string,
): string[] {
  if (typeof src === 'string') return [src];
  if (Array.isArray(src) && src.length) return src;
  return [`https://cdn.jsdelivr.net/npm/katex@${version}/dist`];
}

/**
 * Try each URL in order. Resolves with the URL that successfully loaded;
 * rejects if every one fails. The `id` attribute is set on the first
 * attempt so subsequent calls short-circuit.
 */
function loadScriptFirstOk(
  id: string,
  srcs: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      const src = (existing as HTMLScriptElement).src;
      return resolve(src);
    }
    const errors: string[] = [];
    for (const src of srcs) {
      try {
        await loadScript(id, src, timeoutMs);
        return resolve(src);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        // Make sure the failed <script> is removed so the next attempt
        // can re-use the id.
        const stale = document.getElementById(id);
        stale?.remove();
      }
    }
    reject(new Error(`all script URLs failed:\n${errors.join('\n')}`));
  });
}

function loadScript(
  id: string,
  src: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.defer = true;
    // Browsers never fire `onerror` for a hung request (e.g. CDN that
    // opens the connection then stalls). Trip a timeout so the fallback
    // chain actually advances. `0` disables the timeout.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = (handler: () => void) => {
      if (timer) clearTimeout(timer);
      timer = null;
      handler();
    };
    s.onload = () => done(resolve);
    s.onerror = () => done(() => reject(new Error(`script load failed: ${src}`)));
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        s.remove();
        done(() => reject(new Error(`script load timeout (${timeoutMs}ms): ${src}`)));
      }, timeoutMs);
    }
    document.head.append(s);
  });
}

type HastNode = {
  type: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
  value?: string;
};

/** Unwrap remark-math's `<code class="math-inline|math-display">` into bare `$...$` / `$$...$$` text so CDN auto-renderers can scan it. */
function rehypeUnwrapMath() {
  return (tree: HastNode) => {
    visit(tree, 'element', (node: HastNode) => {
      if (node.tagName !== 'code') return;
      const classes = node.properties?.className ?? [];
      const isInline = classes.includes('math-inline');
      const isDisplay = classes.includes('math-display');
      if (!isInline && !isDisplay) return;
      const text =
        node.children
          ?.map((c) => (typeof c.value === 'string' ? c.value : ''))
          .join('') ?? '';
      const wrapped = isDisplay ? `$$${text}$$` : `$${text}$`;
      (node as unknown as { type: string }).type = 'text';
      (node as unknown as { value: string }).value = wrapped;
      delete node.tagName;
      delete node.properties;
      delete node.children;
    });
  };
}

import type { Plugin, RuntimeContext } from '@jupyter-kit/core';
import { remarkPromoteDisplayMath } from '@jupyter-kit/core';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

export type MathjaxCdnPluginOptions = {
  /**
   * MathJax CDN URL, or an ordered fallback list. When an array is
   * supplied the plugin tries each in turn; the first that loads wins.
   * Default: a single jsdelivr URL. Supply your own array (e.g.
   * `[primary, backup]`) if you need CDN redundancy.
   */
  src?: string | string[];
  /**
   * Per-URL load timeout in milliseconds. If `onload` / `onerror` don't
   * fire within this window, the attempt is abandoned and the next
   * fallback URL is tried. Default: 10000. Set `0` to disable.
   */
  timeoutMs?: number;
  /** MathJax window.MathJax config injected before the script tag loads. */
  config?: Record<string, unknown>;
  /** Force re-injection if a MathJax script tag already exists. Default false. */
  forceReload?: boolean;
};

const DEFAULT_SRCS = [
  'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js',
];

const SCRIPT_ID = 'jupyter-kit-mathjax-cdn';

/**
 * MathJax v3 only recognises `\( \)` / `$$ $$` by default. Notebook and sympy
 * output uses bare `$` everywhere, so enable those delimiters. Users can pass
 * a full `config` to override.
 */
const DEFAULT_CONFIG: Record<string, unknown> = {
  tex: {
    inlineMath: [
      ['$', '$'],
      ['\\(', '\\)'],
    ],
    displayMath: [
      ['$$', '$$'],
      ['\\[', '\\]'],
    ],
    processEscapes: true,
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  },
};

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (els?: HTMLElement[]) => Promise<void>;
      typeset?: (els?: HTMLElement[]) => void;
      startup?: { promise?: Promise<void> };
    } & Record<string, unknown>;
  }
}

/**
 * Loads MathJax from a CDN once, then re-typesets after each markdown cell
 * renders. Math syntax is left intact in the markdown stream — MathJax does
 * the work in the browser by walking the DOM after insertion.
 */
export function createMathjaxCdnPlugin(
  opts: MathjaxCdnPluginOptions = {},
): Plugin {
  const srcs = resolveSrcs(opts.src);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let loadPromise: Promise<void> | null = null;

  const ensureLoaded = (): Promise<void> => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (existing && !opts.forceReload) {
        if (window.MathJax?.startup?.promise) await window.MathJax.startup.promise;
        return;
      }

      const cfg = document.createElement('script');
      cfg.textContent = `window.MathJax = ${JSON.stringify(
        opts.config ?? DEFAULT_CONFIG,
      )};`;
      document.head.append(cfg);

      // Try each CDN in order; the first to load wins. MathJax has its
      // own startup promise once loaded — await that so render calls
      // issued immediately after don't race the engine's init.
      const errors: string[] = [];
      for (const src of srcs) {
        try {
          await loadScript(SCRIPT_ID, src, timeoutMs);
          if (window.MathJax?.startup?.promise) {
            await window.MathJax.startup.promise;
          }
          return;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
          document.getElementById(SCRIPT_ID)?.remove();
        }
      }
      throw new Error(`all MathJax CDN URLs failed:\n${errors.join('\n')}`);
    })();
    return loadPromise;
  };

  const typeset = async (el: HTMLElement) => {
    await ensureLoaded();
    const mj = window.MathJax;
    if (!mj) return;
    if (mj.typesetPromise) {
      await mj.typesetPromise([el]);
    } else if (mj.typeset) {
      mj.typeset([el]);
    }
  };

  return {
    name: '@jupyter-kit/mathjax-cdn',
    // Tokenise `$...$` before general markdown escaping would mangle the
    // LaTeX source (e.g. `\\` becoming `\`). rehypeUnwrapMath then drops the
    // math node wrapper back to bare `$...$` in the DOM so MathJax picks it
    // up.
    remarkPlugins: [remarkMath, remarkPromoteDisplayMath],
    rehypePlugins: [rehypeUnwrapMath],
    setup(_ctx: RuntimeContext) {
      void ensureLoaded().catch((err) => {
        console.error('[mathjax-cdn] preload failed:', err);
      });
    },
    onMarkdownRendered(el) {
      void typeset(el).catch((err) => {
        console.error('[mathjax-cdn] typeset failed:', err);
      });
    },
  };
}

function resolveSrcs(src: string | string[] | undefined): string[] {
  if (typeof src === 'string') return [src];
  if (Array.isArray(src) && src.length) return src;
  return DEFAULT_SRCS;
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
    // Browsers don't fire `onerror` for hung requests (a CDN that opens
    // the connection then stalls). Tripping a timeout lets the fallback
    // chain advance instead of blocking the whole plugin. `0` disables.
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

/**
 * remark-math emits math as `<code class="language-math math-inline">LaTeX</code>`
 * (or `.math-display`). Rehype/markdown-html escaping would otherwise corrupt
 * the content; by the time we see the tree the LaTeX is intact. Convert each
 * math node into a plain text node wrapped in `$...$` / `$$...$$` so the
 * CDN-loaded typesetter can scan and render them.
 *
 * `remarkPromoteDisplayMath` (run earlier in the remark pass) reclassifies
 * single-line `$$..$$` as `math-display`, so by the time we reach the hast
 * tree the className alone is enough to decide delimiter pair.
 */
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
      // Mutate into a text node — unist-util-visit permits in-place edits and
      // HAST text nodes just need `type: 'text'` + `value`.
      (node as unknown as { type: string }).type = 'text';
      (node as unknown as { value: string }).value = wrapped;
      delete node.tagName;
      delete node.properties;
      delete node.children;
    });
  };
}

import type { Plugin, OutputType, RuntimeContext, Ipynb } from '@jupyter-kit/core';
import type { CommProvider, CommMsg, CommOpenMsg } from '@jupyter-kit/comm';
import type { KitManager } from './runtime';

// `@jupyter-widgets/html-manager` (and its transitive @jupyterlab/* deps)
// were bundled with webpack and reference `__webpack_public_path__` at
// runtime to compute chunk URLs. Vite / Rollup don't define it, so loading
// the runtime under those bundlers throws `ReferenceError: __webpack_public_path__`.
// Set it to '' here, before any dynamic import of `./runtime`, so the
// reference resolves to an empty string regardless of the host bundler.
if (
  typeof globalThis !== 'undefined' &&
  !('__webpack_public_path__' in globalThis)
) {
  (globalThis as { __webpack_public_path__?: string }).__webpack_public_path__ = '';
}

const WIDGET_VIEW_MIME = 'application/vnd.jupyter.widget-view+json';
const WIDGET_STATE_MIME = 'application/vnd.jupyter.widget-state+json';
const WIDGET_TARGET = 'jupyter.widget';

export type WidgetsPluginOptions = {
  /**
   * Called when a 3rd-party widget package (anything outside
   * `@jupyter-widgets/{base,controls,output}`) is referenced. Return the
   * module exports that contain the view/model classes.
   */
  loader?: (moduleName: string, moduleVersion: string) => Promise<unknown>;
};

/**
 * ipywidgets renderer. When the executor exposes a `commProvider`, widgets
 * are fully interactive: the manager opens comms against the kernel and
 * drives state sync. Without a provider, the plugin still hydrates any
 * `widget-state+json` metadata embedded in the notebook so saved views
 * render (inert, but with final values visible).
 *
 * The `@jupyter-widgets/html-manager` dependency ships as CJS-style ESM
 * (`.js` imports without extensions), which Node/Astro SSR refuses to load
 * directly. We dynamic-import the runtime so module-graph evaluation at SSR
 * time never touches widget code — only the client path does.
 */
export function createWidgetsPlugin(opts: WidgetsPluginOptions = {}): Plugin {
  let managerPromise: Promise<KitManager> | null = null;
  let commUnsub: (() => void) | null = null;
  // Cache hydration per state bundle. When the notebook prop changes (e.g. the
  // Pyodide demo's fixture dropdown swaps Lorenz in), the metadata ref changes,
  // the WeakMap misses, and we run set_state for the new bundle. Same bundle
  // → same Promise → no duplicate set_state.
  const hydratedBundles = new WeakMap<object, Promise<void>>();

  const getManager = (provider?: CommProvider): Promise<KitManager> => {
    if (managerPromise) {
      if (provider) {
        void managerPromise.then((m) => {
          if (!m.provider) m.provider = provider;
        });
      }
      return managerPromise;
    }
    managerPromise = import('./runtime').then(
      ({ KitManager }) => new KitManager({ loader: opts.loader, provider }),
    );
    return managerPromise;
  };

  const ensureHydrated = (
    nb: Ipynb,
    mgr: Promise<KitManager>,
  ): Promise<void> => {
    const bundle = readEmbeddedState(nb);
    if (!bundle) return Promise.resolve();
    const existing = hydratedBundles.get(bundle);
    if (existing) return existing;
    const p = (async () => {
      try {
        const m = await mgr;
        await m
          .set_state(bundle as never)
          .catch((err) => console.warn('[jupyter-kit/widgets] set_state failed:', err));
      } catch (err) {
        console.warn('[jupyter-kit/widgets] set_state threw:', err);
      }
    })();
    hydratedBundles.set(bundle, p);
    return p;
  };

  return {
    name: '@jupyter-kit/widgets',

    setup(ctx: RuntimeContext) {
      const provider = ctx.executor?.commProvider;
      const mgrPromise = getManager(provider);

      if (provider) {
        commUnsub = provider.onCommOpen(WIDGET_TARGET, (comm, msg) => {
          void mgrPromise.then((m) => {
            m.handle_comm_open(comm as never, msg as never).catch((err) => {
              console.error('[jupyter-kit/widgets] handle_comm_open failed:', err);
            });
          });
        });
      }

      // Kick off hydration for the initial notebook — renderOutput re-checks
      // via the WeakMap, so this is just a warm-up; no harm if the bundle
      // changes before any output renders.
      void ensureHydrated(ctx.notebook(), mgrPromise);
    },

    renderOutput(output: OutputType, slot: HTMLElement, ctx: RuntimeContext) {
      const data = output.data;
      if (!data) return;
      const raw = data[WIDGET_VIEW_MIME];
      if (!raw) return;

      const modelId = extractModelId(raw);
      if (!modelId) return;

      const host = document.createElement('div');
      host.classList.add('jk-widget-host');
      slot.append(host);

      const run = async () => {
        // Hydrate from the *current* notebook's widget-state so a late-arriving
        // fixture (Pyodide demo dropdown) still registers its models before
        // we look them up.
        const mgrP = managerPromise ?? getManager();
        await ensureHydrated(ctx.notebook(), mgrP);
        const m = await mgrP;
        try {
          const modelP = m.get_model(modelId);
          if (!modelP) {
            host.append(placeholderMessage());
            return;
          }
          const model = await modelP;
          const view = await m.create_view(model, {});
          await m.display_view(view, host);
        } catch (err) {
          // "widget model not found" — the notebook's cached widget-view
          // references a model_id that was never registered in this session
          // (e.g. fixture outputs from a previous kernel). Show a muted
          // placeholder instead of the long FloatSlider(...) repr fallback.
          const msg = err instanceof Error ? err.message : String(err);
          if (/model not found/i.test(msg)) {
            host.append(placeholderMessage());
            return;
          }
          console.error('[jupyter-kit/widgets] render failed:', err, 'modelId:', modelId);
          host.append(fallbackMessage(data));
        }
      };
      void run();

      return true;
    },

    teardown() {
      commUnsub?.();
      commUnsub = null;
      managerPromise = null;
    },
  };
}

// -- internals --------------------------------------------------------------

function extractModelId(view: string | string[] | { model_id?: string }): string | null {
  if (typeof view === 'string') {
    try {
      const obj = JSON.parse(view) as { model_id?: string };
      return obj.model_id ?? null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(view)) {
    return extractModelId(view.join(''));
  }
  return view.model_id ?? null;
}

type WidgetStateBundle = {
  version_major: number;
  version_minor: number;
  state: Record<string, unknown>;
};

function readEmbeddedState(nb: Ipynb): WidgetStateBundle | null {
  const meta = nb.metadata as { widgets?: Record<string, WidgetStateBundle> } | undefined;
  const bundle = meta?.widgets?.[WIDGET_STATE_MIME];
  if (!bundle || typeof bundle !== 'object') return null;
  if (!bundle.state || typeof bundle.state !== 'object') return null;
  return bundle;
}

function placeholderMessage(): HTMLElement {
  // Shown when the notebook's cached widget-view references a model that
  // isn't registered in this session (not-yet-run cell, fixture outputs
  // from a different kernel). Communicates "a widget goes here — run the
  // cell to render it" without dumping the widget's multi-line repr.
  const el = document.createElement('div');
  el.className = 'jk-widget-placeholder';
  el.textContent = '[widget — run the cell to render]';
  el.style.opacity = '0.5';
  el.style.fontStyle = 'italic';
  el.style.fontSize = '0.9em';
  return el;
}

function fallbackMessage(data: NonNullable<OutputType['data']>): HTMLElement {
  // Jupyter convention: `text/plain` in the same bundle is the fallback
  // representation for renderers that can't show the primary MIME.
  const plain = data['text/plain'];
  const el = document.createElement('pre');
  el.className = 'jk-widget-fallback';
  el.textContent = Array.isArray(plain)
    ? plain.join('')
    : typeof plain === 'string'
    ? plain
    : '[widget]';
  return el;
}

// Re-exported so plugin-users can take custom actions on comm messages.
export type { CommProvider, CommMsg, CommOpenMsg };

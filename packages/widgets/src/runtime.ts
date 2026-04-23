import type { CommProvider } from '@jupyter-kit/comm';

// Order matters and is enforced by ES module post-order across separate
// files (within a single file all `import`s hoist together):
//   1. jquery-shim     — sets `globalThis.jQuery` from jquery.
//   2. jquery-ui-shim  — imports jquery-ui, whose UMD wrapper now finds
//                        the global from step 1 and registers `$.ui.*`
//                        (mouse, slider, ...).
//   3. html-manager    — @jupyter-widgets/controls' slider widget
//                        constructs successfully because `$.ui.mouse`
//                        already exists.
// Inlining any of these into a single file collapses the ordering — the
// imports hoist together and the body code that bridges them runs too late.
import './jquery-shim';
import './jquery-ui-shim';
import { HTMLManager } from '@jupyter-widgets/html-manager';

// Widget CSS is shipped with `@jupyter-widgets/controls` but html-manager only
// `require()`s it at loadClass time — which Vite's client build doesn't always
// honour as a CSS import. Load it statically here so the stylesheet is
// guaranteed to be in the DOM before any widget renders. Without this, VBox /
// sliders attach to the document with 0 visible dimensions.
//
// Load order matters:
//   1. labvariables.css   — JupyterLab-level `--jp-*` vars (layout/color)
//   2. widgets-base.css   — widget-specific `--jp-widgets-*` vars (sizes,
//                           e.g. `--jp-widgets-inline-height: 28px`). Omit
//                           this and slider-container height / handle-size
//                           lookups silently fail, leaving the track
//                           stuck to the top of its row.
//   3. widgets.built.css  — the actual `.widget-*` class rules that consume
//                           those vars.
import '@jupyter-widgets/controls/css/labvariables.css';
import '@jupyter-widgets/controls/css/widgets-base.css';
import '@jupyter-widgets/controls/css/widgets.built.css';

export type RuntimeOptions = {
  loader?: (moduleName: string, moduleVersion: string) => Promise<unknown>;
  provider?: CommProvider;
};

export class KitManager extends HTMLManager {
  provider: CommProvider | undefined;

  constructor(opts: RuntimeOptions) {
    super({ loader: opts.loader as never });
    this.provider = opts.provider;
  }

  override async _create_comm(
    targetName: string,
    modelId?: string,
    data?: unknown,
    metadata?: unknown,
    buffers?: ArrayBuffer[] | ArrayBufferView[],
  ): Promise<unknown> {
    if (!this.provider) {
      // Static-only mode: hand back the no-op stub the base HTMLManager
      // expects. Any `send` is dropped; widgets render but don't round-trip.
      return {
        on_msg: () => undefined,
        on_close: () => undefined,
        close: () => undefined,
        send: () => undefined,
        open: () => undefined,
        comm_id: modelId ?? cryptoRandomId(),
        target_name: targetName,
      };
    }
    const comm = await this.provider.createComm(targetName, modelId);
    // Match the JupyterLab KernelWidgetManager contract — the frontend
    // `_create_comm` caller expects the comm to already be open on the
    // kernel side when opening data is present.
    if (data !== undefined || metadata !== undefined) {
      comm.open(
        data as never,
        undefined,
        metadata as Record<string, unknown> | undefined,
        buffers as ArrayBuffer[] | undefined,
      );
    }
    return comm;
  }

  override _get_comm_info(): Promise<Record<string, { target_name: string }>> {
    if (!this.provider) return Promise.resolve({});
    return this.provider.listComms('jupyter.widget') as Promise<
      Record<string, { target_name: string }>
    >;
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

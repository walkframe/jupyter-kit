import type { Executor, OutputType } from '@jupyter-kit/core';

export type WebRStatus =
  | 'idle'
  | 'loading'
  | 'installing'
  | 'running'
  | 'ready'
  | 'error';

export type WebRExecutorOptions = {
  /**
   * URL prefix for WebR's worker / WASM assets, or an ordered fallback
   * list. When an array is supplied each entry is tried in turn; the
   * first one whose `init()` succeeds wins. Default: a single
   * `webr.r-wasm.org/latest/` URL. Pin a specific version (e.g.
   * `https://cdn.jsdelivr.net/npm/@r-wasm/webr@0.5.4/dist/`) for
   * stability and supply an array `[primary, backup]` for redundancy.
   */
  src?: string | string[];
  /**
   * Per-candidate boot timeout in milliseconds. If `WebR.init()` doesn't
   * resolve within this window the attempt is abandoned and the next
   * fallback in `src` is tried. Default: 10000. Set `0` to disable.
   */
  timeoutMs?: number;
  /** R packages to install via webr_install before any cell runs. */
  packages?: string[];
  /** Status callback. */
  onStatus?: (status: WebRStatus, detail?: string) => void;
};

const DEFAULT_BASE_URL = 'https://webr.r-wasm.org/latest/';

type CapturedItem = { type: 'stdout' | 'stderr' | 'message'; data: string };

type ImageLike = ImageBitmap | OffscreenCanvas | HTMLCanvasElement;

type CaptureROptions = {
  captureStreams?: boolean;
  captureConditions?: boolean;
  captureGraphics?: boolean | { width?: number; height?: number };
  withAutoprint?: boolean;
};

type WebRInstance = {
  init(): Promise<void>;
  installPackages(pkgs: string[], opts?: { mount?: boolean }): Promise<void>;
  Shelter: new () => Promise<{
    captureR(
      code: string,
      opts?: CaptureROptions,
    ): Promise<{
      output: CapturedItem[];
      result: { toString(opts?: unknown): Promise<string> };
      images?: ImageLike[];
    }>;
    purge(): Promise<void>;
  }>;
};

/**
 * Browser R executor backed by WebR. WebR ships its own dedicated worker, so
 * we run the JS-side wrapper on the main thread — heavy R execution still
 * happens off-thread inside WebR's worker.
 */
export function createWebRExecutor(
  opts: WebRExecutorOptions = {},
): Executor {
  const srcs = normaliseSrcs(opts.src);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let webr: WebRInstance | null = null;
  let bootPromise: Promise<WebRInstance> | null = null;

  const ensureBoot = (): Promise<WebRInstance> => {
    if (webr) return Promise.resolve(webr);
    if (!bootPromise) {
      bootPromise = (async () => {
        opts.onStatus?.('loading');
        // @r-wasm/webr's package.json `exports` field doesn't ship types for
        // the entry it serves; cast through `unknown` so the dynamic import
        // typechecks against our local interface.
        const mod = (await import(
          /* @vite-ignore */ 'webr'
        )) as unknown as {
          WebR: new (cfg: { baseURL: string }) => WebRInstance;
        };

        // Try each src in order until init() resolves. WebR doesn't
        // expose a way to cancel an in-flight init, so a timeout simply
        // abandons the promise (the WebR worker may keep running in the
        // background until GC — acceptable tradeoff for avoiding a hang).
        const errors: string[] = [];
        let wr: WebRInstance | null = null;
        for (const src of srcs) {
          try {
            // WebR's own constructor still takes `baseURL` — we only
            // expose it as `src` externally for consistency across our
            // CDN-loading packages.
            const candidate = new mod.WebR({ baseURL: src });
            const init = candidate.init();
            await (timeoutMs > 0
              ? Promise.race([
                  init,
                  new Promise<never>((_, rej) =>
                    setTimeout(
                      () => rej(new Error(`webr init timeout (${timeoutMs}ms)`)),
                      timeoutMs,
                    ),
                  ),
                ])
              : init);
            wr = candidate;
            break;
          } catch (err) {
            errors.push(`${src}: ${(err as { message?: string })?.message ?? err}`);
          }
        }
        if (!wr) throw new Error(`all webr src candidates failed:\n${errors.join('\n')}`);

        if (opts.packages?.length) {
          opts.onStatus?.('installing', opts.packages.join(', '));
          await wr.installPackages(opts.packages);
        }
        webr = wr;
        opts.onStatus?.('ready');
        return wr;
      })().catch((err) => {
        opts.onStatus?.('error', String(err));
        bootPromise = null;
        throw err;
      });
    }
    return bootPromise;
  };

  return {
    async execute(source, language, signal): Promise<OutputType[]> {
      if (signal?.aborted) return [];
      if (!isR(language)) {
        return [makeError('LanguageError', `webr cannot run language: ${language}`)];
      }

      const wr = await ensureBoot();
      if (signal?.aborted) return [];

      opts.onStatus?.('running');
      const outputs: OutputType[] = [];
      // Shelter scopes the lifecycle of R objects so they can be freed in one
      // shot at the end (avoids leaking R memory across cells).
      const shelter = await new wr.Shelter();
      try {
        // `withAutoprint: true` makes WebR run the code REPL-style — bare
        // expressions get printed to stdout via R's `print()` so we capture
        // properly formatted values (`[1] 3`) rather than the JS-side
        // `[object RObject:double]` toString.
        const result = await shelter.captureR(source, {
          captureStreams: true,
          captureConditions: true,
          captureGraphics: true,
          withAutoprint: true,
        });

        // Coalesce contiguous stdout/stderr chunks into single stream outputs
        // (matches Jupyter's interleaving — see executor-pyodide for the
        // same logic).
        let currentName: 'stdout' | 'stderr' | null = null;
        let buffer: string[] = [];
        const flush = () => {
          if (!currentName || !buffer.length) return;
          outputs.push({
            output_type: 'stream',
            name: currentName,
            text: [buffer.join('') + (buffer[buffer.length - 1].endsWith('\n') ? '' : '\n')],
          });
          buffer = [];
          currentName = null;
        };
        for (const item of result.output) {
          const stream =
            item.type === 'stdout' ? 'stdout' : item.type === 'stderr' ? 'stderr' : null;
          if (!stream) continue;
          if (currentName && currentName !== stream) flush();
          currentName = stream;
          buffer.push(item.data + '\n');
        }
        flush();

        // Graphics: WebR returns one entry per `plot()` call as ImageBitmap
        // (or OffscreenCanvas). Convert each to a PNG data URL so it lives
        // inside `image/png` like matplotlib output from pyodide.
        if (result.images?.length) {
          for (const img of result.images) {
            const png = await imageToPngBase64(img);
            if (png) {
              outputs.push({
                output_type: 'display_data',
                data: { 'image/png': png, 'text/plain': ['<R plot>'] },
              });
            }
          }
        }
      } catch (err) {
        outputs.push(toErrorOutput(err));
      } finally {
        try {
          await shelter.purge();
        } catch {
          /* ignore */
        }
        opts.onStatus?.('ready');
      }
      return outputs;
    },
  };
}

// -- graphics ---------------------------------------------------------------

async function imageToPngBase64(
  img: ImageBitmap | OffscreenCanvas | HTMLCanvasElement,
): Promise<string | null> {
  try {
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if ('drawImage' in (img as object)) {
      // Already a canvas — reuse.
      canvas = img as HTMLCanvasElement | OffscreenCanvas;
    } else {
      const bitmap = img as ImageBitmap;
      canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(bitmap.width, bitmap.height)
          : Object.assign(document.createElement('canvas'), {
              width: bitmap.width,
              height: bitmap.height,
            });
      const ctx = canvas.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
    }
    const blob =
      canvas instanceof OffscreenCanvas
        ? await canvas.convertToBlob({ type: 'image/png' })
        : await new Promise<Blob | null>((resolve) =>
            (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png'),
          );
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    return arrayBufferToBase64(buf);
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Avoid the spread-into-fromCharCode trick (stack overflow on big images);
  // chunk the conversion.
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + chunk, bytes.length))),
    );
  }
  return btoa(s);
}

// -- helpers -----------------------------------------------------------------

function normaliseSrcs(src: string | string[] | undefined): string[] {
  if (typeof src === 'string') return [src];
  if (Array.isArray(src) && src.length) return src;
  return [DEFAULT_BASE_URL];
}

function isR(language: string): boolean {
  return language === 'r' || language === 'R';
}

function toErrorOutput(err: unknown): OutputType {
  const e = err as { name?: string; message?: string };
  const ename = e?.name || 'RError';
  const message = e?.message ?? String(err);
  return {
    output_type: 'error',
    ename,
    evalue: message,
    traceback: message.split('\n'),
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

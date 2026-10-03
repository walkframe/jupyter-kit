import type { OutputType } from '@jupyter-kit/core';

/** Pure, worker-free helpers for the Pyodide executor. Split out from
 *  `index.ts` so they can be unit-tested without booting a Web Worker. */

export function toArray<T>(v: T | T[] | undefined): T[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

export function deriveIndexURL(src: string): string {
  // `src` is the URL of `pyodide.js`; `indexURL` is the directory
  // containing it (Pyodide appends wheel filenames to this). Strip the
  // trailing filename but keep the trailing slash.
  const slash = src.lastIndexOf('/');
  return slash >= 0 ? src.slice(0, slash + 1) : src;
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function isPython(language: string): boolean {
  return language === 'python' || language === 'py' || language === 'python3';
}

export function normalizeMime(
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
      out[mime] = val;
      continue;
    }
    out[mime] = String(val);
  }
  return out;
}

export function toErrorOutput(err: {
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
  const lastLine =
    (err.traceback && err.traceback[err.traceback.length - 1]) ||
    message.split('\n').pop() ||
    '';
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

export function makeError(ename: string, message: string): OutputType {
  return {
    output_type: 'error',
    ename,
    evalue: message,
    traceback: [`${ename}: ${message}`],
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createPyodideExecutor, type PyodideStatus } from '@jupyter-kit/executor-pyodide';
import { python as pythonEditor } from '@codemirror/lang-python';
import { createKatexCdnPlugin } from '@jupyter-kit/katex-cdn';
import { createWidgetsPlugin } from '@jupyter-kit/widgets';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import lorenz from '@jupyter-kit/fixtures/ipynb/Lorenz';
import widgetsGallery from '@jupyter-kit/fixtures/ipynb/widgets-gallery';

// Theme CSS injected at runtime via ?inline rather than top-level import.
// Top-level imports get bundled into the global page CSS, so a sibling
// demo (e.g. WebRDemo's theme-grade3) ends up cascading over the demo
// that's actually mounted. ?inline keeps the stylesheet inert until we
// drop it into a <style> tag scoped to *this* demo's lifetime.
import chromeMonokai from '@jupyter-kit/theme-monokai/monokai.css?inline';
import syntaxOneDark from '@jupyter-kit/theme-monokai/syntax/one-dark.css?inline';

function useScopedTheme(css: string, styleId: string): void {
  useEffect(() => {
    let node = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!node) {
      node = document.createElement('style');
      node.id = styleId;
      document.head.append(node);
    }
    node.textContent = css;
    return () => {
      // Leave the <style> tag in place — other instances or hot-reloads
      // may rely on it; clearing on unmount would race with the next mount.
    };
  }, [css, styleId]);
}

const FIXTURES: Record<string, unknown> = {
  showcase,
  Lorenz: lorenz,
  'widgets-gallery': widgetsGallery,
};

export default function PyodideDemo() {
  useScopedTheme(chromeMonokai, 'jk-pyodide-chrome');
  useScopedTheme(syntaxOneDark, 'jk-pyodide-syntax');
  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [detail, setDetail] = useState<string | undefined>();
  const [fixture, setFixture] = useState<string>('showcase');
  const [uploaded, setUploaded] = useState<{ name: string; ipynb: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const executor = useMemo(
    () =>
      createPyodideExecutor({
        onStatus: (s, d) => {
          setStatus(s);
          setDetail(d);
        },
        autoloadImports: true,
        // `ipywidgets` is a pyodide-bundled package but `loadPackagesFromImports`
        // won't see it unless `import ipywidgets` appears literally in the cell
        // source (the Lorenz demo writes `from ipywidgets import interactive`,
        // which the scanner catches, but we preload anyway so the comm shim is
        // wired up before any cell runs).
        packages: ['ipywidgets'],
      }),
    [],
  );

  const plugins = useMemo(
    () => [
      createEditorPlugin({ extensions: [pythonEditor()] }),
      createKatexCdnPlugin(),
      createWidgetsPlugin(),
    ],
    [],
  );

  const languages = useMemo(() => [python], []);

  const ipynb = uploaded ? uploaded.ipynb : FIXTURES[fixture];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setUploaded({ name: file.name, ipynb: parsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function clearUpload() {
    setUploaded(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  const selectStyle = {
    height: '30px',
    padding: '0 8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    border: '1px solid var(--sl-color-hairline, rgba(127, 127, 127, 0.35))',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  } as const;
  const labelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    margin: 0,
    fontSize: '13px',
  } as const;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label style={labelStyle}>
          Fixture:
          <select
            value={uploaded ? '' : fixture}
            onChange={(e) => {
              clearUpload();
              setFixture(e.target.value);
            }}
            disabled={!!uploaded}
            style={selectStyle}
          >
            {Object.keys(FIXTURES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Upload .ipynb:
          <input
            ref={fileInput}
            type="file"
            accept=".ipynb,application/json,application/x-ipynb+json"
            onChange={onFile}
            style={{ fontSize: '13px' }}
          />
        </label>
        {uploaded && (
          <button type="button" onClick={clearUpload} style={{ ...selectStyle, padding: '0 12px' }}>
            Clear ({uploaded.name})
          </button>
        )}
      </div>
      {error && (
        <div style={{ marginBottom: '0.5rem', color: 'crimson', fontSize: '0.85rem' }}>
          Failed to load: {error}
        </div>
      )}
      <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
        <strong>Pyodide:</strong> <code>{status}</code>
        {detail ? ` — ${detail}` : ''}
      </div>
      <Notebook
        ipynb={ipynb as never}
        language="python"
        languages={languages}
        executor={executor}
        plugins={plugins}
      />
    </div>
  );
}

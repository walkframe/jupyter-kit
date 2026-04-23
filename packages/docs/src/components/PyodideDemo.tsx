import { useMemo, useRef, useState } from 'react';
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

import '@jupyter-kit/theme-monokai/monokai.css';
import '@jupyter-kit/theme-monokai/syntax/monokai.css';

const FIXTURES: Record<string, unknown> = {
  showcase,
  Lorenz: lorenz,
  'widgets-gallery': widgetsGallery,
};

export default function PyodideDemo() {
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

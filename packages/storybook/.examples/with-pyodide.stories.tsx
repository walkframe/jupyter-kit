import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python as pythonHighlight } from '@jupyter-kit/core/langs/python';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createKatexPlugin } from '@jupyter-kit/katex';
import { createWidgetsPlugin } from '@jupyter-kit/widgets';
import {
  createPyodideExecutor,
  type PyodideStatus,
} from '@jupyter-kit/executor-pyodide';
import { python as pythonEditor } from '@codemirror/lang-python';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import lorenz from '@jupyter-kit/fixtures/ipynb/Lorenz';
import widgetsGallery from '@jupyter-kit/fixtures/ipynb/widgets-gallery';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';
import 'katex/dist/katex.min.css';

const FIXTURES: Record<string, unknown> = {
  showcase,
  Lorenz: lorenz,
  'widgets-gallery': widgetsGallery,
};

const meta: Meta = {
  title: 'Executor / Pyodide',
  component: Notebook,
};
export default meta;

const Template = (preinstall: string[] = []) =>
  function Story() {
    const [status, setStatus] = useState<PyodideStatus>('idle');
    const [fixture, setFixture] = useState<string>('showcase');
    const executor = useMemo(
      () =>
        createPyodideExecutor({
          // `ipywidgets` is a pyodide-bundled package but `loadPackagesFromImports`
          // only sees it when `import ipywidgets` appears literally in the cell
          // source (the widgets-gallery fixture writes `from ipywidgets import ...`,
          // and the scanner catches that — but we preload anyway so the comm shim
          // is wired up before any cell runs).
          packages: ['ipywidgets', ...preinstall],
          autoloadImports: true,
          onStatus: setStatus,
        }),
      [],
    );
    const plugins = useMemo(
      () => [
        createKatexPlugin(),
        createWidgetsPlugin(),
        createEditorPlugin({ languages: { python: pythonEditor() } }),
      ],
      [],
    );
    return (
      <div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          <label>
            fixture:{' '}
            <select
              value={fixture}
              onChange={(e) => setFixture(e.target.value)}
              style={{ fontFamily: 'inherit', fontSize: 12 }}
            >
              {Object.keys(FIXTURES).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <span style={{ opacity: 0.7 }}>pyodide: {status}</span>
        </div>
        <Notebook
          ipynb={FIXTURES[fixture] as never}
          language="python"
          languages={[pythonHighlight]}
          plugins={plugins}
          executor={executor}
        />
      </div>
    );
  };

export const Default: StoryObj = { render: Template() };
export const PreloadedPandasMatplotlib: StoryObj = {
  render: Template(['pandas', 'matplotlib']),
};

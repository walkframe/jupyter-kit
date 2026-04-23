import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python as pythonHighlight } from '@jupyter-kit/core/langs/python';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createKatexPlugin } from '@jupyter-kit/katex';
import {
  createPyodideExecutor,
  type PyodideStatus,
} from '@jupyter-kit/executor-pyodide';
import { python as pythonEditor } from '@codemirror/lang-python';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';
import 'katex/dist/katex.min.css';

const meta: Meta = {
  title: 'Executor / Pyodide',
  component: Notebook,
};
export default meta;

const Template = (preinstall: string[] = []) =>
  function Story() {
    const [status, setStatus] = useState<PyodideStatus>('idle');
    const executor = useMemo(
      () =>
        createPyodideExecutor({
          packages: preinstall,
          autoloadImports: true,
          onStatus: setStatus,
        }),
      [],
    );
    const plugins = useMemo(
      () => [
        createKatexPlugin(),
        createEditorPlugin({ languages: { python: pythonEditor() } }),
      ],
      [],
    );
    return (
      <div>
        <div
          style={{
            padding: '8px 12px',
            fontFamily: 'monospace',
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          pyodide: {status}
        </div>
        <Notebook
          ipynb={showcase as never}
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

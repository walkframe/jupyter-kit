import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python as pythonHighlight } from '@jupyter-kit/core/langs/python';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createKatexPlugin } from '@jupyter-kit/katex';
import { createMathjaxPlugin } from '@jupyter-kit/mathjax';
import {
  createPyodideExecutor,
  type PyodideStatus,
} from '@jupyter-kit/executor-pyodide';
import { python as pythonEditor } from '@codemirror/lang-python';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';
import 'katex/dist/katex.min.css';

const meta: Meta<typeof Notebook> = {
  title: 'Showcase',
  component: Notebook,
};
export default meta;

type Story = StoryObj<typeof Notebook>;

/**
 * Full-featured view: everything the renderer and plugins support, rendered
 * from `.examples/ipynb/showcase.json` — markdown, math, code highlighting,
 * HTML / DataFrame / LaTeX / matplotlib outputs, and an ANSI-styled error.
 */
export const ReadOnly: Story = {
  render: () => (
    <Notebook
      ipynb={showcase as never}
      language="python"
      languages={[pythonHighlight]}
      plugins={[createKatexPlugin()]}
    />
  ),
};

/**
 * Same notebook, but editable with pyodide running cells in a Web Worker.
 * Hover a code cell and click ▶ (or press Shift+Enter) to run. First run
 * downloads pyodide (~10MB) plus any packages the cell imports.
 */
export const Runnable: Story = {
  render: () => {
    const [status, setStatus] = useState<PyodideStatus>('idle');
    const executor = useMemo(
      () =>
        createPyodideExecutor({
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
          pyodide: {status} — ▶ runs (Shift+Enter), Cmd/Ctrl+S downloads as showcase.ipynb
        </div>
        <Notebook
          ipynb={showcase as never}
          language="python"
          languages={[pythonHighlight]}
          plugins={plugins}
          executor={executor}
          filename="showcase.ipynb"
        />
      </div>
    );
  },
};

/** MathJax variant (bundled) for comparison with KaTeX. */
export const ReadOnlyWithMathjax: Story = {
  render: () => (
    <Notebook
      ipynb={showcase as never}
      language="python"
      languages={[pythonHighlight]}
      plugins={[createMathjaxPlugin()]}
    />
  ),
};

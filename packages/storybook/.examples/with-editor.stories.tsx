import { useEffect, useMemo, useState } from 'react';
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

// `?inline` so we can swap the theme in/out via a <style> tag and not pollute
// the other stories with dorkula's rules.
import dorkulaCss from '@jupyter-kit/theme-dorkula/dorkula.css?inline';

const meta: Meta = {
  title: 'Editor / CodeMirror',
  component: Notebook,
};
export default meta;

const STYLE_ID = 'ipynb-editor-story-theme';

function useThemeOverride(css: string | null) {
  useEffect(() => {
    if (!css) return;
    let node = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!node) {
      node = document.createElement('style');
      node.id = STYLE_ID;
      document.head.append(node);
    }
    node.textContent = css;
    return () => {
      if (node) node.textContent = '';
    };
  }, [css]);
}

const ReadOnlyTemplate = () => {
  useThemeOverride(null);
  const plugins = useMemo(
    () => [
      createKatexPlugin(),
      createEditorPlugin({
        languages: { python: pythonEditor() },
        readOnly: true,
      }),
    ],
    [],
  );
  return (
    <Notebook
      ipynb={showcase as never}
      language="python"
      languages={[pythonHighlight]}
      plugins={plugins}
    />
  );
};

const buildEditableTemplate = (themeCss: string | null) => () => {
  useThemeOverride(themeCss);
  const [status, setStatus] = useState<PyodideStatus>('idle');
  const executor = useMemo(
    () => createPyodideExecutor({ onStatus: setStatus, autoloadImports: true }),
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
        pyodide: {status} — hover a cell and click ▶, or press Shift+Enter
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

export const ReadOnly: StoryObj = { render: ReadOnlyTemplate };
export const Editable: StoryObj = { render: buildEditableTemplate(null) };
export const Editable2: StoryObj = { render: buildEditableTemplate(dorkulaCss) };

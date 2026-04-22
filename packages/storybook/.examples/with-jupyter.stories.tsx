import { useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python as pythonHighlight } from '@jupyter-kit/core/langs/python';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createKatexPlugin } from '@jupyter-kit/katex';
import {
  createJupyterExecutor,
  type JupyterStatus,
} from '@jupyter-kit/executor-jupyter';
import { python as pythonEditor } from '@codemirror/lang-python';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';
import 'katex/dist/katex.min.css';

const meta: Meta = {
  title: 'Executor / Jupyter (remote kernel)',
  component: Notebook,
};
export default meta;

type Executor = ReturnType<typeof createJupyterExecutor>;

const inputStyle = {
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontFamily: 'monospace',
  fontSize: 12,
} as const;

function Story() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:8888');
  const [token, setToken] = useState('');
  const [kernelName, setKernelName] = useState('python3');
  const [status, setStatus] = useState<JupyterStatus>('idle');
  const [executor, setExecutor] = useState<Executor | null>(null);
  const prevRef = useRef<Executor | null>(null);

  const plugins = useMemo(
    () => [
      createKatexPlugin(),
      createEditorPlugin({ languages: { python: pythonEditor() } }),
    ],
    [],
  );

  const connect = async () => {
    // Dispose any prior session before creating a new one.
    prevRef.current?.dispose().catch(() => {});
    const exec = createJupyterExecutor({
      baseUrl,
      token: token || undefined,
      kernelName,
      onStatus: setStatus,
    });
    prevRef.current = exec;
    setExecutor(exec);
    // Empty execute warms up the connection: starts the kernel + opens the WS
    // immediately so status indicators update before the user runs a cell.
    try {
      await exec.execute('', kernelName.includes('python') ? 'python' : '');
    } catch {
      /* status already reflects the error */
    }
  };

  const disconnect = () => {
    prevRef.current?.dispose().catch(() => {});
    prevRef.current = null;
    setExecutor(null);
    setStatus('idle');
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: 12,
          background: '#f6f6f6',
          borderBottom: '1px solid #ddd',
          fontSize: 12,
        }}
      >
        <label>
          <div style={{ opacity: 0.7 }}>baseUrl</div>
          <input
            style={{ ...inputStyle, width: 240 }}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:8888"
          />
        </label>
        <label>
          <div style={{ opacity: 0.7 }}>token</div>
          <input
            style={{ ...inputStyle, width: 260 }}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="(leave empty if server has no token)"
            type="password"
          />
        </label>
        <label>
          <div style={{ opacity: 0.7 }}>kernelName</div>
          <input
            style={{ ...inputStyle, width: 120 }}
            value={kernelName}
            onChange={(e) => setKernelName(e.target.value)}
          />
        </label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
          <button type="button" onClick={connect} style={{ padding: '4px 12px' }}>
            {executor ? 'reconnect' : 'connect'}
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={!executor}
            style={{ padding: '4px 12px' }}
          >
            disconnect
          </button>
          <span
            style={{
              marginLeft: 12,
              fontFamily: 'monospace',
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 4,
            }}
          >
            jupyter: {status}
          </span>
        </div>
      </div>
      <Notebook
        ipynb={showcase as never}
        language="python"
        languages={[pythonHighlight]}
        plugins={plugins}
        executor={executor ?? undefined}
      />
    </div>
  );
}

export const Default: StoryObj = { render: () => <Story /> };

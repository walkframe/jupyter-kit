import { useMemo, useState } from 'react';
import { Notebook } from '@jupyter-kit/react';
import { r as rLang } from '@jupyter-kit/core/langs/r';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createWebRExecutor, type WebRStatus } from '@jupyter-kit/executor-webr';
import { StreamLanguage } from '@codemirror/language';
import { r as rEditor } from '@codemirror/legacy-modes/mode/r';

import rDemo from '@jupyter-kit/fixtures/ipynb/r';

import '@jupyter-kit/theme-grade3/grade3.css';
import '@jupyter-kit/theme-grade3/syntax/one-dark.css';

export default function WebRDemo() {
  const [status, setStatus] = useState<WebRStatus>('idle');
  const [detail, setDetail] = useState<string | undefined>();

  const executor = useMemo(
    () =>
      createWebRExecutor({
        onStatus: (s, d) => {
          setStatus(s);
          setDetail(d);
        },
      }),
    [],
  );

  const plugins = useMemo(
    () => [createEditorPlugin({ extensions: [StreamLanguage.define(rEditor)] })],
    [],
  );

  const languages = useMemo(() => [rLang], []);

  return (
    <div>
      <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
        <strong>WebR:</strong> <code>{status}</code>
        {detail ? ` — ${detail}` : ''}
      </div>
      <Notebook
        ipynb={rDemo as never}
        language="r"
        languages={languages}
        executor={executor}
        plugins={plugins}
      />
    </div>
  );
}

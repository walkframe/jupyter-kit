import { useEffect, useMemo, useState } from 'react';
import { Notebook } from '@jupyter-kit/react';
import { r as rLang } from '@jupyter-kit/core/langs/r';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import { createWebRExecutor, type WebRStatus } from '@jupyter-kit/executor-webr';
import { StreamLanguage } from '@codemirror/language';
import { r as rEditor } from '@codemirror/legacy-modes/mode/r';

import rDemo from '@jupyter-kit/fixtures/ipynb/r';

// Theme CSS injected at runtime via ?inline rather than top-level import.
// Top-level imports get bundled into the global page CSS, so a sibling
// demo (e.g. PyodideDemo's theme-monokai) ends up cascading over the demo
// that's actually mounted. ?inline keeps the stylesheet inert until we
// drop it into a <style> tag scoped to *this* demo's lifetime.
import chromeGrade3 from '@jupyter-kit/theme-grade3/grade3.css?inline';
import syntaxOneDark from '@jupyter-kit/theme-grade3/syntax/one-dark.css?inline';

function useScopedTheme(css: string, styleId: string): void {
  useEffect(() => {
    let node = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!node) {
      node = document.createElement('style');
      node.id = styleId;
      document.head.append(node);
    }
    node.textContent = css;
  }, [css, styleId]);
}

export default function WebRDemo() {
  useScopedTheme(chromeGrade3, 'jk-webr-chrome');
  useScopedTheme(syntaxOneDark, 'jk-webr-syntax');
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

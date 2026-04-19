import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { r as rHighlight } from '@jupyter-kit/core/langs/r';
import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';
import {
  createWebRExecutor,
  type WebRStatus,
} from '@jupyter-kit/executor-webr';
import { StreamLanguage } from '@codemirror/language';
import { r as rEditorMode } from '@codemirror/legacy-modes/mode/r';

import rDemo from '@jupyter-kit/fixtures/ipynb/r';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';

// `?inline` so we can swap the theme in/out per story without leaking rules
// into siblings that only want the default theme.
import gruvboxdCss from '@jupyter-kit/theme-gruvboxd/gruvboxd.css?inline';

const meta: Meta = {
  title: 'Executor / WebR',
  component: Notebook,
};
export default meta;

const STYLE_ID = 'ipynb-webr-story-theme';
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

const buildTemplate = (themeCss: string | null) => () => {
  useThemeOverride(themeCss);
  const [status, setStatus] = useState<WebRStatus>('idle');
  const executor = useMemo(
    () => createWebRExecutor({ onStatus: setStatus }),
    [],
  );
  const editorR = useMemo(() => StreamLanguage.define(rEditorMode), []);
  const plugins = useMemo(
    () => [createEditorPlugin({ languages: { r: editorR } })],
    [editorR],
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
        webr: {status} — first run downloads the R runtime (~30MB)
      </div>
      <Notebook
        ipynb={rDemo as never}
        language="r"
        languages={[rHighlight]}
        plugins={plugins}
        executor={executor}
        filename="r-demo.ipynb"
      />
    </div>
  );
};

export const Default: StoryObj = { render: buildTemplate(null) };
export const WithGruvboxd: StoryObj = { render: buildTemplate(gruvboxdCss) };

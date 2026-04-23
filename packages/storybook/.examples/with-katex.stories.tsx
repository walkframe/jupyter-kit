import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';
import { createKatexCdnPlugin } from '@jupyter-kit/katex-cdn';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';
import 'katex/dist/katex.min.css';

const meta: Meta = {
  title: 'Math / KaTeX',
  component: Notebook,
};
export default meta;

export const Bundled: StoryObj = {
  render: () => {
    const plugins = useMemo(() => [createKatexPlugin()], []);
    return (
      <Notebook
        ipynb={showcase as never}
        language="python"
        languages={[python]}
        plugins={plugins}
      />
    );
  },
};

export const Cdn: StoryObj = {
  render: () => {
    const plugins = useMemo(() => [createKatexCdnPlugin()], []);
    return (
      <Notebook
        ipynb={showcase as never}
        language="python"
        languages={[python]}
        plugins={plugins}
      />
    );
  },
};

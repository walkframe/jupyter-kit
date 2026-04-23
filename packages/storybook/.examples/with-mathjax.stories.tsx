import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createMathjaxPlugin } from '@jupyter-kit/mathjax';
import { createMathjaxCdnPlugin } from '@jupyter-kit/mathjax-cdn';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';

const meta: Meta = {
  title: 'Math / MathJax',
  component: Notebook,
};
export default meta;

export const Bundled: StoryObj = {
  render: () => {
    const plugins = useMemo(() => [createMathjaxPlugin()], []);
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
    const plugins = useMemo(() => [createMathjaxCdnPlugin()], []);
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

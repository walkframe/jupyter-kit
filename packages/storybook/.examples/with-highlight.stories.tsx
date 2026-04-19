import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import '@jupyter-kit/theme-default/default.css';
import 'katex/dist/katex.min.css';

const meta: Meta = {
  title: 'Highlight / Lezer (Python)',
  component: Notebook,
};
export default meta;

type Args = { syntax: string };

const SYNTAX_THEMES: Record<string, () => Promise<unknown>> = {
  'one-dark': () => import('@jupyter-kit/theme-default/syntax/one-dark.css'),
  'one-light': () => import('@jupyter-kit/theme-default/syntax/one-light.css'),
  monokai: () => import('@jupyter-kit/theme-default/syntax/monokai.css'),
  'vsc-dark-plus': () => import('@jupyter-kit/theme-default/syntax/vsc-dark-plus.css'),
  'github-light': () => import('@jupyter-kit/theme-default/syntax/github-light.css'),
  'solarized-dark': () => import('@jupyter-kit/theme-default/syntax/solarized-dark.css'),
  'solarized-light': () => import('@jupyter-kit/theme-default/syntax/solarized-light.css'),
  dracula: () => import('@jupyter-kit/theme-default/syntax/dracula.css'),
};

const Template = (args: Args) => {
  void SYNTAX_THEMES[args.syntax]?.();
  const plugins = useMemo(() => [createKatexPlugin()], []);
  return (
    <Notebook
      ipynb={showcase as never}
      language="python"
      languages={[python]}
      plugins={plugins}
    />
  );
};

export const OneDark: StoryObj<Args> = { render: Template, args: { syntax: 'one-dark' } };
export const OneLight: StoryObj<Args> = { render: Template, args: { syntax: 'one-light' } };
export const Monokai: StoryObj<Args> = { render: Template, args: { syntax: 'monokai' } };
export const VscDarkPlus: StoryObj<Args> = { render: Template, args: { syntax: 'vsc-dark-plus' } };
export const GithubLight: StoryObj<Args> = { render: Template, args: { syntax: 'github-light' } };
export const SolarizedDark: StoryObj<Args> = { render: Template, args: { syntax: 'solarized-dark' } };
export const SolarizedLight: StoryObj<Args> = { render: Template, args: { syntax: 'solarized-light' } };
export const Dracula: StoryObj<Args> = { render: Template, args: { syntax: 'dracula' } };

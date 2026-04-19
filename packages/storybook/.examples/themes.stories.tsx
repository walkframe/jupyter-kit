import { useEffect, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';
import 'katex/dist/katex.min.css';

// Vite `?inline` fetches CSS as a string so we can swap <style> elements
// cleanly when the story changes — dynamic `import('./x.css')` stacks up and
// later styles leak into earlier stories.
import defaultCss from '@jupyter-kit/theme-default/default.css?inline';
import darkCss from '@jupyter-kit/theme-dark/dark.css?inline';
import monokaiCss from '@jupyter-kit/theme-monokai/monokai.css?inline';
import onedorkCss from '@jupyter-kit/theme-onedork/onedork.css?inline';
import solarizeddCss from '@jupyter-kit/theme-solarizedd/solarizedd.css?inline';
import solarizedlCss from '@jupyter-kit/theme-solarizedl/solarizedl.css?inline';
import chesterishCss from '@jupyter-kit/theme-chesterish/chesterish.css?inline';
import grade3Css from '@jupyter-kit/theme-grade3/grade3.css?inline';
import gruvboxdCss from '@jupyter-kit/theme-gruvboxd/gruvboxd.css?inline';
import gruvboxlCss from '@jupyter-kit/theme-gruvboxl/gruvboxl.css?inline';
import oceans16Css from '@jupyter-kit/theme-oceans16/oceans16.css?inline';
import dorkulaCss from '@jupyter-kit/theme-dorkula/dorkula.css?inline';
import darkbroncoCss from '@jupyter-kit/theme-darkbronco/darkbronco.css?inline';

const THEMES: Record<string, string> = {
  default: defaultCss,
  dark: darkCss,
  monokai: monokaiCss,
  onedork: onedorkCss,
  solarizedd: solarizeddCss,
  solarizedl: solarizedlCss,
  chesterish: chesterishCss,
  grade3: grade3Css,
  gruvboxd: gruvboxdCss,
  gruvboxl: gruvboxlCss,
  oceans16: oceans16Css,
  dorkula: dorkulaCss,
  darkbronco: darkbroncoCss,
};

const STYLE_ID = 'ipynb-theme-story';

function useTheme(name: string) {
  useEffect(() => {
    const css = THEMES[name];
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
  }, [name]);
}

const meta: Meta = {
  title: 'Themes / notebook chrome',
  component: Notebook,
};
export default meta;

type Args = { theme: string };

const Template = (args: Args) => {
  useTheme(args.theme);
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

export const Default: StoryObj<Args> = { render: Template, args: { theme: 'default' } };
export const Dark: StoryObj<Args> = { render: Template, args: { theme: 'dark' } };
export const Monokai: StoryObj<Args> = { render: Template, args: { theme: 'monokai' } };
export const Onedork: StoryObj<Args> = { render: Template, args: { theme: 'onedork' } };
export const SolarizedDark: StoryObj<Args> = { render: Template, args: { theme: 'solarizedd' } };
export const SolarizedLight: StoryObj<Args> = { render: Template, args: { theme: 'solarizedl' } };
export const Chesterish: StoryObj<Args> = { render: Template, args: { theme: 'chesterish' } };
export const Grade3: StoryObj<Args> = { render: Template, args: { theme: 'grade3' } };
export const Gruvboxd: StoryObj<Args> = { render: Template, args: { theme: 'gruvboxd' } };
export const Gruvboxl: StoryObj<Args> = { render: Template, args: { theme: 'gruvboxl' } };
export const Oceans16: StoryObj<Args> = { render: Template, args: { theme: 'oceans16' } };
export const Dorkula: StoryObj<Args> = { render: Template, args: { theme: 'dorkula' } };
export const Darkbronco: StoryObj<Args> = { render: Template, args: { theme: 'darkbronco' } };

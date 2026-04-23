import { useEffect, useMemo, useState } from 'react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexCdnPlugin } from '@jupyter-kit/katex-cdn';
import { createMathjaxCdnPlugin } from '@jupyter-kit/mathjax-cdn';

import showcase from '@jupyter-kit/fixtures/ipynb/showcase';

// `?inline` pulls each theme in as a string so we can swap them at runtime by
// rewriting the contents of a single <style> tag. This avoids the style-sheet
// precedence issues that come from leaving both themes mounted at once.
import defaultTheme from '@jupyter-kit/theme-default/default.css?inline';
import darkTheme from '@jupyter-kit/theme-dark/dark.css?inline';
import darkbroncoTheme from '@jupyter-kit/theme-darkbronco/darkbronco.css?inline';
import monokaiTheme from '@jupyter-kit/theme-monokai/monokai.css?inline';
import solarizedLightTheme from '@jupyter-kit/theme-solarizedl/solarizedl.css?inline';
import solarizedDarkTheme from '@jupyter-kit/theme-solarizedd/solarizedd.css?inline';
import chesterishTheme from '@jupyter-kit/theme-chesterish/chesterish.css?inline';
import dorkulaTheme from '@jupyter-kit/theme-dorkula/dorkula.css?inline';
import grade3Theme from '@jupyter-kit/theme-grade3/grade3.css?inline';
import gruvboxdTheme from '@jupyter-kit/theme-gruvboxd/gruvboxd.css?inline';
import gruvboxlTheme from '@jupyter-kit/theme-gruvboxl/gruvboxl.css?inline';
import oceans16Theme from '@jupyter-kit/theme-oceans16/oceans16.css?inline';
import onedorkTheme from '@jupyter-kit/theme-onedork/onedork.css?inline';
import draculaSyntax from '@jupyter-kit/theme-default/syntax/dracula.css?inline';
import githubLightSyntax from '@jupyter-kit/theme-default/syntax/github-light.css?inline';
import monokaiSyntax from '@jupyter-kit/theme-default/syntax/monokai.css?inline';
import oneDarkSyntax from '@jupyter-kit/theme-default/syntax/one-dark.css?inline';
import oneLightSyntax from '@jupyter-kit/theme-default/syntax/one-light.css?inline';
import solarizedDarkSyntax from '@jupyter-kit/theme-default/syntax/solarized-dark.css?inline';
import solarizedLightSyntax from '@jupyter-kit/theme-default/syntax/solarized-light.css?inline';
import vscDarkPlusSyntax from '@jupyter-kit/theme-default/syntax/vsc-dark-plus.css?inline';

const CHROMES: Record<string, string> = {
  default: defaultTheme,
  dark: darkTheme,
  darkbronco: darkbroncoTheme,
  monokai: monokaiTheme,
  solarizedl: solarizedLightTheme,
  solarizedd: solarizedDarkTheme,
  chesterish: chesterishTheme,
  dorkula: dorkulaTheme,
  grade3: grade3Theme,
  gruvboxd: gruvboxdTheme,
  gruvboxl: gruvboxlTheme,
  oceans16: oceans16Theme,
  onedork: onedorkTheme,
};

const SYNTAXES: Record<string, string> = {
  'one-dark': oneDarkSyntax,
  'one-light': oneLightSyntax,
  dracula: draculaSyntax,
  'github-light': githubLightSyntax,
  monokai: monokaiSyntax,
  'solarized-dark': solarizedDarkSyntax,
  'solarized-light': solarizedLightSyntax,
  'vsc-dark-plus': vscDarkPlusSyntax,
};

type MathChoice = 'katex' | 'mathjax' | 'none';
const MATH_LABELS: Record<MathChoice, string> = {
  katex: 'KaTeX (CDN)',
  mathjax: 'MathJax (CDN)',
  none: 'None',
};

const STYLE_ID = 'docs-theme-demo';

function readQuery(): { chrome: string; syntax: string; math: MathChoice } {
  if (typeof window === 'undefined') {
    return { chrome: 'default', syntax: 'one-dark', math: 'katex' };
  }
  const params = new URLSearchParams(window.location.search);
  const chrome = params.get('chrome') ?? 'default';
  const syntax = params.get('syntax') ?? 'one-dark';
  const math = (params.get('math') as MathChoice) ?? 'katex';
  return { chrome, syntax, math };
}

export default function ThemeSwitcherDemo() {
  const initial = useMemo(() => readQuery(), []);
  const [chrome, setChrome] = useState(initial.chrome);
  const [syntax, setSyntax] = useState(initial.syntax);
  const math = initial.math;

  const languages = useMemo(() => [python], []);

  // Math plugin switches on mount — we don't hot-swap remark/rehype pipelines
  // mid-renderer, so math changes trigger a page reload below.
  const plugins = useMemo(() => {
    if (math === 'katex') return [createKatexCdnPlugin()];
    if (math === 'mathjax') return [createMathjaxCdnPlugin()];
    return [];
  }, [math]);

  useEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.append(el);
    }
    el.textContent = `${CHROMES[chrome]}\n${SYNTAXES[syntax]}`;
  }, [chrome, syntax]);

  function onMathChange(next: MathChoice) {
    const params = new URLSearchParams(window.location.search);
    params.set('math', next);
    params.set('chrome', chrome);
    params.set('syntax', syntax);
    window.location.search = `?${params.toString()}`;
  }

  const selectStyle = {
    height: '30px',
    minHeight: '30px',
    maxHeight: '30px',
    lineHeight: '28px',
    padding: '0 24px 0 8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    verticalAlign: 'middle',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage:
      'linear-gradient(45deg, transparent 50%, currentColor 50%),' +
      'linear-gradient(135deg, currentColor 50%, transparent 50%)',
    backgroundPosition: 'calc(100% - 16px) 50%, calc(100% - 11px) 50%',
    backgroundSize: '5px 5px, 5px 5px',
    backgroundRepeat: 'no-repeat',
    border: '1px solid var(--sl-color-hairline, rgba(127, 127, 127, 0.35))',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  } as const;
  const labelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    // Starlight's `.sl-markdown-content :not(…) + :not(…) { margin-top: 1rem }`
    // skips only the first sibling. Reset so every label renders identically.
    margin: 0,
    fontSize: '13px',
  } as const;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label style={labelStyle}>
          Chrome:
          <select value={chrome} onChange={(e) => setChrome(e.target.value)} style={selectStyle}>
            {Object.keys(CHROMES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Syntax:
          <select value={syntax} onChange={(e) => setSyntax(e.target.value)} style={selectStyle}>
            {Object.keys(SYNTAXES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Math:
          <select
            value={math}
            onChange={(e) => onMathChange(e.target.value as MathChoice)}
            style={selectStyle}
          >
            {(Object.keys(MATH_LABELS) as MathChoice[]).map((k) => (
              <option key={k} value={k}>
                {MATH_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Notebook
        ipynb={showcase as never}
        language="python"
        languages={languages}
        plugins={plugins}
      />
    </div>
  );
}

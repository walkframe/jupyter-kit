import { useEffect, useMemo, useState } from 'react';
import { highlight } from '@jupyter-kit/core';
import { javascript } from '@jupyter-kit/core/langs/javascript';

type Framework = 'react' | 'vue' | 'wc' | 'core';
type ThemeMode = 'single' | 'all';
type MathChoice = 'none' | 'katex-cdn' | 'katex' | 'mathjax-cdn' | 'mathjax';
type ExecChoice = 'none' | 'pyodide' | 'webr';
type PM = 'pnpm' | 'npm' | 'yarn';

const CHROMES = [
  'default',
  'dark',
  'chesterish',
  'darkbronco',
  'dorkula',
  'grade3',
  'gruvboxd',
  'gruvboxl',
  'monokai',
  'oceans16',
  'onedork',
  'solarizedd',
  'solarizedl',
];

const PM_VERB: Record<PM, string> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
};

const PM_STORAGE = 'jupyter-kit-docs:pm';

function readPM(): PM {
  if (typeof window === 'undefined') return 'pnpm';
  try {
    const v = localStorage.getItem(PM_STORAGE);
    if (v === 'npm' || v === 'yarn' || v === 'pnpm') return v;
  } catch {
    /* ignore */
  }
  return 'pnpm';
}

export default function InstallWizard() {
  const [framework, setFramework] = useState<Framework>('react');
  const [themeMode, setThemeMode] = useState<ThemeMode>('single');
  const [chrome, setChrome] = useState<string>('default');
  const [syntax, setSyntax] = useState<string>('one-dark');
  const [math, setMath] = useState<MathChoice>('none');
  const [exec, setExec] = useState<ExecChoice>('none');
  const [widgets, setWidgets] = useState(false);
  const [pm, setPM] = useState<PM>('pnpm');

  useEffect(() => {
    setPM(readPM());
    const handler = (e: Event) => setPM((e as CustomEvent).detail as PM);
    document.addEventListener('pm-change', handler);
    return () => document.removeEventListener('pm-change', handler);
  }, []);

  // Widgets require Pyodide to be interactive; disable when exec changes away.
  useEffect(() => {
    if (exec !== 'pyodide' && widgets) setWidgets(false);
  }, [exec, widgets]);

  const packages = useMemo(() => {
    const pkgs: string[] = [];
    // Framework — peer deps (react / vue) are assumed already present in the
    // user's app, the same way we don't list `react` for the React row.
    if (framework === 'react') pkgs.push('@jupyter-kit/react');
    else if (framework === 'vue') pkgs.push('@jupyter-kit/vue');
    else if (framework === 'wc') pkgs.push('@jupyter-kit/wc');
    else pkgs.push('@jupyter-kit/core');

    // Theme
    if (themeMode === 'all') pkgs.push('@jupyter-kit/theme-all');
    else pkgs.push(`@jupyter-kit/theme-${chrome}`);

    // Math
    if (math === 'katex-cdn') pkgs.push('@jupyter-kit/katex-cdn');
    else if (math === 'katex') pkgs.push('@jupyter-kit/katex', 'katex');
    else if (math === 'mathjax-cdn') pkgs.push('@jupyter-kit/mathjax-cdn');
    else if (math === 'mathjax') pkgs.push('@jupyter-kit/mathjax', 'mathjax-full');

    // Execution (editor is pulled in transitively)
    if (exec === 'pyodide') pkgs.push('@jupyter-kit/executor-pyodide');
    else if (exec === 'webr') pkgs.push('@jupyter-kit/executor-webr', 'webr');

    // Widgets — only makes sense live with Pyodide
    if (widgets && exec === 'pyodide') pkgs.push('@jupyter-kit/widgets');

    return pkgs;
  }, [framework, themeMode, chrome, math, exec, widgets]);

  // Multi-line format: one package per line with shell `\` continuation so
  // the command remains copy-pastable into a terminal.
  const command = packages.length
    ? `${PM_VERB[pm]} \\\n  ${packages.join(' \\\n  ')}`
    : PM_VERB[pm];

  const snippet = useMemo(
    () => buildSnippet({ framework, themeMode, chrome, syntax, math, exec, widgets }),
    [framework, themeMode, chrome, syntax, math, exec, widgets],
  );
  // The Lezer JavaScript parser handles JS / TS / JSX / TSX uniformly, so the
  // React + Vue snippets highlight directly. The WC / vanilla variants embed
  // a small HTML shell around JS — the parser still highlights the JS body
  // and leaves HTML tokens unclassed, which reads fine on the dark-ish
  // Starlight background.
  const snippetHtml = useMemo(() => highlight(javascript, snippet), [snippet]);

  return (
    <div className="install-wizard">
      <div className="wizard-grid">
        <Field legend="Framework">
          <Radio name="fw" value="react" checked={framework === 'react'} onSelect={setFramework}>
            React
          </Radio>
          <Radio name="fw" value="vue" checked={framework === 'vue'} onSelect={setFramework}>
            Vue 3
          </Radio>
          <Radio name="fw" value="wc" checked={framework === 'wc'} onSelect={setFramework}>
            Web Component
          </Radio>
          <Radio name="fw" value="core" checked={framework === 'core'} onSelect={setFramework}>
            Vanilla / custom host
          </Radio>
        </Field>

        <Field legend="Theme">
          <Radio
            name="themeMode"
            value="single"
            checked={themeMode === 'single'}
            onSelect={setThemeMode}
          >
            One chrome
            {themeMode === 'single' && (
              <select
                value={chrome}
                onChange={(e) => setChrome(e.target.value)}
                style={selectStyle}
              >
                {CHROMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Radio>
          <Radio
            name="themeMode"
            value="all"
            checked={themeMode === 'all'}
            onSelect={setThemeMode}
          >
            All chromes (ship the runtime switcher)
          </Radio>
          {themeMode === 'single' && (
            <div className="sub-row">
              Syntax theme{' '}
              <select
                value={syntax}
                onChange={(e) => setSyntax(e.target.value)}
                style={selectStyle}
              >
                {[
                  'one-dark',
                  'one-light',
                  'monokai',
                  'vsc-dark-plus',
                  'github-light',
                  'solarized-dark',
                  'solarized-light',
                  'dracula',
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Field>

        <Field legend="Math rendering">
          <Radio name="math" value="none" checked={math === 'none'} onSelect={setMath}>
            None
          </Radio>
          <Radio name="math" value="katex-cdn" checked={math === 'katex-cdn'} onSelect={setMath}>
            KaTeX (CDN, recommended)
          </Radio>
          <Radio name="math" value="katex" checked={math === 'katex'} onSelect={setMath}>
            KaTeX (bundled, ~70 KB gz)
          </Radio>
          <Radio name="math" value="mathjax-cdn" checked={math === 'mathjax-cdn'} onSelect={setMath}>
            MathJax (CDN)
          </Radio>
          <Radio name="math" value="mathjax" checked={math === 'mathjax'} onSelect={setMath}>
            MathJax (bundled, ~700 KB gz)
          </Radio>
        </Field>

        <Field legend="Edit + run code">
          <Radio name="exec" value="none" checked={exec === 'none'} onSelect={setExec}>
            Read-only — no editor
          </Radio>
          <Radio name="exec" value="pyodide" checked={exec === 'pyodide'} onSelect={setExec}>
            Python via Pyodide
          </Radio>
          <Radio name="exec" value="webr" checked={exec === 'webr'} onSelect={setExec}>
            R via WebR (GPL-2.0+)
          </Radio>
          {exec === 'pyodide' && (
            <div className="sub-row">
              <label>
                <input
                  type="checkbox"
                  checked={widgets}
                  onChange={(e) => setWidgets(e.target.checked)}
                />{' '}
                Interactive ipywidgets (sliders, buttons, …)
              </label>
            </div>
          )}
        </Field>
      </div>

      <div className="wizard-out">
        <div className="out-label">Install</div>
        <div className="install-line">
          <code className="install-command">{command}</code>
          <CopyButton text={command} />
        </div>

        <div className="out-label" style={{ marginTop: '0.9rem' }}>
          Paste into your app
        </div>
        <pre className="wizard-snippet">
          <code dangerouslySetInnerHTML={{ __html: snippetHtml }} />
        </pre>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

function Field({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="wizard-field">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

function Radio<T extends string>({
  name,
  value,
  checked,
  onSelect,
  children,
}: {
  name: string;
  value: T;
  checked: boolean;
  onSelect: (v: T) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="wizard-radio">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
      />
      <span>{children}</span>
    </label>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`copy-btn${copied ? ' copied' : ''}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function buildSnippet(opts: {
  framework: Framework;
  themeMode: ThemeMode;
  chrome: string;
  syntax: string;
  math: MathChoice;
  exec: ExecChoice;
  widgets: boolean;
}): string {
  const imports: string[] = [];
  const plugins: string[] = [];
  let executorExpr: string | null = null;

  // Framework
  if (opts.framework === 'react') {
    imports.push(`import { Notebook } from '@jupyter-kit/react';`);
  } else if (opts.framework === 'vue') {
    imports.push(`import { Notebook } from '@jupyter-kit/vue';`);
  } else if (opts.framework === 'wc') {
    imports.push(`import '@jupyter-kit/wc';`);
  } else {
    imports.push(`import { createRenderer } from '@jupyter-kit/core';`);
  }

  // Language — default Python (in core)
  imports.push(`import { python } from '@jupyter-kit/core/langs/python';`);

  // Theme CSS
  if (opts.themeMode === 'single') {
    imports.push(`import '@jupyter-kit/theme-${opts.chrome}/${opts.chrome}.css';`);
    imports.push(`import '@jupyter-kit/theme-${opts.chrome}/syntax/${opts.syntax}.css';`);
  } else {
    imports.push(`import defaultChrome from '@jupyter-kit/theme-all/chrome/default.css?inline';`);
    imports.push(`import oneDark from '@jupyter-kit/theme-all/syntax/one-dark.css?inline';`);
    imports.push(`// …and other chromes / syntax themes from @jupyter-kit/theme-all`);
  }

  // Math
  if (opts.math === 'katex-cdn') {
    imports.push(`import { createKatexCdnPlugin } from '@jupyter-kit/katex-cdn';`);
    plugins.push('createKatexCdnPlugin()');
  } else if (opts.math === 'katex') {
    imports.push(`import { createKatexPlugin } from '@jupyter-kit/katex';`);
    imports.push(`import 'katex/dist/katex.min.css';`);
    plugins.push('createKatexPlugin()');
  } else if (opts.math === 'mathjax-cdn') {
    imports.push(`import { createMathjaxCdnPlugin } from '@jupyter-kit/mathjax-cdn';`);
    plugins.push('createMathjaxCdnPlugin()');
  } else if (opts.math === 'mathjax') {
    imports.push(`import { createMathjaxPlugin } from '@jupyter-kit/mathjax';`);
    plugins.push('createMathjaxPlugin()');
  }

  // Executor + editor
  if (opts.exec === 'pyodide') {
    imports.push(`import { createPyodideExecutor } from '@jupyter-kit/executor-pyodide';`);
    imports.push(`import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';`);
    imports.push(`import { python as pythonEditor } from '@codemirror/lang-python';`);
    plugins.push('createEditorPlugin({ extensions: [pythonEditor()] })');
    executorExpr = 'createPyodideExecutor()';
  } else if (opts.exec === 'webr') {
    imports.push(`import { createWebRExecutor } from '@jupyter-kit/executor-webr';`);
    imports.push(`import { createEditorPlugin } from '@jupyter-kit/editor-codemirror';`);
    imports.push(`import { StreamLanguage } from '@codemirror/language';`);
    imports.push(`import { r as rEditor } from '@codemirror/legacy-modes/mode/r';`);
    imports.push(`import { r } from '@jupyter-kit/core/langs/r';`);
    plugins.push(
      'createEditorPlugin({ extensions: [StreamLanguage.define(rEditor)] })',
    );
    executorExpr = 'createWebRExecutor()';
  }

  // Widgets
  if (opts.widgets && opts.exec === 'pyodide') {
    imports.push(`import { createWidgetsPlugin } from '@jupyter-kit/widgets';`);
    plugins.push('createWidgetsPlugin()');
  }

  const pluginArr = plugins.length ? `[${plugins.join(', ')}]` : '[]';
  const language = opts.exec === 'webr' ? 'r' : 'python';
  const langs = opts.exec === 'webr' ? '[r]' : '[python]';

  let usage = '';
  if (opts.framework === 'react') {
    usage = `
<Notebook
  ipynb={notebook}
  language="${language}"
  languages={${langs}}
  plugins={${pluginArr}}${executorExpr ? `\n  executor={${executorExpr}}` : ''}
/>`.trim();
  } else if (opts.framework === 'vue') {
    usage = `
<Notebook
  :ipynb="notebook"
  language="${language}"
  :languages="${langs}"
  :plugins="${pluginArr}"${executorExpr ? `\n  :executor="${executorExpr}"` : ''}
/>`.trim();
  } else if (opts.framework === 'wc') {
    usage = `
<jk-notebook language="${language}"></jk-notebook>
<script type="module">
  const el = document.querySelector('jk-notebook');
  el.ipynb = notebook;
  el.languages = ${langs};
  el.plugins = ${pluginArr};${executorExpr ? `\n  el.executor = ${executorExpr};` : ''}
</script>`.trim();
  } else {
    usage = `
const renderer = createRenderer({
  container: document.querySelector('#root'),
  ipynb: notebook,
  language: '${language}',
  languages: ${langs},
  plugins: ${pluginArr},${executorExpr ? `\n  executor: ${executorExpr},` : ''}
});`.trim();
  }

  return `${imports.join('\n')}\n\n${usage}\n`;
}

const selectStyle: React.CSSProperties = {
  marginLeft: '0.4rem',
  fontSize: '0.85rem',
  padding: '0.05rem 0.3rem',
  background: 'transparent',
  color: 'inherit',
  border: '1px solid var(--sl-color-hairline, rgba(127,127,127,0.35))',
  borderRadius: '3px',
};

const CSS = `
.install-wizard {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  margin: 1rem 0 1.5rem;
}
.install-wizard .wizard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}
@media (max-width: 640px) {
  .install-wizard .wizard-grid {
    grid-template-columns: 1fr;
  }
}
.install-wizard .wizard-field {
  border: 1px solid var(--sl-color-hairline, rgba(127, 127, 127, 0.25));
  border-radius: 6px;
  padding: 0.5rem 0.7rem 0.6rem;
  margin: 0;
  min-width: 0;
}
.install-wizard .wizard-field legend {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--sl-color-gray-2, #ccc);
  padding: 0 0.35rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.install-wizard .wizard-radio {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  padding: 0.12rem 0;
  cursor: pointer;
  margin: 0;
}
.install-wizard .wizard-radio input {
  margin: 0;
  flex-shrink: 0;
}
.install-wizard .wizard-radio span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.install-wizard .sub-row {
  padding: 0.25rem 0 0 1.4rem;
  font-size: 0.82rem;
  color: var(--sl-color-gray-3, #aaa);
}
.install-wizard .out-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--sl-color-gray-2, #ccc);
  margin-bottom: 0.3rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.install-wizard .install-line {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--sl-color-bg-inline-code, rgba(127, 127, 127, 0.15));
  border: 1px solid var(--sl-color-hairline, rgba(127, 127, 127, 0.25));
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
}
.install-wizard .install-line code {
  flex: 1;
  min-width: 0;
  background: none;
  padding: 0;
  font-family: var(--sl-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 0.85rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  user-select: all;
  color: var(--sl-color-text);
}
.install-wizard .copy-btn {
  flex-shrink: 0;
  background: var(--sl-color-gray-5, #444);
  color: var(--sl-color-white, #fff);
  border: 1px solid var(--sl-color-hairline, rgba(127, 127, 127, 0.25));
  border-radius: 3px;
  padding: 0.15rem 0.6rem;
  cursor: pointer;
  font-size: 0.72rem;
  line-height: 1.4;
}
.install-wizard .copy-btn.copied {
  background: var(--sl-color-green, #2ea043);
}
.install-wizard .wizard-snippet {
  margin: 0;
  padding: 0.6rem 0.8rem;
  background: var(--sl-color-bg-inline-code, rgba(127, 127, 127, 0.15));
  border: 1px solid var(--sl-color-hairline, rgba(127, 127, 127, 0.25));
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.8rem;
  line-height: 1.45;
}
.install-wizard .wizard-snippet code {
  background: none;
  padding: 0;
  font-family: var(--sl-font-mono, ui-monospace, SFMono-Regular, monospace);
  color: var(--sl-color-text);
  white-space: pre;
}
/* One-dark-ish palette for Lezer's .tok-* class output. Scoped to the wizard
   so we don't collide with Starlight's own code-fence highlighting or the
   notebook theme (which scopes its syntax CSS under .jknb-root). Colors chosen
   to stay readable on both Starlight light and dark themes. */
.install-wizard .wizard-snippet .tok-comment { color: #7c858f; font-style: italic; }
.install-wizard .wizard-snippet .tok-keyword,
.install-wizard .wizard-snippet .tok-controlKeyword,
.install-wizard .wizard-snippet .tok-definitionKeyword,
.install-wizard .wizard-snippet .tok-moduleKeyword,
.install-wizard .wizard-snippet .tok-operatorKeyword { color: #c678dd; }
.install-wizard .wizard-snippet .tok-string,
.install-wizard .wizard-snippet .tok-character { color: #98c379; }
.install-wizard .wizard-snippet .tok-number,
.install-wizard .wizard-snippet .tok-bool,
.install-wizard .wizard-snippet .tok-null { color: #d19a66; }
.install-wizard .wizard-snippet .tok-typeName,
.install-wizard .wizard-snippet .tok-className,
.install-wizard .wizard-snippet .tok-namespace { color: #e5c07b; }
.install-wizard .wizard-snippet .tok-functionName,
.install-wizard .wizard-snippet .tok-labelName { color: #61afef; }
.install-wizard .wizard-snippet .tok-propertyName,
.install-wizard .wizard-snippet .tok-attributeName { color: #e06c75; }
.install-wizard .wizard-snippet .tok-operator,
.install-wizard .wizard-snippet .tok-derefOperator,
.install-wizard .wizard-snippet .tok-arithmeticOperator,
.install-wizard .wizard-snippet .tok-logicOperator,
.install-wizard .wizard-snippet .tok-compareOperator,
.install-wizard .wizard-snippet .tok-updateOperator,
.install-wizard .wizard-snippet .tok-definitionOperator { color: #56b6c2; }
`;

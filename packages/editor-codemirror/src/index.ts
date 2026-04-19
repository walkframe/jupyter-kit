import type { CellHandle, Plugin, RuntimeContext } from '@jupyter-kit/core';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';

export type EditorCodemirrorOptions = {
  /**
   * Per-language CodeMirror extensions (e.g. `[python()]` from
   * `@codemirror/lang-python`). Keys are language identifiers matched against
   * the cell's language. The key "*" is used as a fallback.
   */
  languages?: Record<string, Extension>;
  /** Extra extensions applied to every editor. */
  extensions?: Extension[];
  /** Render as read-only. Default false. */
  readOnly?: boolean;
  /** Show line numbers in the gutter. Default false (notebook cells are short). */
  lineNumbers?: boolean;
  /**
   * CSS font-family for editor content. Defaults to a system monospace stack so
   * code lines up regardless of the host page font. Pass any CSS value to
   * override (e.g. `"'Fira Code', monospace"`).
   */
  fontFamily?: string;
  /** CSS font-size for editor content. Defaults to 'inherit'. */
  fontSize?: string;
  /** Editor background color. Default 'transparent' (theme inherits). */
  backgroundColor?: string;
  /** Left-border color when the editor is focused. Default semi-transparent blue. */
  focusBorderColor?: string;
  /** Left-border color when not focused. Default 'transparent'. */
  inactiveBorderColor?: string;
  /** Show the run (▶) button. Default true; only visible when an executor is set. */
  runButton?: boolean;
  /** Tooltip for the run button. Default "Run (Shift+Enter)". */
  runLabel?: string;
};

const DEFAULT_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// Icons drawn at 14px, currentColor so CSS can restyle.
const ICON_PLAY =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_DUPLICATE =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_DELETE =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/></svg>';

const cellViews = new WeakMap<HTMLElement, EditorView>();

export function createEditorPlugin(
  opts: EditorCodemirrorOptions = {},
): Plugin {
  const languages = opts.languages ?? {};
  const extraExtensions = opts.extensions ?? [];
  const showLineNumbers = opts.lineNumbers ?? false;

  return {
    name: '@jupyter-kit/editor-codemirror',

    onCodeBlock(codeEl, language, ctx) {
      // `codeEl` is <code class="language-...">; its parent is <pre>. Replace
      // the <pre> so the editor claims the layout slot cleanly.
      const pre = codeEl.parentElement;
      if (!pre || pre.tagName !== 'PRE') return;

      const source = codeEl.textContent ?? '';
      const langExt = languages[language] ?? languages['*'];

      // Shift+Enter runs the cell and advances focus to the next code cell
      // (Jupyter convention). Kept above the default keymap so it wins over
      // any binding that would otherwise claim the keystroke.
      const runKeymap = keymap.of([
        {
          key: 'Shift-Enter',
          preventDefault: true,
          run: (view) => {
            if (!ctx.executor) return false;
            const handle = findHandle(view.dom, ctx);
            if (!handle) return false;
            void runAndAdvance(handle, ctx);
            return true;
          },
        },
      ]);

      const extensions: Extension[] = [
        history(),
        runKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.editable.of(!opts.readOnly),
        EditorState.readOnly.of(Boolean(opts.readOnly)),
        // Emit `.tok-*` classes so @jupyter-kit/syntax CSS themes apply
        // identically in editor and read-only views — one stylesheet, both
        // modes.
        syntaxHighlighting(classHighlighter),
        EditorView.theme({
          '&': {
            fontSize: opts.fontSize ?? 'inherit',
            backgroundColor: opts.backgroundColor ?? 'transparent',
            border: 'none',
            borderLeft: `3px solid ${opts.inactiveBorderColor ?? 'transparent'}`,
            borderRadius: '0',
          },
          // Editor-local focus indicator off by default — themes paint the
          // whole cell via `.cell:focus-within`. Pass `focusBorderColor` to
          // restore an editor-side border.
          '&.cm-focused': {
            outline: 'none',
            borderLeftColor: opts.focusBorderColor ?? 'transparent',
          },
          '.cm-scroller': {
            fontFamily: opts.fontFamily ?? DEFAULT_FONT_FAMILY,
            backgroundColor: 'transparent',
          },
          '.cm-content': {
            padding: '4px 0',
            backgroundColor: 'transparent',
          },
          '.cm-line': {
            padding: '0 8px',
            backgroundColor: 'transparent',
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            border: 'none',
          },
          '.cm-activeLine': { backgroundColor: 'transparent' },
          '.cm-activeLineGutter': { backgroundColor: 'transparent' },
          '.cm-selectionMatch': { backgroundColor: 'transparent' },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const handle = findHandle(update.view.dom, ctx);
          if (!handle) return;
          handle.setSource(update.state.doc.toString());
        }),
        ...extraExtensions,
      ];
      if (showLineNumbers) extensions.push(lineNumbers());
      if (langExt) extensions.push(langExt);

      const state = EditorState.create({ doc: source, extensions });

      const host = document.createElement('div');
      host.className = 'cm-editor-host';
      pre.replaceWith(host);

      const view = new EditorView({ state, parent: host });
      cellViews.set(host, view);
    },

    cellToolbar(handle, ctx) {
      const buttons: HTMLElement[] = [];

      if (opts.runButton !== false && ctx.executor) {
        buttons.push(
          makeIconButton('run', opts.runLabel ?? 'Run (Shift+Enter)', ICON_PLAY, (btn) => {
            btn.disabled = true;
            runAndAdvance(handle, ctx).finally(() => {
              btn.disabled = false;
            });
          }),
        );
      }

      buttons.push(
        makeIconButton('add', 'Add cell below', ICON_DUPLICATE, () => {
          // Insert an empty cell of the same type directly below. Copying
          // the current cell's source would let a stray click throw away
          // a partially-typed draft, so prefer a blank.
          //
          // Use the CURRENT notebook state (via `ctx.notebook()`) rather
          // than the captured `handle.index` — every `build()` replaces
          // every handle, so a long-lived closure over `handle` points at
          // a stale index once the user inserts / deletes any sibling.
          const cells = ctx.notebook().cells ?? [];
          const liveIndex = cells.findIndex((c) => c === handle.cell);
          const insertAt = liveIndex >= 0 ? liveIndex + 1 : cells.length;
          ctx.insertCell(insertAt, {
            cell_type: handle.cell.cell_type ?? 'code',
            source: '',
            outputs: [],
            execution_count: null,
          });
        }),
        makeIconButton('delete', 'Delete cell', ICON_DELETE, () => {
          ctx.deleteCell(handle.index);
        }),
      );

      return buttons;
    },

    teardown() {
      // Views will be GC'd with their DOM; no global state to clean up.
    },
  };
}

function makeIconButton(
  name: string,
  label: string,
  iconSvg: string,
  onClick: (btn: HTMLButtonElement) => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `cell_toolbar_btn cell_toolbar_${name}`;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = iconSvg;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(btn);
  });
  return btn;
}

function findHandle(
  node: Node,
  ctx: RuntimeContext,
): CellHandle | undefined {
  let el: Node | null = node;
  while (el && el !== ctx.root) {
    if (el instanceof HTMLElement && el.classList.contains('cell')) {
      return ctx.cells().find((h) => h.el === el);
    }
    el = el.parentNode;
  }
  return undefined;
}

/**
 * Run a cell, then move focus to the next code cell that has an editor. If
 * rerun fails, focus advances anyway (matches Jupyter — error is already
 * visible in the cell's output).
 */
async function runAndAdvance(
  handle: CellHandle,
  ctx: RuntimeContext,
): Promise<void> {
  try {
    await handle.rerun();
  } finally {
    focusNextEditor(handle, ctx);
  }
}

function focusNextEditor(handle: CellHandle, ctx: RuntimeContext): void {
  const all = ctx.cells();
  for (let i = handle.index + 1; i < all.length; i++) {
    const next = all[i];
    const host = next.el.querySelector('.cm-editor-host') as HTMLElement | null;
    if (!host) continue;
    const view = cellViews.get(host);
    if (view) {
      // Scroll the cell into view first so focus() doesn't trigger an abrupt
      // jump — `nearest` only scrolls if the cell is partly off-screen.
      next.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      view.focus();
      return;
    }
  }
}

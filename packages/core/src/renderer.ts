import type {
  CellHandle,
  CellType,
  LanguageDef,
  Ipynb,
  Plugin,
  Renderer,
  RendererHandle,
  RendererOptions,
  ResolvedOptions,
  RuntimeContext,
} from './types';
import { defaultHtmlFilter } from './filter';
import { buildMarkdownProcessor } from './markdown';
import { createCell } from './cell';

const DEFAULT_OPTIONS: ResolvedOptions = {
  language: 'python',
  bgTransparent: true,
  seqAsExecutionCount: false,
  className: '',
  filename: 'notebook.ipynb',
  mathAlign: 'left',
};

export function createRenderer(opts: RendererOptions = {}): Renderer {
  const plugins: Plugin[] = opts.plugins ?? [];
  const executor = opts.executor;
  const htmlFilter = opts.htmlFilter ?? defaultHtmlFilter;
  const onSave = opts.onSave;
  const resolved: ResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...stripUndefined(opts),
  };

  // Aggregate plugin-supplied remark/rehype plugins once. Markdown processor is
  // shared across all cells; mutating plugins after mount() is intentionally
  // unsupported.
  const remarkPlugins = plugins.flatMap((p) => p.remarkPlugins ?? []);
  const rehypePlugins = plugins.flatMap((p) => p.rehypePlugins ?? []);
  const markdownProcessor = buildMarkdownProcessor({
    remarkPlugins,
    rehypePlugins,
  });

  const languages = buildLanguageRegistry(opts.languages ?? []);

  return {
    mount(target: HTMLElement, notebook: Ipynb): RendererHandle {
      const root = document.createElement('div');
      root.className = ['jknb-root', 'container', resolved.className]
        .filter(Boolean)
        .join(' ');
      if (resolved.bgTransparent) {
        root.dataset.bgTransparent = 'true';
      }
      root.dataset.mathAlign = resolved.mathAlign;
      target.append(root);

      const handles: CellHandle[] = [];
      // Ipynb-wide counter. Seeds from the highest existing execution_count
      // in the notebook so re-mounting an already-executed notebook keeps the
      // numbering monotonic.
      let executionCounter = seedExecutionCount(notebook);
      // Mutable reference to the notebook so toolbar actions (move/delete etc.)
      // can mutate + rebuild without the caller re-threading state.
      let currentNotebook = cloneNotebook(notebook);

      // Sync currentNotebook.cells from the live handles so source edits and
      // execution outputs (mutated via CellHandle.setSource / setOutputs) end
      // up in any downloaded copy. Mutation methods then call this before
      // splicing to avoid using a stale snapshot.
      const syncNotebook = () => {
        currentNotebook = {
          ...currentNotebook,
          cells: handles.map((h) => h.cell),
        };
        return currentNotebook;
      };

      const ctx: RuntimeContext = {
        root,
        options: resolved,
        executor,
        htmlFilter,
        getCell: (i) => handles[i],
        cells: () => handles.slice(),
        nextExecutionCount: () => ++executionCounter,
        notebook: () => syncNotebook(),
        deleteCell: (i) => {
          const cells = [...syncNotebook().cells];
          cells.splice(i, 1);
          currentNotebook = { ...currentNotebook, cells };
          build(currentNotebook);
        },
        moveCell: (from, to) => {
          const cells = [...syncNotebook().cells];
          if (from < 0 || from >= cells.length) return;
          if (to < 0 || to >= cells.length) return;
          const [c] = cells.splice(from, 1);
          cells.splice(to, 0, c);
          currentNotebook = { ...currentNotebook, cells };
          build(currentNotebook);
        },
        insertCell: (i, cell) => {
          const cells = [...syncNotebook().cells];
          cells.splice(i, 0, cell);
          currentNotebook = { ...currentNotebook, cells };
          build(currentNotebook);
        },
        duplicateCell: (i) => {
          const cells = [...syncNotebook().cells];
          if (i < 0 || i >= cells.length) return;
          const clone: CellType = { ...cells[i], outputs: [], execution_count: null };
          cells.splice(i + 1, 0, clone);
          currentNotebook = { ...currentNotebook, cells };
          build(currentNotebook);
        },
        download: (filename) => {
          downloadNotebook(syncNotebook(), filename ?? resolved.filename);
        },
      };

      // Plugin setup is sync-or-async; we don't await here so mount stays
      // synchronous. Plugins that need readiness must coordinate via setup's
      // returned promise themselves.
      for (const p of plugins) {
        try {
          void p.setup?.(ctx);
        } catch (err) {
          console.error(`[jupyter-kit] plugin "${p.name}" setup failed:`, err);
        }
      }

      const build = (nb: Ipynb) => {
        root.replaceChildren();
        handles.length = 0;
        const cells = nb.cells || nb.worksheets?.[0]?.cells || [];
        cells.forEach((cell, i) => {
          const h = createCell(i, cell, {
            ctx,
            plugins,
            markdownProcessor,
            languages,
          });
          handles.push(h);
          root.append(h.el);
        });
      };

      // Ctrl/Cmd+S inside the renderer saves the notebook as ipynb. Bound at
      // the root so it only hijacks the shortcut when focus is within the
      // rendered notebook.
      const onKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 's') {
          e.preventDefault();
          if (onSave) {
            onSave(syncNotebook(), { download: ctx.download });
          } else {
            ctx.download();
          }
        }
      };
      root.addEventListener('keydown', onKeyDown);

      build(currentNotebook);

      return {
        update(nb: Ipynb) {
          currentNotebook = cloneNotebook(nb);
          build(currentNotebook);
        },
        cell(i) {
          return handles[i];
        },
        cells() {
          return handles.slice();
        },
        destroy() {
          root.removeEventListener('keydown', onKeyDown);
          for (const p of plugins) {
            try {
              p.teardown?.();
            } catch (err) {
              console.error(
                `[jupyter-kit] plugin "${p.name}" teardown failed:`,
                err,
              );
            }
          }
          handles.length = 0;
          root.remove();
        },
      };
    },
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as Array<keyof T>) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function buildLanguageRegistry(
  langs: LanguageDef[],
): Map<string, LanguageDef> {
  const reg = new Map<string, LanguageDef>();
  for (const lang of langs) {
    reg.set(lang.name, lang);
    for (const alias of lang.aliases ?? []) reg.set(alias, lang);
  }
  return reg;
}

function cloneNotebook(nb: Ipynb): Ipynb {
  return {
    ...nb,
    cells: [...(nb.cells ?? [])],
    ...(nb.worksheets ? { worksheets: nb.worksheets.map((w) => ({ ...w, cells: [...w.cells] })) } : {}),
  };
}

function downloadNotebook(nb: Ipynb, filename: string): void {
  const json = JSON.stringify(nb, null, 2);
  const blob = new Blob([json], { type: 'application/x-ipynb+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ipynb') ? filename : `${filename}.ipynb`;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a tick to pick up the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function seedExecutionCount(nb: Ipynb): number {
  const cells = nb.cells || nb.worksheets?.[0]?.cells || [];
  let max = 0;
  for (const c of cells) {
    if (typeof c.execution_count === 'number' && c.execution_count > max) {
      max = c.execution_count;
    }
  }
  return max;
}

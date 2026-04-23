import type {
  CellHandle,
  CellType,
  LanguageDef,
  OutputType,
  Plugin,
  RuntimeContext,
} from './types';
import { highlight } from './highlight';
import { type MarkdownProcessor, renderMarkdown } from './markdown';
import { buildDefaultOutput } from './outputs';
import { embedAttachments, stringify } from './util';

export type CellBuildDeps = {
  ctx: RuntimeContext;
  plugins: Plugin[];
  markdownProcessor: MarkdownProcessor;
  languages: Map<string, LanguageDef>;
};

/** Build a CellHandle bound to a freshly created root element. */
export function createCell(
  index: number,
  initialCell: CellType,
  deps: CellBuildDeps,
): CellHandle {
  let cell: CellType = initialCell;
  let running = false;

  const inputPrompt = <div class="prompt input_prompt" /> as HTMLElement;
  const innerCell = <div class="inner_cell" /> as HTMLElement;
  const outputHost = <div class="output" /> as HTMLElement;

  const root = (
    <div class="cell border-box-sizing code_cell rendered">
      <div class="input">
        {inputPrompt}
        {innerCell}
      </div>
      <div class="output_wrapper">{outputHost}</div>
    </div>
  ) as HTMLElement;

  const handle: CellHandle = {
    get index() {
      return index;
    },
    get cell() {
      return cell;
    },
    get el() {
      return root;
    },
    setSource(source) {
      // No re-render: the editor (or external caller) owns the input DOM and
      // we'd otherwise tear it down on every keystroke, dropping focus.
      // Use `redrawInput()` if you want to rebuild the code/markdown view.
      cell = { ...cell, source: [source] };
    },
    redrawInput() {
      renderInput();
    },
    setOutputs(outputs) {
      cell = { ...cell, outputs };
      renderOutputs();
    },
    async rerun() {
      if (!deps.ctx.executor || running) return;
      running = true;
      renderPromptOnly();
      try {
        const src = stringify(cell.source ?? cell.input);
        const outs = await deps.ctx.executor.execute(
          src,
          deps.ctx.options.language,
        );
        const n = deps.ctx.nextExecutionCount();
        cell = { ...cell, execution_count: n };
        // Match Jupyter: `Out [n]:` on execute_result/display_data sharing the
        // same counter as `In [n]:`.
        const tagged = outs.map((o) =>
          o.output_type === 'execute_result' || o.output_type === 'display_data'
            ? { ...o, execution_count: n }
            : o,
        );
        cell = { ...cell, outputs: tagged };
      } finally {
        running = false;
        renderPromptOnly();
        renderOutputs();
      }
    },
  };

  const renderPromptOnly = () => {
    inputPrompt.replaceChildren(
      <Prompt cell={cell} index={index} deps={deps} running={running} />,
    );
  };

  const renderInput = () => {
    renderPromptOnly();
    innerCell.replaceChildren(
      ...asArray(<InnerCell cell={cell} handle={handle} deps={deps} />),
    );
  };

  const renderOutputs = () => {
    outputHost.replaceChildren(
      ...(cell.outputs ?? []).map((out) => (
        <OutputArea out={out} deps={deps} />
      ) as HTMLElement),
    );
  };

  // (Previously this hid cells with no source and no outputs. That rule
  // is incompatible with the "add empty cell below" toolbar action — new
  // cells are explicitly empty and must stay visible so the user can
  // type into them. Hiding imported empty cells is a concern for the
  // consumer's own CSS now.)

  renderInput();
  renderOutputs();

  return handle;
}

// -- JSX components (return DOM nodes) ----------------------------------------

function Prompt({
  cell,
  index,
  deps,
  running,
}: {
  cell: CellType;
  index: number;
  deps: CellBuildDeps;
  running?: boolean;
}): Node {
  if (cell.cell_type !== 'code') return document.createTextNode('');
  // Jupyter convention: `In [*]:` while a cell is executing.
  const num = running
    ? '*'
    : deps.ctx.options.seqAsExecutionCount
      ? index + 1
      : cell.execution_count ?? cell.prompt_number ?? ' ';
  return <span>{`In [${num}]:`}</span>;
}

function InnerCell({
  cell,
  handle,
  deps,
}: {
  cell: CellType;
  handle: CellHandle;
  deps: CellBuildDeps;
}): Node {
  const source = stringify(cell.source ?? cell.input);

  if (cell.cell_type === 'markdown') {
    return <MarkdownCell source={source} cell={cell} deps={deps} />;
  }
  if (cell.cell_type === 'code') {
    return <CodeCell source={source} handle={handle} deps={deps} />;
  }
  if (cell.cell_type === 'heading') {
    return <h2>{source}</h2>;
  }
  return document.createDocumentFragment();
}

function MarkdownCell({
  source,
  cell,
  deps,
}: {
  source: string;
  cell: CellType;
  deps: CellBuildDeps;
}): HTMLElement {
  const host = (
    <div class="text_cell_render border-box-sizing rendered_html" />
  ) as HTMLElement;
  const raw = embedAttachments(source, cell.attachments);
  // Sanitize the rendered HTML, not the markdown source — otherwise things like
  // `[click](javascript:alert(1))` survive (it's plain text at sanitize time)
  // and the unified pipeline turns them into a live <a href="javascript:...">.
  void renderMarkdown(deps.markdownProcessor, raw)
    .then((html) => {
      host.innerHTML = deps.ctx.htmlFilter(html);
      for (const p of deps.plugins) p.onMarkdownRendered?.(host, deps.ctx);
    })
    .catch((err) => {
      console.error('[jupyter-kit] markdown render failed:', err);
      host.innerHTML = deps.ctx.htmlFilter(raw);
    });
  return host;
}

function CodeCell({
  source,
  handle,
  deps,
}: {
  source: string;
  handle: CellHandle;
  deps: CellBuildDeps;
}): Node {
  const lang = deps.ctx.options.language;

  const onDoubleClick = (e: Event) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(e.currentTarget as Node);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // Build the full ancestor chain BEFORE invoking plugins. editor-codemirror's
  // onCodeBlock does `codeEl.parentElement.replaceWith(host)` — that needs
  // codeEl to already live inside <pre> inside .highlight, otherwise it bails.
  const highlightContainer = (
    <div class="highlight hl-ipython3" ondblclick={onDoubleClick} />
  ) as HTMLElement;

  // Always emit a `<pre><code>` shell, even for empty source. The editor
  // plugin's `onCodeBlock` hook replaces the `<pre>` wholesale with a live
  // CodeMirror editor — skipping empty cells would leave toolbar-inserted
  // blank cells without any way to receive focus or keystrokes.
  const codeEl = (
    <code class={`language-${lang}`}>{source}</code>
  ) as HTMLElement;
  const langDef = deps.languages.get(lang);
  if (langDef && source) codeEl.innerHTML = highlight(langDef, source);

  const pre = (<pre>{codeEl}</pre>) as HTMLElement;
  highlightContainer.append(pre);

  // codeEl chain is now codeEl → pre → highlightContainer; safe to call
  // plugins that reach for parents.
  for (const p of deps.plugins) p.onCodeBlock?.(codeEl, lang, deps.ctx);

  const toolbarButtons = deps.plugins.flatMap(
    (p) => p.cellToolbar?.(handle, deps.ctx) ?? [],
  );
  if (toolbarButtons.length) {
    // Nested inside .highlight so absolute positioning overlays the editor.
    highlightContainer.append(
      <div class="cell_toolbar">{toolbarButtons}</div>,
    );
  }

  return (<div class="input_area">{highlightContainer}</div>) as HTMLElement;
}

function OutputArea({
  out,
  deps,
}: {
  out: OutputType;
  deps: CellBuildDeps;
}): HTMLElement {
  const prompt = (
    <div class="prompt output_prompt">
      {out.execution_count != null ? `Out [${out.execution_count}]:` : ''}
    </div>
  ) as HTMLElement;

  // Plugins that want to render an output mutate `slot` in place (so they can
  // attach listeners / keep refs). Default path constructs a fresh node.
  let body: Node = <div /> as HTMLElement;

  let claimed = false;
  for (const p of deps.plugins) {
    if (p.renderOutput?.(out, body as HTMLElement, deps.ctx) === true) {
      claimed = true;
      break;
    }
  }
  if (!claimed) {
    const node = buildDefaultOutput(
      out,
      deps.ctx,
      deps.plugins,
      deps.markdownProcessor,
    );
    if (node) body = node;
  }

  return (
    <div class="output_area">
      {prompt}
      {body}
    </div>
  ) as HTMLElement;
}

// -- utilities ---------------------------------------------------------------

/** Normalise JSX that might produce either a single node or a fragment. */
function asArray(node: Node): Node[] {
  if (node instanceof DocumentFragment) {
    return Array.from(node.childNodes);
  }
  return [node];
}

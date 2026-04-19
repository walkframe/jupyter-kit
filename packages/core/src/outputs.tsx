import Anser from 'anser';

import type { OutputType, Plugin, RuntimeContext } from './types';
import { type MarkdownProcessor, renderMarkdown } from './markdown';
import { stringify } from './util';

/**
 * Default renderer for a single ipynb output entry. Plugins run first (via the
 * renderer's dispatch loop); this is the fallback when no plugin claims it.
 *
 * Returns the node to insert, or `null` when the output type is unrecognised.
 * The caller is responsible for mounting it — don't try to `replaceWith` the
 * slot here, since at call time it has no parent yet.
 */
export function buildDefaultOutput(
  out: OutputType,
  ctx: RuntimeContext,
  plugins: Plugin[],
  markdownProcessor: MarkdownProcessor,
): Node | null {
  return out.data
    ? renderMimeData(out, ctx, plugins, markdownProcessor)
    : renderLegacyShape(out, ctx);
}

function renderLegacyShape(out: OutputType, ctx: RuntimeContext): Node | null {
  if (out.png) return <ImageBlock mime="png" b64={out.png} />;
  if (out.jpeg) return <ImageBlock mime="jpeg" b64={out.jpeg} />;
  if (out.gif) return <ImageBlock mime="gif" b64={out.gif} />;

  if (out.svg) {
    return (
      <div
        class="output_svg output_subarea"
        html={ctx.htmlFilter(out.svg)}
      />
    );
  }

  if (out.text) {
    return (
      <div class={textClasses(out)}>
        <pre>{stringify(out.text)}</pre>
      </div>
    );
  }

  if (out.traceback) {
    // Traceback entries are one line each with NO trailing newline, so use
    // `\n` as the separator (stringify uses '' which would collapse them).
    const raw = out.traceback.join('\n');
    const html = ctx.htmlFilter(Anser.ansiToHtml(Anser.escapeForHtml(raw)));
    return (
      <div class="output_subarea output_error">
        <pre html={html} />
      </div>
    );
  }

  return null;
}

function renderMimeData(
  out: OutputType,
  ctx: RuntimeContext,
  plugins: Plugin[],
  markdownProcessor: MarkdownProcessor,
): Node | null {
  const d = out.data!;

  if (d['text/latex']) {
    const raw = stringify(d['text/latex']);
    const host = (
      <div class="output_latex output_subarea output_execute_result" />
    ) as HTMLElement;
    // Sanitize the rendered HTML, not the markdown source. See cell.tsx for
    // the rationale (markdown links with javascript: URLs would otherwise slip
    // through, since they look like plain text before the unified pass).
    void renderMarkdown(markdownProcessor, raw)
      .then((html) => {
        host.innerHTML = ctx.htmlFilter(html);
        for (const p of plugins) p.onMarkdownRendered?.(host, ctx);
      })
      .catch((err) => {
        console.error('[jupyter-kit] latex output render failed:', err);
        host.innerHTML = ctx.htmlFilter(raw);
      });
    return host;
  }

  if (d['text/html']) {
    const raw = stringify(d['text/html']);
    return (
      <div
        class="output_html rendered_html output_subarea"
        html={ctx.htmlFilter(`<div>${raw}</div>`)}
      />
    );
  }

  // SVG before raster — vector renders sharper at any zoom and is usually
  // smaller for plots. Bitmap formats are the fallback.
  if (d['image/svg+xml']) {
    return (
      <div
        class="output_svg output_subarea"
        html={ctx.htmlFilter(d['image/svg+xml'] as string)}
      />
    );
  }
  if (d['image/png']) return <ImageBlock mime="png" b64={d['image/png'] as string} />;
  if (d['image/jpeg']) return <ImageBlock mime="jpeg" b64={d['image/jpeg'] as string} />;
  if (d['image/gif']) return <ImageBlock mime="gif" b64={d['image/gif'] as string} />;

  if (d['text/plain']) {
    return (
      <div class="output_text output_subarea output_execute_result">
        <pre>{stringify(d['text/plain'])}</pre>
      </div>
    );
  }

  return null;
}

function textClasses(out: OutputType): string {
  return [
    'output_subarea',
    'output_text',
    out.output_type && `output_${out.output_type}`,
    out.name && `output_${out.name}`,
    out.name && `output-${out.name}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function ImageBlock({
  mime,
  b64,
}: {
  mime: 'png' | 'jpeg' | 'gif';
  b64: string;
}): HTMLElement {
  return (
    <div class={`output_${mime} output_subarea`}>
      <img src={`data:image/${mime};base64,${b64}`} alt={`output ${mime}`} />
    </div>
  ) as HTMLElement;
}

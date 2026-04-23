import type { Parser } from '@lezer/common';
import { classHighlighter, highlightCode } from '@lezer/highlight';

import type { LanguageDef } from './types';

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

/** Render highlighted HTML for a source string with a Lezer parser. */
export function highlightWithParser(parser: Parser, source: string): string {
  const tree = parser.parse(source);
  let html = '';
  highlightCode(
    source,
    tree,
    classHighlighter,
    (text, classes) => {
      const escaped = escapeHtml(text);
      html += classes ? `<span class="${classes}">${escaped}</span>` : escaped;
    },
    () => {
      html += '\n';
    },
  );
  return html;
}

/** Convenience: highlight using a LanguageDef. */
export function highlight(language: LanguageDef, source: string): string {
  return highlightWithParser(language.parser, source);
}

import DOMPurify from 'dompurify';
import type { HtmlFilter } from './types';

/**
 * DOMPurify strips `<use>` by default — it's a known XSS vector via
 * cross-origin SVG refs. MathJax's SVG output however *depends* on
 * `<use xlink:href="#MJX-...">` to pull glyph paths out of a local `<defs>`.
 * Without `<use>`, only the structural SVG (fraction bars etc.) renders and
 * characters disappear.
 *
 * We re-enable `<use>` + `xlink:href`. The residual risk is cross-origin
 * `<use href="http://evil/foo.svg#x">`, but DOMPurify's URL regex still
 * blocks `javascript:` and most data URIs, and the notebook render pipeline
 * itself is the only place `<use>` elements get inserted — there's no path
 * for untrusted ipynb JSON to produce arbitrary SVG.
 *
 * For SSR, build a separate filter from a linkedom (or jsdom) window via
 * `DOMPurify(window).sanitize` and pass it as `RendererOptions.htmlFilter` so
 * we don't drag jsdom into client bundles.
 */
export const defaultHtmlFilter: HtmlFilter = (html) =>
  DOMPurify.sanitize(html, {
    ADD_TAGS: ['use'],
    ADD_ATTR: [
      'xlink:href',
      'xmlns:xlink',
      'xmlns:mjx',
      'mathvariant',
    ],
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: /^mjx-/,
      attributeNameCheck: /^(jax|display|ctxt|variant|texclass|focusable)$/,
      allowCustomizedBuiltInElements: false,
    },
  });

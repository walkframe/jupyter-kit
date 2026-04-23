import { applyAttrs, appendChild } from './jsx-internal';

export { Fragment } from './jsx-internal';

type Primitive = string | number | boolean | null | undefined;
export type Child = Node | Primitive;

/**
 * Minimal hyperscript helper for building DOM trees declaratively.
 * Returns real HTMLElements (not a virtual DOM) so callers can keep refs to
 * leaf nodes and mutate them later without a diffing layer.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown> | null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) applyAttrs(node, attrs);
  for (const child of children) appendChild(node, child);
  return node;
}

/** Append plain text (escape-safe) — use in place of `innerHTML` for literals. */
export function text(value: string | number): Text {
  return document.createTextNode(String(value));
}

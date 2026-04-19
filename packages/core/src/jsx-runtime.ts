/**
 * Automatic JSX runtime for @jupyter-kit/core.
 *
 * Configure consumers (including this monorepo) with:
 *   "jsx": "react-jsx",
 *   "jsxImportSource": "@jupyter-kit/core"
 *
 * Then `<div class="x">{kid}</div>` desugars into a `jsx('div', {...})` call
 * resolved from this module — no React required.
 */

import { applyAttrs, appendChild, Fragment as F } from './jsx-internal';

type Component<P = unknown> = (props: P) => Node | null | undefined;

type Props = {
  children?: unknown;
  [key: string]: unknown;
};

export function jsx(
  type: string | typeof F | Component,
  props: Props,
  _key?: string,
): Node {
  return create(type, props);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = F;

function create(type: string | typeof F | Component, props: Props): Node {
  const { children, ...rest } = props ?? {};

  if (type === F) {
    const frag = document.createDocumentFragment();
    appendChildren(frag, children);
    return frag;
  }

  if (typeof type === 'function') {
    const node = type(props);
    return node ?? document.createDocumentFragment();
  }

  const el = document.createElement(type);
  applyAttrs(el, rest);
  appendChildren(el, children);
  return el;
}

function appendChildren(parent: ParentNode, children: unknown): void {
  if (children == null || children === false || children === true) return;
  if (Array.isArray(children)) {
    for (const c of children) appendChildren(parent, c);
    return;
  }
  appendChild(parent, children);
}

export type { JSX } from './jsx-types';

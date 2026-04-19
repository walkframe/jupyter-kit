/**
 * JSX type declarations for @jupyter-kit/core. Covers every HTML element and
 * the common handlers/props people reach for. We intentionally keep attribute
 * types loose so JSX stays ergonomic without re-deriving React's DOM types.
 */

type Handler<E extends Event = Event> = (ev: E) => void;

type BaseAttrs = {
  class?: string;
  className?: string;
  id?: string;
  style?: string | Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  title?: string;
  role?: string;
  tabindex?: number | string;
  html?: string;
  dangerouslySetInnerHTML?: { __html: string };
  ref?: (el: HTMLElement) => void;
  key?: string | number;
  children?: unknown;
  // Event handler slots — lowercase to match DOM addEventListener names, and
  // also common camelCase variants for React-style authoring ergonomics.
  onclick?: Handler<MouseEvent>;
  ondblclick?: Handler<MouseEvent>;
  onDblclick?: Handler<MouseEvent>;
  onmousedown?: Handler<MouseEvent>;
  onmouseup?: Handler<MouseEvent>;
  oninput?: Handler<Event>;
  onchange?: Handler<Event>;
  onkeydown?: Handler<KeyboardEvent>;
  onkeyup?: Handler<KeyboardEvent>;
  onfocus?: Handler<FocusEvent>;
  onblur?: Handler<FocusEvent>;
  [key: string]: unknown;
};

type IntrinsicMap = {
  [K in keyof HTMLElementTagNameMap]: BaseAttrs & Record<string, unknown>;
};

export namespace JSX {
  export type Element = Node;
  export interface IntrinsicElements extends IntrinsicMap {}
  export interface ElementChildrenAttribute {
    children: unknown;
  }
}

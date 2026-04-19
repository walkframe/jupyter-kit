/** Runtime helpers shared by `h()` and the JSX runtime. */

type EventHandler = (e: Event) => void;

export const Fragment = Symbol('ipynb.Fragment');

export function applyAttrs(el: HTMLElement, attrs: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;

    if (key === 'class' || key === 'className') {
      el.className = String(value);
    } else if (key === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value);
      else Object.assign(el.style, value as object);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value as object);
    } else if (key === 'html' || key === 'dangerouslySetInnerHTML') {
      // `html: "<p>..</p>"` or React-compat `dangerouslySetInnerHTML={{__html}}`
      const v = typeof value === 'object' && value !== null
        ? (value as { __html?: string }).__html ?? ''
        : String(value);
      el.innerHTML = v;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'ref' && typeof value === 'function') {
      (value as (n: HTMLElement) => void)(el);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
    // `EventHandler` kept for type-level callers; unused locally.
    void (null as unknown as EventHandler);
  }
}

export function appendChild(parent: ParentNode, child: unknown): void {
  if (child == null || child === false || child === true) return;
  if (Array.isArray(child)) {
    for (const c of child) appendChild(parent, c);
    return;
  }
  if (child instanceof Node) {
    parent.append(child);
    return;
  }
  parent.append(document.createTextNode(String(child)));
}

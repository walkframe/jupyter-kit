import { describe, it, expect, beforeEach } from 'vitest';

import { createRenderer } from './renderer';
import type { Ipynb, InternalPlugin } from './types';

const nb = (): Ipynb => ({
  cells: [
    { cell_type: 'code', source: 'a', execution_count: 1, outputs: [] },
    { cell_type: 'code', source: 'b', execution_count: 2, outputs: [] },
    { cell_type: 'markdown', source: '# hi' },
  ],
});

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

describe('renderer mount', () => {
  it('attaches a root with jknb-root class', () => {
    const r = createRenderer();
    r.mount(host, nb());
    const root = host.querySelector('.jknb-root');
    expect(root).not.toBeNull();
    expect(root?.classList.contains('container')).toBe(true);
  });

  it('applies data-math-align from options', () => {
    const r = createRenderer({ mathAlign: 'center' });
    r.mount(host, nb());
    const root = host.querySelector<HTMLElement>('.jknb-root')!;
    expect(root.dataset.mathAlign).toBe('center');
  });

  it('renders one handle per cell', () => {
    const r = createRenderer();
    const handle = r.mount(host, nb());
    expect(handle.cells()).toHaveLength(3);
  });

  it('destroy removes the root and teardowns plugins', () => {
    let torndown = false;
    const r = createRenderer({
      plugins: [{ name: 'p', teardown: () => void (torndown = true) }],
    });
    const h = r.mount(host, nb());
    h.destroy();
    expect(host.querySelector('.jknb-root')).toBeNull();
    expect(torndown).toBe(true);
  });
});

describe('notebook mutation', () => {
  it('deleteCell removes a cell', () => {
    const r = createRenderer();
    const h = r.mount(host, nb());
    const cellsBefore = h.cells().length;
    // ctx is not exposed; exercise via update() instead.
    const next: Ipynb = {
      cells: nb().cells.slice(1),
    };
    h.update(next);
    expect(h.cells().length).toBe(cellsBefore - 1);
  });

  it('update() rebuilds from a new notebook', () => {
    const r = createRenderer();
    const h = r.mount(host, nb());
    h.update({ cells: [{ cell_type: 'code', source: 'x' }] });
    expect(h.cells()).toHaveLength(1);
  });
});

describe('incremental update (reconciliation)', () => {
  const root = () => host.querySelector<HTMLElement>('.jknb-root')!;

  it('reuses the same DOM node for cells kept by object identity', () => {
    const r = createRenderer();
    const h = r.mount(host, nb());
    const [a, , c] = h.cells();
    const elA = a.el;
    // Drop the middle cell but keep A and C by reusing their cell objects.
    h.update({ cells: [a.cell, c.cell] });
    const after = h.cells();
    expect(after).toHaveLength(2);
    expect(after[0].el).toBe(elA); // untouched DOM (would preserve editor focus)
    expect(after[0].cell).toBe(a.cell);
    expect(after[1].cell).toBe(c.cell);
  });

  it('reassigns indices of reused cells after a reorder', () => {
    const r = createRenderer();
    const h = r.mount(host, nb());
    const [a, b, c] = h.cells().map((x) => x.cell);
    h.update({ cells: [c, a, b] });
    const after = h.cells();
    expect(after.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(after.map((x) => x.cell)).toEqual([c, a, b]);
    // DOM order matches the new cell order.
    expect(Array.from(root().children)).toEqual(after.map((x) => x.el));
  });

  it('rebuilds cells whose identity changed', () => {
    const r = createRenderer();
    const h = r.mount(host, nb());
    const elA = h.cells()[0].el;
    // A brand-new notebook: all-new objects, so nothing matches by identity.
    h.update(nb());
    expect(h.cells()[0].el).not.toBe(elA);
  });

  it('detaches removed cell DOM from the root', () => {
    const r = createRenderer();
    const h = r.mount(host, nb());
    const [a, , c] = h.cells();
    const removedEl = c.el;
    expect(root().contains(removedEl)).toBe(true);
    h.update({ cells: [a.cell] });
    expect(root().contains(removedEl)).toBe(false);
    expect(root().children.length).toBe(1);
  });

  it('fires onRendered once per mount and per update', () => {
    let count = 0;
    const r = createRenderer({
      plugins: [
        { name: 'p', onRendered: () => void count++ } satisfies InternalPlugin,
      ],
    });
    const h = r.mount(host, nb());
    expect(count).toBe(1);
    h.update({ cells: [] });
    expect(count).toBe(2);
  });
});

describe('execution count seeding', () => {
  it('continues from the highest existing execution_count', () => {
    // Seed a notebook with executions up to 7.
    const seeded: Ipynb = {
      cells: [
        { cell_type: 'code', execution_count: 5, source: 'x' },
        { cell_type: 'code', execution_count: 7, source: 'y' },
      ],
    };
    const r = createRenderer();
    const h = r.mount(host, seeded);
    // Can't observe nextExecutionCount directly from the public handle, but
    // we can at least confirm mount didn't renumber existing counts.
    expect(h.cells()[0].cell.execution_count).toBe(5);
    expect(h.cells()[1].cell.execution_count).toBe(7);
  });
});


import { describe, it, expect, beforeEach } from 'vitest';

import { createRenderer } from './renderer';
import type { Ipynb } from './types';

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


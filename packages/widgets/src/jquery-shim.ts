// Side-effect-only module: seed `globalThis.jQuery` / `$` BEFORE any
// downstream code (jquery-ui via @jupyter-widgets/controls/slider) tries
// to detect them.
//
// ES module evaluation is post-order across the dep graph. By isolating
// this in its own file and importing it FIRST in runtime.ts, jquery
// itself + this body run to completion before @jupyter-widgets/html-manager
// (and the jquery-ui graph it pulls) start evaluating. If we kept this
// inline in runtime.ts, all `import` statements would hoist together and
// the assignment below would race jquery-ui's init.
// @ts-expect-error — jquery has no bundled .d.ts
import jquery from 'jquery';

const g = globalThis as unknown as { jQuery?: unknown; $?: unknown };
if (!g.jQuery) g.jQuery = jquery;
if (!g.$) g.$ = jquery;

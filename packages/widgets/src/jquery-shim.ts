// Side-effect ordering note: this file MUST run before jquery-ui-shim.ts.
// Both depend on jquery, but only this one is allowed to import it — its
// body sets `globalThis.jQuery` before jquery-ui's evaluation begins.
//
// Within this single file the imports also hoist, but there's only one
// import (`jquery`) so the body runs immediately after jquery's eval —
// no race.
// @ts-expect-error — jquery has no bundled .d.ts
import jquery from 'jquery';

const g = globalThis as unknown as { jQuery?: unknown; $?: unknown };
if (!g.jQuery) g.jQuery = jquery;
if (!g.$) g.$ = jquery;

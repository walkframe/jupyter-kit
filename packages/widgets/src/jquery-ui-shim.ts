// Pulled in via runtime.ts AFTER ./jquery-shim. ES module post-order
// guarantees jquery-shim's body (which sets `globalThis.jQuery`) has
// already run before jquery-ui's UMD wrapper evaluates here, so jquery-ui
// finds the global it expects and registers `$.ui.mouse`, `$.ui.slider`,
// etc. on it.
import 'jquery-ui/dist/jquery-ui.js';

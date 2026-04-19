// Vite resolves these at build time; TypeScript needs hand-written stubs.

// Plain CSS imports (side-effect only).
declare module '*.css';

// Vite's `?inline` suffix returns the file's contents as a string.
declare module '*.css?inline' {
  const content: string;
  export default content;
}

// `@codemirror/legacy-modes` ships type declarations under its own
// directory tree; the deep `mode/*` subpaths aren't covered by the
// package's `exports` map. Fall back to `any` — the runtime values are
// stream-parser objects we forward straight to StreamLanguage.define.
declare module '@codemirror/legacy-modes/mode/*';

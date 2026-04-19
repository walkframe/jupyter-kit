# `@jupyter-kit/theme`

CSS themes for the notebook chrome (cell layout, prompts, output frames). Pure
CSS — no JavaScript. Each theme is an independent stylesheet you import on
its own.

## Install

```sh
pnpm add @jupyter-kit/theme
```

## Usage

```ts
import '@jupyter-kit/theme/themes/default.css';
// or:
// import '@jupyter-kit/theme/themes/dark.css';
// import '@jupyter-kit/theme/themes/monokai.css';
// ...
```

## Available themes

`chesterish`, `dark`, `darkbronco`, `default`, `dorkula`, `grade3`, `gruvboxd`,
`gruvboxl`, `monokai`, `oceans16`, `onedork`, `solarizedd`, `solarizedl`.

Most themes inherit from a shared `base.less` (jupyter-themes layout +
DataFrame styling + focus indicator). The `default` theme is self-contained
classic-Jupyter styling with no jupyter-themes dependency.

## Companion: `@jupyter-kit/syntax`

These CSS files style the notebook chrome only. Code colours come from
`@jupyter-kit/syntax/themes/<name>.css` (Lezer `tok-*` classes). Pair one
of each.

## License

Apache-2.0. The bundled jupyter-themes copy under `less/jupyter-themes/` is
MIT (upstream: <https://github.com/dunovank/jupyter-themes>).

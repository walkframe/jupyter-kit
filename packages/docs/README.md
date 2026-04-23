# `@jupyter-kit/docs`

Documentation site built with [Astro](https://astro.build) +
[Starlight](https://starlight.astro.build). Includes live React demos
(pyodide, WebR, theme switcher, read-only).

## Develop

```sh
pnpm --filter @jupyter-kit/docs dev
```

Opens at http://localhost:4321.

## Build

```sh
pnpm --filter @jupyter-kit/docs build
```

Outputs to `dist/`.

## Content

- `src/content/docs/` — Markdown/MDX pages.
- `src/components/` — React demo components (loaded via `client:only`).
- `src/components/notebooks/` — inline sample notebooks used by demos.
- `src/styles/custom.css` — theme overrides.

Demo components pull workspace packages via `workspace:*` so they always
match the local build of the rest of the monorepo.

# `@jupyter-kit/e2e`

Playwright end-to-end tests against the pre-built Storybook static site.

## One-time setup

```sh
pnpm --filter @jupyter-kit/e2e install:browsers
```

(Downloads Chromium for Playwright — only needed once per machine.)

## Run

```sh
# Build storybook first (or reuse an existing build)
pnpm --filter @jupyter-kit/e2e storybook:build

# Run all tests headless
pnpm --filter @jupyter-kit/e2e test

# Interactive debug UI
pnpm --filter @jupyter-kit/e2e test:ui
```

The Playwright config auto-launches a static server on port 6007 from
`packages/storybook/storybook-static/`. Stories are loaded via
`/iframe.html?id=<story-id>`.

## Adding tests

Each story is a stable URL. Add a new `*.spec.ts` under `tests/` and target:

```ts
await page.goto('/iframe.html?id=basic--default&viewMode=story');
```

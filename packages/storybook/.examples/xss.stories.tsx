import type { Meta, StoryObj } from '@storybook/react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';

import xss from '@jupyter-kit/fixtures/ipynb/xss';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';

const meta: Meta<typeof Notebook> = {
  title: 'Security/XSS',
  component: Notebook,
};
export default meta;

type Story = StoryObj<typeof Notebook>;

/**
 * Renders a notebook whose markdown / outputs contain `<script>`,
 * `onerror=`, `javascript:`, SVG-embedded scripts, iframe srcdoc, etc.
 * Purely a target for the e2e security suite — it must render without
 * any of those payloads executing. Assertions live in
 * `packages/e2e/tests/xss.spec.ts`.
 */
export const Attacks: Story = {
  render: () => (
    <Notebook
      ipynb={xss as never}
      language="python"
      languages={[python]}
    />
  ),
};

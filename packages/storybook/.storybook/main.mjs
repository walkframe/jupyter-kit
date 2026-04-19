const config = {
  stories: ['../.examples/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  typescript: {
    check: false,
    reactDocgen: false,
  },
  // Rewrite the published per-chrome theme paths
  //   `@jupyter-kit/theme-<name>/<name>.css`
  //   `@jupyter-kit/theme-<name>/syntax/<syntax>.css`
  // to the workspace's single theme package so stories source matches the
  // import strings users will paste into their own projects. `?inline` is
  // preserved via the capture group.
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = [
      ...(Array.isArray(config.resolve.alias) ? config.resolve.alias : []),
      {
        find: /^@jupyter-kit\/theme-([^/]+)\/\1\.css(\?.*)?$/,
        replacement: '@jupyter-kit/theme/chrome/$1.css$2',
      },
      {
        find: /^@jupyter-kit\/theme-[^/]+\/syntax\/(.+)$/,
        replacement: '@jupyter-kit/theme/syntax/$1',
      },
    ];
    return config;
  },
};

export default config;

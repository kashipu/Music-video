

/** @type { import('@storybook/vue3-vite').StorybookConfig } */
const config = {
  stories: ['../src/**/*.stories.js'],
  "framework": {
    "name": "@storybook/vue3-vite",
    "options": {}
  },
  viteFinal: config => ({
    ...config,
    plugins: config.plugins?.flat().filter(({ name }) => !name?.startsWith('vite-plugin-pwa')),
  }),
};
export default config;

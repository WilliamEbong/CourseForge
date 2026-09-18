import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  framework: { name: '@storybook/html-vite', options: {} },
  stories: ['../components/course-ui/stories/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y'],
  core: { disableTelemetry: true },
};

export default config;

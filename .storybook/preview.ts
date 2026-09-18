import type { Preview } from '@storybook/html-vite';
import '../components/course-ui/src/styles/base.css';
import '../components/course-ui/src/styles/components.css';
import '../components/course-ui/src/styles/utilities.css';
import { applyTheme } from '../components/course-ui/stories/support.js';
import { VISUAL_FAMILIES } from '../src/core/enums.js';

// Establish the cascade-layer order before any component CSS is parsed.
const order = document.createElement('style');
order.textContent = '@layer cf.tokens, cf.base, cf.components, cf.utilities;';
document.head.prepend(order);

const preview: Preview = {
  globalTypes: {
    family: {
      description: 'CourseForge visual family',
      toolbar: { title: 'Family', icon: 'paintbrush', items: [...VISUAL_FAMILIES], dynamicTitle: true },
    },
    scheme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Scheme',
        icon: 'mirror',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { family: 'scientific-clinical', scheme: 'light' },
  parameters: {
    layout: 'padded',
    viewport: {
      options: {
        mobile: { name: 'Mobile 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
        desktop: { name: 'Desktop 1440', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
      },
    },
    a11y: { test: 'error', options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] } },
  },
  decorators: [
    (story, context) => {
      applyTheme(String(context.globals.family ?? 'scientific-clinical'), String(context.globals.scheme ?? 'light'));
      return story();
    },
  ],
};

export default preview;

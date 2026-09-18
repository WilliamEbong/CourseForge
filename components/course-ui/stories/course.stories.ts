import type { Meta, StoryObj } from '@storybook/html-vite';
import { AppShell, courseData, dataScript } from '../src/components/shell.js';
import { boot } from '../src/runtime/app.js';
import { frame, model, VIEWPORTS, visuals } from './support.js';

let controller: AbortController | null = null;

/** The complete smoke course, hydrated by the real runtime (router, progress, dialogs, scoring). */
function renderCourse(): HTMLElement {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const el = frame(`${AppShell.render({ model, visuals })}${dataScript(courseData(model))}`, 'cf-sb-course');
  requestAnimationFrame(() => {
    if (!signal.aborted) boot(document, { signal });
  });
  return el;
}

const meta: Meta = {
  title: 'Course/Full course',
  render: renderCourse,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

export const Desktop: Story = { ...VIEWPORTS.desktop };
export const Tablet: Story = { ...VIEWPORTS.tablet };
export const Mobile: Story = { ...VIEWPORTS.mobile };
export const DesktopDark: Story = { ...VIEWPORTS.desktop, globals: { ...VIEWPORTS.desktop.globals, scheme: 'dark' } };
export const TechnicalIndustrial: Story = {
  ...VIEWPORTS.desktop,
  globals: { ...VIEWPORTS.desktop.globals, family: 'technical-industrial' },
};
export const CorporateProfessional: Story = {
  ...VIEWPORTS.desktop,
  globals: { ...VIEWPORTS.desktop.globals, family: 'corporate-professional' },
};
export const EditorialHumanities: Story = { ...VIEWPORTS.mobile, globals: { ...VIEWPORTS.mobile.globals, family: 'editorial-humanities' } };

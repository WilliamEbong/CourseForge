import type { Meta, StoryObj } from '@storybook/html-vite';
import type { Screen } from '../../../src/core/schemas/model.js';
import { Figure } from '../src/components/figure.js';
import { createContext, ScreenView } from '../src/components/screens.js';
import { frame, hydrate, model, screen, VIEWPORTS, visuals } from './support.js';

type Length = 'short' | 'long' | 'dense';
interface Args {
  id: string;
  length: Length;
}

const LONG = `\n\nIn practice, supervisors report that workers who know the structure of the sheet find first-aid and spill information several times faster than those who read from the top. That speed matters most in the first minutes of an incident, when the right action taken early prevents a minor exposure from becoming a serious one.\n\nThe same structure also makes the sheet easier to audit: a reviewer can check a handful of sections across every product on site and quickly spot sheets that are outdated or incomplete.`;
const DENSE = `\n\n- **Section 9** lists physical and chemical properties such as flash point, vapour pressure and pH.\n- **Section 10** covers stability, reactivity, conditions to avoid and incompatible materials.\n- **Section 11** summarises toxicology by route of exposure, with symptoms and acute and chronic effects.\n- **Sections 12–15** are not enforced by OSHA but often hold ecological, disposal, transport and regulatory information.\n- **Section 16** records the date of preparation or last revision.\n\n| Section | Typical question | Who uses it |\n|---|---|---|\n| 9 | Will it evaporate quickly? | Hygienists |\n| 10 | What must it never be stored with? | Stores, operators |\n| 11 | What are the symptoms of overexposure? | Medical, first aiders |`;

function withLength(s: Screen, length: Length): Screen {
  if (length === 'short') return s;
  return { ...s, body: s.body + (length === 'long' ? LONG : DENSE) };
}

const meta: Meta<Args> = {
  title: 'Components/Screens',
  args: { id: 'SDS-02', length: 'short' },
  argTypes: { length: { control: 'inline-radio', options: ['short', 'long', 'dense'] } },
  render: ({ id, length }) => {
    const s = withLength(screen(id), length);
    const ctx = createContext({ ...model, screens: model.screens.map((x) => (x.id === id ? s : x)) }, visuals);
    return hydrate(frame(`<div class="cf-stage">${ScreenView.render({ screen: s, ctx, position: s.index, hidden: false })}</div>`));
  },
};
export default meta;
type Story = StoryObj<Args>;

export const ModuleLanding: Story = { args: { id: 'SDS-01' } };
export const ModuleLandingMobile: Story = { args: { id: 'SDS-07' }, ...VIEWPORTS.mobile };
export const Content: Story = {};
export const ContentLong: Story = { args: { length: 'long' } };
export const ContentDenseMobile: Story = { args: { length: 'dense' }, ...VIEWPORTS.mobile };
export const Concept: Story = { args: { id: 'SDS-03' } };
export const LawCallout: Story = { args: { id: 'SDS-04' } };
export const WarningCallout: Story = { args: { id: 'SDS-10' } };
export const Comparison: Story = { args: { id: 'SDS-09' } };
export const ComparisonTablet: Story = { args: { id: 'SDS-09' }, ...VIEWPORTS.tablet };
export const Process: Story = { args: { id: 'SDS-08' } };
export const TechnicalDepth: Story = {
  args: { id: 'SDS-11' },
  play: ({ canvasElement }) => {
    canvasElement.querySelector('details')?.setAttribute('open', '');
  },
};
export const Scenario: Story = { args: { id: 'SDS-12' } };
export const Review: Story = { args: { id: 'SDS-16' } };
export const ResultsPending: Story = { args: { id: 'SDS-21' } };

/** Callout variants that the smoke course does not exercise (guidance, standard, misconception, qualification). */
export const CalloutVariants: StoryObj = {
  render: () => {
    const ctx = createContext(model, visuals);
    const base = screen('SDS-04');
    const variants: Screen[] = [
      {
        ...base,
        id: 'X-G',
        subtype: 'guidance',
        title: 'Guidance callout',
        body: 'OSHA’s brief recommends training workers to find Sections 4, 6 and 8 quickly.',
      },
      {
        ...base,
        id: 'X-S',
        subtype: 'standard',
        title: 'Standard callout',
        body: 'GHS Annex 4 defines the content expected in each of the sixteen sections.',
      },
      {
        ...base,
        id: 'X-M',
        component: 'misconception',
        kind: 'misconception',
        title: 'Misconception',
        body: '“If the label has no pictogram, the product needs no SDS.” Hazard classification, not pictograms, decides.',
      },
      {
        ...base,
        id: 'X-Q',
        component: 'warning-callout',
        kind: 'warning',
        subtype: 'qualification',
        title: 'Qualification',
        body: 'Exposure limits apply to healthy adult workers and are not bright lines between safe and unsafe.',
      },
    ];
    return frame(
      `<div class="cf-stage">${variants.map((s, i) => ScreenView.render({ screen: s, ctx, position: i, hidden: false })).join('<hr>')}</div>`,
    );
  },
};

/** Figure wrapper with inline SVG and the structured text-equivalent fallback. */
export const Figures: StoryObj = {
  render: () => {
    const v = model.visuals;
    return frame(
      `<div class="cf-stage cf-screen-body">${Figure.render({ visual: v[0]!, render: visuals.get('V-01'), number: 1 })}${Figure.render({ visual: v[1]!, number: 2 })}${Figure.render({ visual: v[2]!, number: 3 })}</div>`,
    );
  },
};

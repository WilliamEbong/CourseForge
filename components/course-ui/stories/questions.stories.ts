import type { Meta, StoryObj } from '@storybook/html-vite';
import { Question } from '../src/components/question.js';
import type { CfAnswer } from '../src/runtime/types.js';
import { frame, hydrate, screen, VIEWPORTS } from './support.js';

type State = 'default' | 'correct' | 'incorrect' | 'disabled' | 'focus';
interface Args {
  id: string;
  state: State;
  graded: boolean;
}

function savedFor(id: string, state: State): CfAnswer | undefined {
  const i = screen(id).interaction!;
  if (state !== 'correct' && state !== 'incorrect' && state !== 'disabled') return undefined;
  const good = state !== 'incorrect';
  const wrongKey = i.options.find((o) => !i.correctKeys.includes(o.key))?.key ?? '';
  const targets = i.targets.map((t) => t.key);
  return {
    correct: good,
    attempts: 1,
    response: {
      keys: good ? i.correctKeys : [wrongKey],
      mapping: Object.fromEntries(i.mapping.map((m) => [m.key, good ? m.target : (targets.find((t) => t !== m.target) ?? '')])),
      order: good ? i.order : [...i.order].reverse(),
    },
  };
}

const meta: Meta<Args> = {
  title: 'Components/Question',
  args: { id: 'SDS-05', state: 'default', graded: false },
  argTypes: {
    state: { control: 'inline-radio', options: ['default', 'focus', 'correct', 'incorrect', 'disabled'] },
    id: { control: 'select', options: ['SDS-05', 'SDS-06', 'SDS-12', 'SDS-13', 'SDS-14', 'SDS-15', 'SDS-18', 'SDS-19', 'SDS-20'] },
  },
  render: ({ id, state, graded }) => {
    const s = screen(id);
    const g = graded || s.graded || state === 'disabled';
    const el = frame(`<div class="cf-stage">${Question.render({ id, interaction: s.interaction!, graded: g })}</div>`);
    return hydrate(el, (qid) => savedFor(qid, state));
  },
  play: ({ canvasElement, args }) => {
    if (args.state === 'focus')
      canvasElement.querySelector<HTMLElement>('input, select, [data-cf-move]:not([disabled]), [data-cf-reveal]')?.focus();
  },
};
export default meta;
type Story = StoryObj<Args>;

export const SingleChoice: Story = {};
export const SingleFocus: Story = { args: { state: 'focus' } };
export const SingleCorrect: Story = { args: { state: 'correct' } };
export const SingleIncorrect: Story = { args: { state: 'incorrect' } };
export const MultipleResponse: Story = { args: { id: 'SDS-06' } };
export const MultipleIncorrect: Story = { args: { id: 'SDS-06', state: 'incorrect' } };
export const Matching: Story = { args: { id: 'SDS-13' } };
export const MatchingIncorrectMobile: Story = { args: { id: 'SDS-13', state: 'incorrect' }, ...VIEWPORTS.mobile };
export const Categorization: Story = { args: { id: 'SDS-14' } };
export const CategorizationCorrect: Story = { args: { id: 'SDS-14', state: 'correct' } };
export const Sequencing: Story = { args: { id: 'SDS-15' } };
export const SequencingFocusMobile: Story = { args: { id: 'SDS-15', state: 'focus' }, ...VIEWPORTS.mobile };
export const SequencingIncorrect: Story = { args: { id: 'SDS-15', state: 'incorrect' } };
export const Reveal: Story = { args: { id: 'SDS-12' } };
export const GradedSingle: Story = { args: { id: 'SDS-18' } };
export const GradedDisabled: Story = { args: { id: 'SDS-19', state: 'disabled' } };
export const GradedSequencingTablet: Story = { args: { id: 'SDS-20' }, ...VIEWPORTS.tablet };

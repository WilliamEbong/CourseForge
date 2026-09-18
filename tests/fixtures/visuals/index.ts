/** Visual spec fixtures covering every archetype (chemical-safety themed, realistic label lengths). */
import type { VisualArchetype } from '../../../src/core/enums.js';
import type { VisualContent, VisualSpec } from '../../../src/core/schemas/content.js';

type Partial2 = Partial<VisualContent>;
type It = [id: string, label: string, detail?: string | null, group?: string | null, value?: number | null];

export const items = (...list: It[]): VisualContent['items'] =>
  list.map(([id, label, detail = null, group = null, value = null]) => ({ id, label, detail, group, value }));

export function makeSpec(id: string, archetype: VisualArchetype, content: Partial2, extra: Partial<VisualSpec> = {}): VisualSpec {
  return {
    id,
    title: extra.title ?? `${archetype.toLowerCase().replace(/_/g, ' ')} example`,
    purpose: 'Show the structure so learners can recall it.',
    archetype,
    content: {
      items: [],
      links: [],
      groups: [],
      columns: [],
      rows: [],
      axes: { x: null, y: null },
      chartType: null,
      ...content,
    },
    sourceIds: [],
    textEquivalent: {
      short: `${archetype} diagram`,
      long: `A ${archetype.toLowerCase()} figure describing the chemical-safety workflow in structured form.`,
    },
    interaction: 'none',
    rendererOverride: null,
    mermaid: null,
    ...extra,
  };
}

const chain = (ids: string[]) => ids.slice(1).map((to, i) => ({ from: ids[i] as string, to, label: null }));

export const FIXTURES: Record<string, VisualSpec> = {
  process: makeSpec('v-process', 'PROCESS', {
    items: items(
      ['identify', 'Identify the hazard', 'Read the label and the safety data sheet'],
      ['assess', 'Assess exposure', 'Who, how long, which route'],
      ['control', 'Choose controls', 'Eliminate, substitute, engineer'],
      ['ppe', 'Select PPE', 'Last line of defence'],
      ['review', 'Review and record', 'Update the assessment after changes'],
    ),
  }),
  lifecycle: makeSpec('v-lifecycle', 'LIFECYCLE', {
    items: items(
      ['buy', 'Purchase', 'Approve before ordering'],
      ['store', 'Store', 'Segregate incompatibles'],
      ['use', 'Use', 'Follow the safe work procedure'],
      ['dispose', 'Dispose', 'Licensed waste contractor'],
      ['review', 'Review inventory', null],
    ),
  }),
  feedback: makeSpec('v-feedback', 'FEEDBACK_LOOP', {
    items: items(['report', 'Near-miss reported'], ['investigate', 'Root cause found'], ['fix', 'Control improved'], ['trust', 'Workers trust the system']),
    links: [
      { from: 'report', to: 'investigate', label: 'triggers' },
      { from: 'investigate', to: 'fix', label: 'informs' },
      { from: 'fix', to: 'trust', label: 'builds' },
      { from: 'trust', to: 'report', label: 'more reports' },
    ],
    groups: [{ id: 'g', label: 'Reinforcing loop' }],
  }),
  timeline: makeSpec('v-timeline', 'TIMELINE', {
    items: items(
      ['t1', '1974', 'Health and Safety at Work Act'],
      ['t2', '1988', 'First COSHH regulations'],
      ['t3', '2002', 'COSHH consolidated'],
      ['t4', '2009', 'CLP labels introduced'],
      ['t5', '2015', 'CLP fully in force'],
    ),
  }),
  timelineLong: makeSpec('v-timeline-long', 'TIMELINE', {
    items: items(
      ['a', 'Day 1', 'Spill reported to supervisor'],
      ['b', 'Day 1', 'Area isolated and ventilated'],
      ['c', 'Day 2', 'Clean-up by trained team'],
      ['d', 'Day 3', 'Health surveillance offered to exposed staff'],
      ['e', 'Week 2', 'Investigation report issued'],
      ['f', 'Week 4', 'Procedure revised and staff retrained'],
      ['g', 'Month 3', 'Effectiveness review'],
    ),
  }),
  hierarchy: makeSpec('v-hierarchy', 'HIERARCHY', {
    items: items(
      ['root', 'Hierarchy of controls'],
      ['elim', 'Elimination', 'Remove the hazard'],
      ['sub', 'Substitution', 'Use something safer'],
      ['eng', 'Engineering', 'Isolate people'],
      ['adm', 'Administrative', 'Change the way people work'],
      ['ppe', 'PPE', 'Protect the worker'],
      ['lev', 'Local exhaust ventilation'],
      ['enc', 'Enclosure'],
    ),
    links: [...['elim', 'sub', 'eng', 'adm', 'ppe'].map((to) => ({ from: 'root', to, label: null })), { from: 'eng', to: 'lev', label: null }, { from: 'eng', to: 'enc', label: null }],
  }),
  comparison: makeSpec('v-comparison', 'COMPARISON', {
    columns: ['Feature', 'Safety data sheet', 'Product label'],
    rows: [
      { label: 'Audience', cells: ['Employers, safety professionals', 'Every user of the product'] },
      { label: 'Detail', cells: ['16 sections with full technical data', 'Pictograms, signal word, key statements'] },
      { label: 'Where', cells: ['Supplied with first delivery; kept on file', 'On the container itself'] },
    ],
  }),
  beforeAfter: makeSpec('v-before-after', 'BEFORE_AFTER', {
    columns: ['Before the review', 'After the review'],
    rows: [
      { label: 'Storage', cells: ['Acids and bases on one shelf', 'Segregated cabinets with spill trays'] },
      { label: 'Training', cells: ['Annual slideshow', 'Task-specific practical sessions with a sign-off'] },
    ],
  }),
  layered: makeSpec('v-layered', 'LAYERED_SYSTEM', {
    groups: [
      { id: 'law', label: 'Law' },
      { id: 'reg', label: 'Regulations' },
      { id: 'guid', label: 'Guidance' },
      { id: 'local', label: 'Local procedures' },
    ],
    items: items(
      ['a', 'Health and Safety at Work Act', null, 'law'],
      ['b', 'COSHH', null, 'reg'],
      ['c', 'CLP', null, 'reg'],
      ['d', 'REACH', null, 'reg'],
      ['e', 'Approved Code of Practice L5', null, 'guid'],
      ['f', 'HSG97 step-by-step guide', null, 'guid'],
      ['g', 'Site safe work procedures', null, 'local'],
      ['h', 'Permit to work', null, 'local'],
      ['i', 'Toolbox talks', null, 'local'],
    ),
  }),
  responsibility: makeSpec('v-responsibility', 'RESPONSIBILITY_MAP', {
    groups: [
      { id: 'emp', label: 'Employer' },
      { id: 'mgr', label: 'Supervisor' },
      { id: 'wkr', label: 'Worker' },
    ],
    items: items(
      ['a', 'Carry out risk assessment', null, 'emp'],
      ['b', 'Provide controls and PPE', null, 'emp'],
      ['c', 'Arrange health surveillance', null, 'emp'],
      ['d', 'Check controls are used', null, 'mgr'],
      ['e', 'Report defects', 'Same shift', 'mgr'],
      ['f', 'Use controls properly', null, 'wkr'],
      ['g', 'Report concerns', null, 'wkr'],
    ),
  }),
  continuum: makeSpec('v-continuum', 'CONTINUUM', {
    columns: ['Most effective', 'Least effective'],
    items: items(['a', 'Elimination'], ['b', 'Substitution'], ['c', 'Engineering controls'], ['d', 'Administrative controls'], ['e', 'PPE']),
  }),
  matrix: makeSpec('v-matrix', 'MATRIX', {
    columns: ['Low likelihood', 'High likelihood'],
    rows: [
      { label: 'High severity', cells: ['Plan controls', 'Act now: stop work'] },
      { label: 'Low severity', cells: ['Monitor', 'Reduce with simple controls'] },
    ],
    axes: { x: 'Likelihood increases', y: 'Severity increases' },
  }),
  funnel: makeSpec('v-funnel', 'FUNNEL', {
    items: items(['a', 'Chemicals on site', null, null, 240], ['b', 'Classified as hazardous', null, null, 96], ['c', 'Need a COSHH assessment', null, null, 41], ['d', 'Need health surveillance', null, null, 7]),
  }),
  evidence: makeSpec('v-evidence', 'EVIDENCE_MAP', {
    items: items(
      ['c1', 'LEV reduces exposure below the limit', null],
      ['c2', 'Gloves alone are not enough', null],
      ['s1', 'HSE air-sampling study', '2019, 40 sites'],
      ['s2', 'Manufacturer permeation data', 'Breakthrough times'],
      ['s3', 'Site incident log', '2 dermatitis cases'],
    ),
    links: [
      { from: 's1', to: 'c1', label: 'supports' },
      { from: 's2', to: 'c2', label: 'supports' },
      { from: 's3', to: 'c2', label: 'supports' },
      { from: 's3', to: 'c1', label: 'challenges' },
    ],
  }),
  scenario: makeSpec('v-scenario', 'SCENARIO_MAP', {
    items: items(
      ['start', 'A drum is leaking in the store'],
      ['d1', 'Do you know what it is?'],
      ['o1', 'Follow the SDS spill procedure'],
      ['o2', 'Evacuate and call the emergency team'],
      ['o3', 'Walk away and tell nobody', 'Unsafe'],
    ),
    links: [
      { from: 'start', to: 'd1', label: 'You stop and look' },
      { from: 'start', to: 'o3', label: 'You ignore it' },
      { from: 'd1', to: 'o1', label: 'Yes' },
      { from: 'd1', to: 'o2', label: 'No' },
    ],
  }),
  decision: makeSpec('v-decision', 'DECISION_TREE', {
    items: items(['q1', 'Is the substance hazardous?'], ['q2', 'Can exposure be prevented?'], ['a1', 'No COSHH action needed'], ['a2', 'Prevent it'], ['a3', 'Control it adequately']),
    links: [
      { from: 'q1', to: 'a1', label: 'No' },
      { from: 'q1', to: 'q2', label: 'Yes' },
      { from: 'q2', to: 'a2', label: 'Yes' },
      { from: 'q2', to: 'a3', label: 'No' },
    ],
  }),
  cause: makeSpec('v-cause', 'CAUSE_EFFECT', {
    items: items(['a', 'Poor ventilation'], ['b', 'Vapour builds up'], ['c', 'Worker inhales solvent'], ['d', 'Dizziness and headaches']),
    links: chain(['a', 'b', 'c', 'd']),
  }),
  architecture: makeSpec('v-arch', 'SYSTEM_ARCHITECTURE', {
    groups: [
      { id: 'cap', label: 'Capture' },
      { id: 'ext', label: 'Extraction' },
    ],
    items: items(['hood', 'Capture hood', null, 'cap'], ['duct', 'Ducting', null, 'ext'], ['filter', 'Filter unit', null, 'ext'], ['fan', 'Fan', null, 'ext'], ['stack', 'Discharge stack']),
    links: chain(['hood', 'duct', 'filter', 'fan', 'stack']),
  }),
  sequence: makeSpec('v-sequence', 'SEQUENCE', {
    items: items(['w', 'Worker'], ['s', 'Supervisor'], ['h', 'Health & Safety']),
    links: [
      { from: 'w', to: 's', label: 'Reports spill' },
      { from: 's', to: 'h', label: 'Escalates: "major" spill' },
      { from: 'h', to: 'w', label: 'Instructions' },
    ],
  }),
  state: makeSpec('v-state', 'STATE_DIAGRAM', {
    items: items(['draft', 'Draft'], ['review', 'Under review'], ['approved', 'Approved'], ['expired', 'Expired']),
    links: [
      { from: 'draft', to: 'review', label: 'submit' },
      { from: 'review', to: 'draft', label: 'changes needed' },
      { from: 'review', to: 'approved', label: 'sign off' },
      { from: 'approved', to: 'expired', label: 'after 12 months' },
    ],
  }),
  labeled: makeSpec('v-labeled', 'LABELED_OBJECT', {
    items: items(
      ['obj', 'Chemical container label'],
      ['p', 'Hazard pictogram', 'Red diamond'],
      ['s', 'Signal word', 'Danger or Warning'],
      ['h', 'Hazard statements'],
      ['pr', 'Precautionary statements'],
      ['id', 'Product identifier'],
      ['sup', 'Supplier contact'],
    ),
  }),
  network: makeSpec('v-network', 'RELATIONSHIP_NETWORK', {
    items: items(['coshh', 'COSHH'], ['clp', 'CLP'], ['reach', 'REACH'], ['sds', 'Safety data sheet'], ['ra', 'Risk assessment'], ['wel', 'Exposure limits'], ['hs', 'Health surveillance']),
    links: [
      { from: 'coshh', to: 'ra', label: 'requires' },
      { from: 'coshh', to: 'wel', label: 'uses' },
      { from: 'coshh', to: 'hs', label: 'requires' },
      { from: 'clp', to: 'sds', label: 'informs' },
      { from: 'reach', to: 'sds', label: 'mandates' },
      { from: 'sds', to: 'ra', label: 'feeds' },
    ],
  }),
  chart: makeSpec('v-chart', 'QUANTITATIVE_CHART', {
    items: items(['a', 'Skin', null, null, 42], ['b', 'Inhalation', null, null, 35], ['c', 'Ingestion', null, null, 8], ['d', 'Eye', null, null, 15]),
    axes: { x: 'Exposure route', y: 'Reported cases (%)' },
    chartType: 'bar',
  }),
  chartSeries: makeSpec('v-chart-series', 'QUANTITATIVE_CHART', {
    columns: ['Year', 'Site A', 'Site B'],
    rows: [
      { label: '2021', cells: ['12', '9'] },
      { label: '2022', cells: ['9', '8'] },
      { label: '2023', cells: ['6', '7'] },
      { label: '2024', cells: ['4', '5'] },
    ],
    axes: { x: 'Year', y: 'Incidents' },
    chartType: 'line',
  }),
};

export const HOSTILE = makeSpec('v-hostile', 'PROCESS', {
  items: items(
    ['a"b', 'Say "hello" <script>alert(1)</script>', null],
    ['c[d]', 'Brackets [x] {y} (z) & ampersand #hash; semi', null],
    ['e', 'Pipes | and --> arrows and `ticks`', null],
  ),
});

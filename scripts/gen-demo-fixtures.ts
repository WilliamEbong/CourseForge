/**
 * Generates the deterministic fake-harness fixture set used for offline end-to-end runs, CI and demos:
 * `tests/fixtures/harness/demo/<promptTemplate>/<subject>[.c<cycle>].json`.
 *
 * The content is a real micro-course ("Spotting Phishing Emails"). Every agent output is schema-valid and
 * consistent across stages so the whole pipeline runs concept → release without a model. One reviewer
 * raises a finding in the first storyboard review cycle so the adjudication → repair → re-review loop runs.
 *
 * Usage: npx tsx scripts/gen-demo-fixtures.ts [--check]
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Block,
  ClaimRecord,
  ConceptBrief,
  DossierSectionAgent,
  EditorialResult,
  FindingSet,
  InstructionalDesign,
  Interaction,
  RepairResult,
  ResearchBrief,
  SourceRecord,
  StoryboardModulePart,
  VisualDirectionAgent,
  VisualSpec,
} from '../src/core/schemas/index.js';
import {
  ConceptBriefSchema,
  DossierSectionAgentSchema,
  EditorialResultSchema,
  FindingSetSchema,
  InstructionalDesignSchema,
  RepairResultSchema,
  ResearchBriefSchema,
  StoryboardModulePartSchema,
  VisualDirectionAgentSchema,
} from '../src/core/schemas/index.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'harness', 'demo');

/* ----------------------------------------------------------------- sources */

const SOURCES: SourceRecord[] = [
  {
    id: 'CISA-PHISH',
    title: 'Recognize and Report Phishing',
    author: null,
    publisher: 'Cybersecurity and Infrastructure Security Agency (CISA)',
    type: 'government-guidance',
    url: 'https://www.cisa.gov/secure-our-world/recognize-and-report-phishing',
    doi: null,
    date: null,
    version: null,
    accessed: '2026-09-18',
    jurisdiction: 'United States',
    authority: 'primary',
    currentnessNotes: 'Public guidance page; recheck before republication.',
    licenseNotes: 'Paraphrased; no text reproduced.',
  },
  {
    id: 'NCSC-PHISH',
    title: 'Phishing attacks: defending your organisation',
    author: null,
    publisher: 'UK National Cyber Security Centre (NCSC)',
    type: 'government-guidance',
    url: 'https://www.ncsc.gov.uk/guidance/phishing',
    doi: null,
    date: null,
    version: null,
    accessed: '2026-09-18',
    jurisdiction: 'United Kingdom',
    authority: 'primary',
    currentnessNotes: 'Guidance is periodically revised.',
    licenseNotes: 'Paraphrased; no text reproduced.',
  },
  {
    id: 'FTC-PHISH',
    title: 'How to Recognize and Avoid Phishing Scams',
    author: null,
    publisher: 'US Federal Trade Commission (FTC) Consumer Advice',
    type: 'government-guidance',
    url: 'https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams',
    doi: null,
    date: null,
    version: null,
    accessed: '2026-09-18',
    jurisdiction: 'United States',
    authority: 'primary',
    currentnessNotes: null,
    licenseNotes: 'Paraphrased; no text reproduced.',
  },
];

const cite = (sourceId: string, locator: string | null = null) => ({ sourceId, locator });

/* ----------------------------------------------------------------- concept */

const concept: ConceptBrief = {
  title: 'Spotting Phishing Emails',
  summary:
    'A short, practical course that helps office staff recognise the common warning signs of phishing emails, check suspicious messages safely, and report them through the right channel.',
  audience: 'Office staff with everyday email use and no security specialism',
  prerequisites: ['Uses a work email account daily'],
  targetDurationMinutes: 20,
  language: 'en',
  jurisdiction: null,
  riskTier: 'standard',
  riskRationale: 'General security awareness; no regulated or hazardous activity is taught.',
  domains: ['information security awareness'],
  learningGoals: ['Recognise phishing warning signs', 'Check a suspicious message safely', 'Report a suspected phish correctly'],
  assumptions: [{ text: 'Learners have a reporting button or security mailbox at work.', highStakes: false }],
  gaps: ['Organisation-specific reporting channel must be configured before deployment.'],
  outOfScope: ['Technical email authentication (SPF, DKIM, DMARC) configuration', 'Incident forensics'],
};

/* ------------------------------------------------------------ research brief */

const brief: ResearchBrief = {
  title: 'Spotting Phishing Emails — research brief',
  purpose: 'Establish an evidence base for a short awareness course on recognising, checking and reporting phishing emails.',
  audience: concept.audience,
  scope: ['Common phishing warning signs', 'Safe verification behaviours', 'Reporting practices'],
  exclusions: concept.outOfScope,
  researchQuestions: [
    { id: 'RQ1', question: 'What warning signs do authoritative agencies highlight for phishing emails?', priority: 'core' },
    { id: 'RQ2', question: 'How should an employee verify a suspicious message without taking risky actions?', priority: 'core' },
    { id: 'RQ3', question: 'What reporting behaviours do agencies recommend and why does fast reporting matter?', priority: 'core' },
  ],
  sourceHierarchy: [
    { rank: 1, sourceType: 'government-guidance', rationale: 'National cyber-security agencies publish current, authoritative guidance.' },
    { rank: 2, sourceType: 'professional-guidance', rationale: 'Industry bodies add practical detail.' },
  ],
  jurisdictions: ['General (US and UK guidance used as reference)'],
  safetyBoundaries: ['Do not instruct learners to open attachments or links to test them.'],
  dossierPlan: [
    { sectionId: 'RS-01', title: 'Warning signs of phishing', questionIds: ['RQ1'], notes: 'Focus on signs a non-specialist can check.' },
    { sectionId: 'RS-02', title: 'Verifying and reporting', questionIds: ['RQ2', 'RQ3'], notes: 'Safe verification and reporting steps.' },
  ],
  evidenceRequirements: ['Every claim cites at least one authoritative source.'],
  currentnessRequirements: ['Record the access date of every web source.'],
};

/* ------------------------------------------------------------------- dossier */

function claim(id: string, text: string, category: ClaimRecord['category'], sourceIds: string[]): ClaimRecord {
  return {
    id,
    text,
    category,
    citations: sourceIds.map((s) => cite(s)),
    sectionId: null,
    jurisdiction: null,
    confidence: 'high',
    qualifications: null,
  };
}

const dossierSections: Record<string, DossierSectionAgent> = {
  'RS-01': {
    sectionId: 'RS-01',
    title: 'Warning signs of phishing',
    markdown:
      'Phishing emails try to get the recipient to click a link, open an attachment or hand over information by imitating a trusted sender [CISA-PHISH; FTC-PHISH].\n\nAgencies consistently highlight a small set of warning signs: an unexpected request for credentials, payment or personal data; manufactured urgency or threats; a sender address or link destination that does not match the organisation it claims to be; and generic greetings or unusual tone [CISA-PHISH; NCSC-PHISH; FTC-PHISH].\n\nNo single sign proves a message is malicious, and well-crafted phishing may show few of them, so the signs are prompts to verify rather than a checklist that clears a message [NCSC-PHISH].',
    sources: SOURCES,
    claims: [
      claim('c1', 'Phishing emails imitate trusted senders to obtain clicks, attachment opens or information.', 'definition', [
        'CISA-PHISH',
        'FTC-PHISH',
      ]),
      claim(
        'c2',
        'Urgency, threats and unexpected requests for credentials or payment are common phishing signs.',
        'guidance-recommendation',
        ['CISA-PHISH', 'FTC-PHISH'],
      ),
      claim(
        'c3',
        'A mismatch between the displayed sender or link text and the real address is a warning sign.',
        'guidance-recommendation',
        ['NCSC-PHISH', 'CISA-PHISH'],
      ),
      claim('c4', 'Absence of warning signs does not prove a message is safe.', 'guidance-recommendation', ['NCSC-PHISH']),
    ],
  },
  'RS-02': {
    sectionId: 'RS-02',
    title: 'Verifying and reporting',
    markdown:
      'When a message is suspicious, agencies advise verifying through a separate, trusted channel — for example a known phone number or by typing the organisation’s address into the browser — rather than using links or contact details in the message [FTC-PHISH; CISA-PHISH].\n\nSuspected phishing should be reported through the organisation’s reporting route; early reports let security teams warn others and block the campaign [NCSC-PHISH; CISA-PHISH]. Someone who has already clicked or entered details should report immediately rather than hide it [NCSC-PHISH].',
    sources: SOURCES,
    claims: [
      claim('c1', 'Verify suspicious requests through an independent, known channel, not the message itself.', 'guidance-recommendation', [
        'FTC-PHISH',
        'CISA-PHISH',
      ]),
      claim('c2', 'Reporting suspected phishing quickly helps protect colleagues.', 'guidance-recommendation', [
        'NCSC-PHISH',
        'CISA-PHISH',
      ]),
      claim('c3', 'People who have already interacted with a phish should report immediately.', 'guidance-recommendation', ['NCSC-PHISH']),
    ],
  },
};

/* -------------------------------------------------------- instructional design */

const design: InstructionalDesign = {
  title: concept.title,
  audience: concept.audience,
  prerequisites: concept.prerequisites,
  scopeBoundaries: ['Awareness level only; technical controls are out of scope.'],
  durationMinutes: 20,
  objectives: [
    {
      id: 'LO1',
      statement: 'Identify the common warning signs of a phishing email.',
      verb: 'identify',
      bloomLevel: 'understand',
      claimIds: ['CLM-0001', 'CLM-0002', 'CLM-0003'],
      sourceIds: ['CISA-PHISH', 'FTC-PHISH', 'NCSC-PHISH'],
    },
    {
      id: 'LO2',
      statement: 'Explain why the absence of warning signs does not prove an email is safe.',
      verb: 'explain',
      bloomLevel: 'understand',
      claimIds: ['CLM-0004'],
      sourceIds: ['NCSC-PHISH'],
    },
    {
      id: 'LO3',
      statement: 'Select a safe way to verify a suspicious request.',
      verb: 'select',
      bloomLevel: 'apply',
      claimIds: ['CLM-0005'],
      sourceIds: ['FTC-PHISH', 'CISA-PHISH'],
    },
    {
      id: 'LO4',
      statement: 'Sequence the correct steps for reporting a suspected phishing email.',
      verb: 'sequence',
      bloomLevel: 'apply',
      claimIds: ['CLM-0006', 'CLM-0007'],
      sourceIds: ['NCSC-PHISH', 'CISA-PHISH'],
    },
  ],
  dispositions: [
    { topic: 'Warning signs', disposition: 'core', reason: 'Central to recognition.', sourceIds: ['CISA-PHISH'] },
    { topic: 'Verification and reporting', disposition: 'core', reason: 'Turns recognition into safe action.', sourceIds: ['NCSC-PHISH'] },
    {
      topic: 'Email authentication protocols',
      disposition: 'excluded',
      reason: 'Technical administration beyond the audience.',
      sourceIds: [],
    },
  ],
  modules: [
    {
      id: 'M1',
      title: 'Recognising phishing',
      purpose: 'Build recognition of warning signs and their limits.',
      loIds: ['LO1', 'LO2'],
      contentSequence: ['What phishing is', 'Warning signs', 'Limits of the checklist'],
      misconceptions: ['A professional-looking email must be genuine'],
      examples: ['Fake password-expiry notice'],
      formativePractice: ['Spot the signs', 'Sort signals'],
      durationMinutes: 9,
      sourceIds: ['CISA-PHISH', 'NCSC-PHISH', 'FTC-PHISH'],
    },
    {
      id: 'M2',
      title: 'Checking and reporting',
      purpose: 'Practise safe verification and correct reporting.',
      loIds: ['LO3', 'LO4'],
      contentSequence: ['Verify through a separate channel', 'Report quickly', 'If you already clicked'],
      misconceptions: ['Replying to ask whether it is real is safe'],
      examples: ['Supplier bank-detail change'],
      formativePractice: ['Choose the safe check', 'Order the reporting steps'],
      durationMinutes: 8,
      sourceIds: ['FTC-PHISH', 'NCSC-PHISH'],
    },
  ],
  alignment: [
    {
      loId: 'LO1',
      moduleIds: ['M1'],
      formativeMethod: 'Multiple-response sign spotting',
      gradedMethod: 'Scenario multiple choice',
      cognitiveLevel: 'understand',
    },
    {
      loId: 'LO2',
      moduleIds: ['M1'],
      formativeMethod: 'Categorisation of signals',
      gradedMethod: 'Single choice',
      cognitiveLevel: 'understand',
    },
    {
      loId: 'LO3',
      moduleIds: ['M2'],
      formativeMethod: 'Scenario single choice',
      gradedMethod: 'Scenario single choice',
      cognitiveLevel: 'apply',
    },
    { loId: 'LO4', moduleIds: ['M2'], formativeMethod: 'Sequencing', gradedMethod: 'Sequencing', cognitiveLevel: 'apply' },
  ],
  assessmentStrategy: {
    formativePerModule: 2,
    gradedItemCount: 4,
    passingPercent: 75,
    notes: 'Each objective is practised once and assessed once in the graded quiz.',
  },
  scenarioStrategy: 'One continuing workplace inbox scenario across both modules.',
  glossaryPlan: [
    { term: 'Phishing', definition: 'A message that imitates a trusted sender to trick the recipient into an unsafe action.' },
    { term: 'Spoofing', definition: 'Disguising a message’s sender or link so it appears to come from someone else.' },
  ],
  evidenceGaps: [],
};

/* ---------------------------------------------------------------- storyboard */

function block(
  id: string,
  kind: Block['kind'],
  title: string,
  body: string,
  loIds: string[],
  citations: { sourceId: string; locator: string | null }[],
  extra: Partial<Block> = {},
): Block {
  return {
    id,
    kind,
    subtype: null,
    title,
    optional: false,
    body,
    treatment: 'Short explanatory screen.',
    loIds,
    citations,
    claimIds: [],
    visualId: null,
    accessibility: 'All content is available as text.',
    interaction: null,
    difficulty: null,
    ...extra,
  };
}

function q(mode: Interaction['mode'], stem: string, parts: Partial<Interaction>): Interaction {
  return {
    mode,
    stem,
    options: [],
    targets: [],
    correctKeys: [],
    mapping: [],
    order: [],
    feedbackCorrect: 'Correct.',
    feedbackIncorrect: 'Not quite.',
    optionFeedback: [],
    rationale: '',
    ...parts,
  };
}

const V_SIGNS: VisualSpec = {
  id: 'V-01',
  title: 'Five warning signs to check',
  purpose: 'Give learners a compact mental checklist of the signs agencies highlight.',
  archetype: 'COMPARISON',
  content: {
    items: [],
    links: [],
    groups: [],
    columns: ['Warning sign', 'What to look for'],
    rows: [
      { label: 'Unexpected request', cells: ['Credentials, payment or personal data you were not expecting to give'] },
      { label: 'Urgency or threats', cells: ['Deadlines, account closure, penalties'] },
      { label: 'Mismatched sender', cells: ['Display name and real address do not match'] },
      { label: 'Mismatched link', cells: ['Link text and real destination differ'] },
      { label: 'Generic or odd tone', cells: ['“Dear customer”, unusual wording or style'] },
    ],
    axes: { x: null, y: null },
    chartType: null,
  },
  sourceIds: ['CISA-PHISH', 'NCSC-PHISH', 'FTC-PHISH'],
  textEquivalent: {
    short: 'Table of five phishing warning signs and what to look for',
    long: 'Five warning signs: an unexpected request for credentials, payment or personal data; urgency or threats such as deadlines or account closure; a sender display name that does not match the real address; link text that does not match the real destination; and a generic greeting or unusual tone.',
  },
  interaction: 'none',
  rendererOverride: null,
  mermaid: null,
};

const V_REPORT: VisualSpec = {
  id: 'V-02',
  title: 'From suspicion to report',
  purpose: 'Show the safe sequence from noticing a suspicious email to reporting it.',
  archetype: 'PROCESS',
  content: {
    items: [
      { id: 's1', label: 'Pause', detail: 'Do not click, open or reply', group: null, value: null },
      { id: 's2', label: 'Check the signs', detail: 'Sender, links, request, tone', group: null, value: null },
      { id: 's3', label: 'Verify separately', detail: 'Use a known contact route', group: null, value: null },
      { id: 's4', label: 'Report', detail: 'Use the report button or security mailbox', group: null, value: null },
      { id: 's5', label: 'Delete', detail: 'After reporting, remove the message', group: null, value: null },
    ],
    links: [
      { from: 's1', to: 's2', label: null },
      { from: 's2', to: 's3', label: null },
      { from: 's3', to: 's4', label: null },
      { from: 's4', to: 's5', label: null },
    ],
    groups: [],
    columns: [],
    rows: [],
    axes: { x: null, y: null },
    chartType: null,
  },
  sourceIds: ['NCSC-PHISH', 'CISA-PHISH'],
  textEquivalent: {
    short: 'Five-step process from pausing to reporting a suspicious email',
    long: 'Step 1, pause: do not click, open attachments or reply. Step 2, check the warning signs: sender, links, request and tone. Step 3, verify through a separate known contact route. Step 4, report using the report button or security mailbox. Step 5, delete the message after reporting.',
  },
  interaction: 'none',
  rendererOverride: null,
  mermaid: null,
};

const V_REPORTS: VisualSpec = {
  id: 'V-03',
  title: 'Why speed matters: illustrative reporting timeline',
  purpose: 'Illustrate that earlier reports protect more colleagues (illustrative figures, not statistics).',
  archetype: 'QUANTITATIVE_CHART',
  content: {
    items: [
      { id: 'r1', label: 'Reported in 5 min', detail: null, group: null, value: 2 },
      { id: 'r2', label: 'Reported in 1 hour', detail: null, group: null, value: 9 },
      { id: 'r3', label: 'Reported next day', detail: null, group: null, value: 24 },
    ],
    links: [],
    groups: [],
    columns: [],
    rows: [],
    axes: { x: 'When the first report arrived', y: 'Colleagues who opened the email (illustrative)' },
    chartType: 'bar',
  },
  sourceIds: ['NCSC-PHISH'],
  textEquivalent: {
    short: 'Illustrative bar chart: later reports mean more colleagues exposed',
    long: 'An illustrative bar chart, not real data: if the first report arrives within 5 minutes, about 2 colleagues have opened the email; within 1 hour, about 9; if reported the next day, about 24. Earlier reporting limits exposure.',
  },
  interaction: 'none',
  rendererOverride: null,
  mermaid: null,
};

const M1: StoryboardModulePart = {
  module: {
    id: 'M1',
    title: 'Recognising phishing',
    summary: 'What phishing is, the warning signs agencies highlight, and why a clean-looking email still deserves care.',
    loIds: ['LO1', 'LO2'],
    role: 'intro',
    blocks: [
      block(
        'M1-B01',
        'topic-title',
        'Recognising phishing',
        'Phishing emails are designed to look ordinary. In this module you will learn the signs that should make you pause — and why they are prompts to check rather than proof.',
        ['LO1', 'LO2'],
        [],
      ),
      block(
        'M1-B02',
        'concept',
        'What phishing is',
        'A **phishing** email imitates someone you trust — a colleague, a supplier, a bank or an internal IT team — to get you to click a link, open an attachment or hand over information.\n\nThe goal is almost always one of three things: your password, a payment, or a foothold on your device.',
        ['LO1'],
        [cite('CISA-PHISH'), cite('FTC-PHISH')],
        { claimIds: ['CLM-0001'] },
      ),
      block(
        'M1-B03',
        'comparison',
        'Five signs worth checking',
        'National cyber-security agencies point to the same small set of warning signs:\n\n- an **unexpected request** for credentials, payment or personal data\n- **urgency or threats**, such as deadlines or account closure\n- a **sender** whose display name and real address do not match\n- a **link** whose text and real destination differ\n- a **generic greeting** or tone that feels unlike the sender',
        ['LO1'],
        [cite('CISA-PHISH'), cite('NCSC-PHISH'), cite('FTC-PHISH')],
        { visualId: 'V-01', claimIds: ['CLM-0002', 'CLM-0003'], treatment: 'Comparison table of signs with a text equivalent.' },
      ),
      block(
        'M1-B04',
        'misconception',
        'A clean-looking email is not a safe email',
        'Well-crafted phishing can show few or none of these signs. Treat the signs as reasons to **verify**, not as a checklist that clears a message when nothing is ticked.',
        ['LO2'],
        [cite('NCSC-PHISH')],
        { claimIds: ['CLM-0004'] },
      ),
      block('M1-F01', 'formative', 'Spot the signs', 'Practice question.', ['LO1'], [cite('CISA-PHISH')], {
        interaction: q(
          'multiple',
          'An email from “IT Service Desk” says your password expires in 30 minutes and asks you to sign in through the link. The sender address is it-desk@secure-helpdesk.net. Which signs are present? Select all that apply.',
          {
            options: [
              { key: 'A', text: 'Urgency' },
              { key: 'B', text: 'Unexpected request for credentials' },
              { key: 'C', text: 'Sender address that does not match the organisation' },
              { key: 'D', text: 'An attachment' },
            ],
            correctKeys: ['A', 'B', 'C'],
            feedbackCorrect: 'Right: the deadline, the sign-in request and the outside domain are all warning signs.',
            feedbackIncorrect:
              'Look again: there is no attachment, but the deadline, the sign-in request and the outside domain are all signs.',
            optionFeedback: [{ key: 'D', text: 'The message contains a link, not an attachment.' }],
            rationale: 'Three of the five agency-highlighted signs are present.',
          },
        ),
      }),
      block('M1-F02', 'formative', 'Signal or not?', 'Practice question.', ['LO2'], [cite('NCSC-PHISH')], {
        interaction: q('categorization', 'Sort each observation.', {
          options: [
            { key: 'o1', text: 'The email asks you to confirm payroll bank details urgently' },
            { key: 'o2', text: 'The email uses your manager’s usual sign-off' },
            { key: 'o3', text: 'The link text shows the intranet but points elsewhere' },
          ],
          targets: [
            { key: 'warn', text: 'Warning sign' },
            { key: 'notproof', text: 'Not proof of safety' },
          ],
          mapping: [
            { key: 'o1', target: 'warn' },
            { key: 'o2', target: 'notproof' },
            { key: 'o3', target: 'warn' },
          ],
          feedbackCorrect: 'Correct. A familiar sign-off is easy to copy, so it does not prove the email is genuine.',
          feedbackIncorrect: 'Remember: familiar details can be copied; they are not proof that a message is safe.',
          rationale: 'Attackers imitate familiar details; only independent verification settles doubt.',
        }),
      }),
    ],
  },
  visuals: [V_SIGNS],
  glossary: [
    {
      id: 'GL-001',
      term: 'Phishing',
      definition: 'A message that imitates a trusted sender to trick the recipient into an unsafe action.',
      sourceIds: ['CISA-PHISH'],
    },
    {
      id: 'GL-002',
      term: 'Spoofing',
      definition: 'Disguising a message’s sender or link so it appears to come from someone else.',
      sourceIds: ['NCSC-PHISH'],
    },
  ],
  acronyms: [{ id: 'AC-001', acronym: 'IT', expansion: 'Information technology', firstUseBlockId: 'M1-B02' }],
};

const M2: StoryboardModulePart = {
  module: {
    id: 'M2',
    title: 'Checking and reporting',
    summary: 'How to verify a suspicious request safely and report it so colleagues are protected.',
    loIds: ['LO3', 'LO4'],
    role: 'topic',
    blocks: [
      block(
        'M2-B01',
        'topic-title',
        'Checking and reporting',
        'Noticing a warning sign is only half the job. Here you will practise checking a request safely and reporting it the right way.',
        ['LO3', 'LO4'],
        [],
      ),
      block(
        'M2-B02',
        'content',
        'Verify through a separate channel',
        'If a message asks for something unusual, check it **outside the message**: call the sender on a number you already know, or type the organisation’s address into your browser yourself.\n\nDo not use the phone number, link or reply address in the suspicious email — they may lead straight back to the attacker.',
        ['LO3'],
        [cite('FTC-PHISH'), cite('CISA-PHISH')],
        { claimIds: ['CLM-0005'] },
      ),
      block(
        'M2-B03',
        'process',
        'From suspicion to report',
        'Follow the same short sequence every time a message makes you pause.',
        ['LO4'],
        [cite('NCSC-PHISH'), cite('CISA-PHISH')],
        { visualId: 'V-02', claimIds: ['CLM-0006'], treatment: 'Process diagram with text equivalent.' },
      ),
      block(
        'M2-B04',
        'evidence',
        'Why reporting quickly matters',
        'Early reports let the security team warn colleagues and block the campaign before more people interact with it. If you have **already clicked** or entered details, report straight away — speed matters more than embarrassment.',
        ['LO4'],
        [cite('NCSC-PHISH'), cite('CISA-PHISH')],
        { visualId: 'V-03', claimIds: ['CLM-0006', 'CLM-0007'] },
      ),
      block('M2-F01', 'formative', 'Choose the safe check', 'Practice question.', ['LO3'], [cite('FTC-PHISH')], {
        interaction: q('single', 'A supplier emails new bank details for this month’s invoice. What is the safest way to check?', {
          options: [
            { key: 'A', text: 'Reply to the email and ask them to confirm' },
            { key: 'B', text: 'Call the supplier on the number already held in your records' },
            { key: 'C', text: 'Call the number in the email signature' },
          ],
          correctKeys: ['B'],
          feedbackCorrect: 'Yes — a contact route you already trust cannot be controlled by the sender of the suspicious email.',
          feedbackIncorrect: 'Contact details inside a suspicious email may belong to the attacker. Use a route you already hold.',
          optionFeedback: [
            { key: 'A', text: 'A reply goes back to whoever sent the message.' },
            { key: 'C', text: 'The signature is part of the suspicious message.' },
          ],
          rationale: 'Independent verification uses a channel the attacker does not control.',
        }),
      }),
      block('M2-F02', 'formative', 'Order the steps', 'Practice question.', ['LO4'], [cite('NCSC-PHISH')], {
        interaction: q('sequencing', 'Put the response steps in order.', {
          options: [
            { key: 'report', text: 'Report it' },
            { key: 'pause', text: 'Pause — do not click or reply' },
            { key: 'verify', text: 'Verify through a known channel' },
          ],
          order: ['pause', 'verify', 'report'],
          feedbackCorrect: 'Correct: pause, verify, then report.',
          feedbackIncorrect: 'Start by pausing, verify separately, then report.',
          rationale: 'Pausing prevents harm; verifying and reporting protect you and colleagues.',
        }),
      }),
    ],
  },
  visuals: [V_REPORT, V_REPORTS],
  glossary: [],
  acronyms: [],
};

const GA: StoryboardModulePart = {
  module: {
    id: 'GA',
    title: 'Final check',
    summary: 'Four questions covering all four objectives.',
    loIds: ['LO1', 'LO2', 'LO3', 'LO4'],
    role: 'graded',
    blocks: [
      block('GA-01', 'graded', 'Question 1', 'Assessment item.', ['LO1'], [cite('CISA-PHISH')], {
        difficulty: 'foundational',
        interaction: q('single', 'Which of these is the strongest warning sign in an email from “HR”?', {
          options: [
            { key: 'A', text: 'It uses the company logo' },
            { key: 'B', text: 'It asks you to sign in via a link to view an urgent salary change' },
            { key: 'C', text: 'It arrives during working hours' },
          ],
          correctKeys: ['B'],
          feedbackCorrect: 'Correct: an urgent sign-in request via a link combines two warning signs.',
          feedbackIncorrect: 'Logos and timing are easy to fake or ordinary; the urgent sign-in request is the warning sign.',
          rationale: 'Urgency plus a credential request are agency-highlighted signs.',
        }),
      }),
      block('GA-02', 'graded', 'Question 2', 'Assessment item.', ['LO2'], [cite('NCSC-PHISH')], {
        difficulty: 'applied',
        interaction: q(
          'single',
          'An email shows none of the five warning signs but asks you to approve a large, unusual payment. What should you conclude?',
          {
            options: [
              { key: 'A', text: 'It is safe because no signs are present' },
              { key: 'B', text: 'It still needs verifying, because the absence of signs is not proof of safety' },
              { key: 'C', text: 'Forward it to colleagues to see what they think' },
            ],
            correctKeys: ['B'],
            feedbackCorrect: 'Correct: the signs prompt checks; their absence does not clear a message.',
            feedbackIncorrect: 'Well-made phishing can show no signs. An unusual request still needs independent verification.',
            rationale: 'Absence of warning signs does not prove safety.',
          },
        ),
      }),
      block('GA-03', 'graded', 'Question 3', 'Assessment item.', ['LO3'], [cite('FTC-PHISH')], {
        difficulty: 'applied',
        interaction: q('single', 'Your “bank” texts and emails asking you to confirm a payment. How do you check?', {
          options: [
            { key: 'A', text: 'Use the link in the email' },
            { key: 'B', text: 'Call the number on the back of your card' },
            { key: 'C', text: 'Reply “STOP” to the message' },
          ],
          correctKeys: ['B'],
          feedbackCorrect: 'Correct: a number you already hold is an independent channel.',
          feedbackIncorrect: 'Links and replies go back to the sender. Use a number you already hold.',
          rationale: 'Verify through a channel the sender cannot control.',
        }),
      }),
      block('GA-04', 'graded', 'Question 4', 'Assessment item.', ['LO4'], [cite('NCSC-PHISH')], {
        difficulty: 'integrative',
        interaction: q('sequencing', 'You realise you entered your password on a suspicious page. Order your next steps.', {
          options: [
            { key: 'change', text: 'Change the password through the real site' },
            { key: 'report', text: 'Report the incident immediately' },
            { key: 'stop', text: 'Stop using the suspicious page' },
          ],
          order: ['stop', 'report', 'change'],
          feedbackCorrect: 'Correct: stop, report straight away, then change your password as instructed.',
          feedbackIncorrect: 'Stop first, report immediately so the team can act, then change your password.',
          rationale: 'Immediate reporting lets the security team contain the incident.',
        }),
      }),
    ],
  },
  visuals: [],
  glossary: [],
  acronyms: [],
};

/* --------------------------------------------------------- editorial + visual */

const editorial: Record<string, EditorialResult> = {
  M1: {
    edits: [
      {
        blockId: 'M1-B01',
        field: 'body',
        key: null,
        text: 'Phishing emails are built to look ordinary. This module shows you the signs that should make you pause — and why they are prompts to check rather than proof.',
        reason: 'Tighter, more direct opening.',
      },
    ],
    notes: 'Light edit; no facts, keys or citations changed.',
  },
  M2: { edits: [], notes: 'No changes needed.' },
  GA: { edits: [], notes: 'Assessment wording left unchanged.' },
};

const visualDirection: VisualDirectionAgent = {
  direction: {
    family: 'corporate-professional',
    accentHue: 210,
    density: 'comfortable',
    corner: 'soft',
    typeScale: 'default',
    figureStyle: 'line',
  },
  rationale: 'A calm, credible corporate look suits workplace security awareness; blue accent reads as trustworthy without alarm.',
  briefMarkdown:
    '# Design brief — Spotting Phishing Emails\n\nAudience: office staff. Tone: calm, practical, non-alarmist.\n\n- Corporate/professional family with a blue accent.\n- Comfortable density: short screens, generous spacing.\n- Diagrams use line style for clarity; warning signs are shown as a table so they read well on mobile.',
  visualClassifications: [
    {
      visualId: 'V-01',
      archetype: 'COMPARISON',
      rendererOverride: null,
      rationale: 'Sign-by-sign comparison reads best as a structured table.',
    },
    { visualId: 'V-02', archetype: 'PROCESS', rendererOverride: null, rationale: 'Linear five-step response.' },
    {
      visualId: 'V-03',
      archetype: 'QUANTITATIVE_CHART',
      rendererOverride: null,
      rationale: 'Simple bar comparison of illustrative values.',
    },
  ],
};

/* ------------------------------------------------------------ review + repair */

const assessmentFinding: FindingSet = {
  summary: 'Items are well aligned. One formative item could better teach its distractor.',
  findings: [
    {
      severity: 'major',
      category: 'assessment',
      location: 'M1-F01',
      problem: 'The feedback does not explain why a link is not the same as an attachment, which is a common learner confusion.',
      evidence: ['LO1', 'M1-F01'],
      recommendedAction: 'Extend the incorrect-answer feedback to explain the link/attachment distinction.',
      confidence: 'high',
    },
  ],
};

const repairedM1F01: Block = (() => {
  const b = structuredClone(M1.module.blocks.find((x) => x.id === 'M1-F01') as Block);
  if (b.interaction)
    b.interaction.feedbackIncorrect =
      'Look again: the deadline, the sign-in request and the outside domain are all warning signs. There is no attachment here — the message uses a link, which can be just as dangerous because it can lead to a fake sign-in page.';
  return b;
})();

const repair: RepairResult = {
  replacements: [{ targetId: 'M1-F01', objectJson: JSON.stringify(repairedM1F01), actionIds: ['A0-01'] }],
  notes: 'Extended incorrect feedback on M1-F01 only.',
};

const cleanReview: FindingSet = { summary: 'No significant issues found.', findings: [] };

/* ------------------------------------------------------------------- write */

function files(): Map<string, unknown> {
  const m = new Map<string, unknown>();
  const put = (template: string, name: string, output: unknown) => m.set(`${template}/${name}.json`, { output });
  put('concept', 'default', ConceptBriefSchema.parse(concept));
  put('research-brief', 'default', ResearchBriefSchema.parse(brief));
  for (const [id, sec] of Object.entries(dossierSections)) put('dossier-section', id, DossierSectionAgentSchema.parse(sec));
  put('instructional-design', 'default', InstructionalDesignSchema.parse(design));
  for (const part of [M1, M2, GA]) put('storyboard-module', part.module.id, StoryboardModulePartSchema.parse(part));
  for (const [id, e] of Object.entries(editorial)) put('editorial', id, EditorialResultSchema.parse(e));
  put('visual-direction', 'default', VisualDirectionAgentSchema.parse(visualDirection));
  put('review', 'default', FindingSetSchema.parse(cleanReview));
  put('review', 'assessment.c0', FindingSetSchema.parse(assessmentFinding));
  put('adjudicate', 'default', { decisions: [], conflicts: [] });
  put('repair', 'default', RepairResultSchema.parse(repair));
  put('repair-html', 'default', { edits: [], notes: 'No HTML edits.' });
  put('visual-repair', 'default', V_SIGNS);
  return m;
}

function main(): void {
  const check = process.argv.includes('--check');
  const out = files();
  if (check) {
    const drift = [...out].filter(
      ([rel, v]) =>
        !existsSync(join(OUT, rel)) || readFileSync(join(OUT, rel), 'utf8').replace(/\r\n/g, '\n') !== `${JSON.stringify(v, null, 2)}\n`,
    );
    if (drift.length) {
      console.error(`demo fixtures out of date: ${drift.map(([r]) => r).join(', ')}`);
      process.exit(1);
    }
    console.log(`demo fixtures up to date (${out.size})`);
    return;
  }
  rmSync(OUT, { recursive: true, force: true });
  for (const [rel, v] of out) {
    mkdirSync(dirname(join(OUT, rel)), { recursive: true });
    writeFileSync(join(OUT, rel), `${JSON.stringify(v, null, 2)}\n`);
  }
  console.log(`wrote ${out.size} fixtures to ${OUT}`);
}

main();

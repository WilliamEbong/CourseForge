/**
 * The setup wizard: a short sequence of plain-language questions, every one with an Enter-to-accept default.
 * All wording comes from `config/guidance.json`; this module only decides which question comes next.
 * Pure over the injected `ask`/`write`, so tests script the answers.
 */
import type { GuidanceConfig, GuidanceQuestion, LearnerIdentity, TrackingDestination } from '../core/schemas/index.js';
import { TrackingSchema } from '../core/schemas/index.js';
import type { ReviewChoice, SetupAnswers } from '../pipeline/api.js';
import { fillMessage } from '../pipeline/setup.js';

export interface WizardIo {
  /** Shows the prompt and resolves to the trimmed reply ('' when the user just pressed Enter). */
  ask(prompt: string): Promise<string>;
  write(text: string): void;
}

export interface WizardOptions {
  guidance: GuidanceConfig;
  courseId: string;
  title: string;
  current: SetupAnswers;
  /** True for `configure` on an existing course (different greeting; answers are "keep" defaults). */
  reconfigure: boolean;
  io: WizardIo;
  /** Sends one test result to a web destination; resolves to null on success, else a short reason. */
  testEndpoint?: (url: string) => Promise<string | null>;
}

const SHEET_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** A misbehaving input stream must never trap the user in a loop. */
const MAX_TRIES = 5;

export async function runWizard(o: WizardOptions): Promise<SetupAnswers> {
  const { guidance: g, io } = o;
  const m = g.messages;
  const heading = (q: GuidanceQuestion) => {
    io.write(`\n${q.prompt}\n`);
    if (q.help) io.write(`  ${q.help}\n`);
  };

  async function choose<T extends string>(q: GuidanceQuestion, current: T, only?: (v: string) => boolean): Promise<T> {
    const opts = q.options.filter((x) => !only || only(x.value));
    if (opts.length <= 1) return (opts[0]?.value as T | undefined) ?? current;
    heading(q);
    const def = Math.max(
      0,
      opts.findIndex((x) => x.value === current),
    );
    opts.forEach((x, i) => {
      io.write(`  ${i + 1}) ${x.label}${i === def ? '  <- suggested' : ''}\n`);
      if (x.blurb) io.write(`     ${x.blurb}\n`);
    });
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      const reply = await io.ask(`Your choice [${def + 1}]: `);
      if (reply === '') break;
      const n = Number(reply);
      if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1]!.value as T;
      io.write(`${fillMessage(m.invalidChoice, { max: opts.length })}\n`);
    }
    return opts[def]!.value as T;
  }

  async function text(q: GuidanceQuestion, current: string, valid: (v: string) => boolean, invalid: string): Promise<string> {
    heading(q);
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      const reply = await io.ask(current ? `Your answer [${current}]: ` : 'Your answer: ');
      if (reply === '') return current;
      if (valid(reply)) return reply;
      io.write(`${invalid}\n`);
    }
    return current;
  }

  io.write(`${fillMessage(o.reconfigure ? m.reconfigure : m.welcome, { title: o.title })}\n`);
  const cur = o.current;

  const language = await text(g.questions.language, cur.language, (v) => LANGUAGE.test(v), m.invalidText);
  const audience = (await text(g.questions.audience, cur.audience ?? '', (v) => v.length <= 200, m.invalidText)) || null;
  const review = await choose<ReviewChoice>(g.questions.review, cur.review, (v) => v !== 'custom' || cur.review === 'custom');
  const destination = await choose<TrackingDestination>(g.questions.tracking, cur.tracking.destination);

  let tracking = { destination, endpoint: null as string | null, identity: cur.tracking.identity, id_label: cur.tracking.id_label };
  if (destination === 'sheet' || destination === 'tracker') {
    tracking.identity = await choose<LearnerIdentity>(g.questions.identity, cur.tracking.identity);
    if (tracking.identity === 'name_and_id')
      tracking.id_label = (await text(g.questions.idLabel, cur.tracking.id_label ?? '', (v) => v.length <= 40, m.invalidText)) || null;
    const keep = cur.tracking.destination === destination ? (cur.tracking.endpoint ?? '') : '';
    const valid =
      destination === 'sheet'
        ? (v: string) => SHEET_URL.test(v)
        : (v: string) => TrackingSchema.shape.endpoint.safeParse(v).success && v !== '';
    const url = await text(destination === 'sheet' ? g.questions.sheetUrl : g.questions.trackerUrl, keep, valid, m.invalidUrl);
    tracking.endpoint = url || null;
    if (tracking.endpoint && tracking.endpoint !== cur.tracking.endpoint && o.testEndpoint) {
      io.write(`${m.testSending}\n`);
      const problem = await o.testEndpoint(tracking.endpoint);
      io.write(`${problem ? fillMessage(m.testFailed, { detail: problem, id: o.courseId }) : m.testOk}\n`);
    }
  } else if (destination === 'none') {
    tracking = { destination, endpoint: null, identity: 'name', id_label: null };
  }
  return { language, audience, review, tracking };
}

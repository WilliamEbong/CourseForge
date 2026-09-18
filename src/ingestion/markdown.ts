/**
 * Deterministic Markdown twins of canonical JSON artifacts (JSON is canonical; these are rendered, never parsed back
 * except through ingest). Every section/block carries a `<!-- cf:id … -->` marker for section locks.
 */
import type {
  Citation,
  ClaimRecord,
  InstructionalDesign,
  Interaction,
  ResearchBrief,
  ResearchDossier,
  SourceRecord,
  Storyboard,
} from '../core/schemas/content.js';

const marker = (id: string) => `<!-- cf:id ${id} -->`;
const cites = (cs: Citation[]) => cs.map((c) => (c.locator ? `${c.sourceId} ${c.locator}` : c.sourceId)).join('; ');
const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');
/** Joins non-empty string parts (falsy guards like `xs.length && …` drop out). */
const join = (parts: unknown[]) =>
  `${parts
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .join('\n\n')
    .trim()}\n`;

function renderInteraction(i: Interaction): string {
  const out = [`**Interaction:** ${i.mode}`];
  if (i.options.length) out.push(`Options:\n${i.options.map((o) => `- ${o.key}. ${o.text}`).join('\n')}`);
  if (i.targets.length) out.push(`Targets:\n${i.targets.map((t) => `- ${t.key}. ${t.text}`).join('\n')}`);
  if (i.correctKeys.length) out.push(`Correct: ${i.correctKeys.join(', ')}`);
  if (i.mapping.length) out.push(`Mapping: ${i.mapping.map((m) => `${m.key} → ${m.target}`).join('; ')}`);
  if (i.order.length) out.push(`Order: ${i.order.join(' → ')}`);
  if (i.feedbackCorrect) out.push(`Feedback (correct): ${i.feedbackCorrect}`);
  if (i.feedbackIncorrect) out.push(`Feedback (incorrect): ${i.feedbackIncorrect}`);
  if (i.rationale && i.rationale !== i.feedbackCorrect) out.push(`Rationale: ${i.rationale}`);
  return out.join('\n\n');
}

export function renderStoryboardMarkdown(sb: Storyboard): string {
  const parts: string[] = [`# ${sb.title}`];
  if (sb.subtitle) parts.push(`_${sb.subtitle}_`);
  parts.push(
    `Course: ${sb.courseId} · Language: ${sb.language}${sb.estimatedMinutes ? ` · About ${sb.estimatedMinutes} minutes` : ''} · Passing: ${sb.assessment.passingPercent}%`,
  );
  parts.push(`## Learning objectives\n\n${list(sb.objectives.map((o) => `**${o.id}** ${o.text}`))}`);
  for (const m of sb.modules) {
    parts.push(`${marker(m.id)}\n## ${m.id} — ${m.title}`);
    if (m.summary) parts.push(m.summary);
    for (const b of m.blocks) {
      const meta = [
        `Kind: ${b.kind}${b.subtype ? ` (${b.subtype})` : ''}`,
        b.loIds.length ? `Objectives: ${b.loIds.join(', ')}` : null,
        b.citations.length ? `Sources: ${cites(b.citations)}` : null,
        b.visualId ? `Visual: ${b.visualId}` : null,
        b.difficulty ? `Difficulty: ${b.difficulty}` : null,
        b.optional ? 'Optional' : null,
      ].filter(Boolean);
      parts.push(
        join([
          `${marker(b.id)}\n### ${b.id} · ${b.title}`,
          `_${meta.join(' · ')}_`,
          b.body,
          b.interaction && renderInteraction(b.interaction),
          b.treatment && `> Treatment: ${b.treatment.replace(/\n+/g, ' ')}`,
          b.accessibility && `> Accessibility: ${b.accessibility.replace(/\n+/g, ' ')}`,
        ]).trim(),
      );
    }
  }
  if (sb.visuals.length)
    parts.push(
      `## Visuals\n\n${sb.visuals
        .map(
          (v) =>
            `${marker(v.id)}\n### ${v.id} · ${v.title}\n\n_${v.archetype}_ — ${v.purpose}\n\nText equivalent: ${v.textEquivalent.long}`,
        )
        .join('\n\n')}`,
    );
  if (sb.glossary.length)
    parts.push(`## Glossary\n\n${list(sb.glossary.map((g) => `**${g.term}** — ${g.definition.replace(/\n+/g, ' ')}`))}`);
  if (sb.acronyms.length) parts.push(`## Acronyms\n\n${list(sb.acronyms.map((a) => `**${a.acronym}** — ${a.expansion}`))}`);
  if (sb.references.length) parts.push(`## References\n\n${list(sb.references.map(renderSource))}`);
  if (sb.notes.length) parts.push(`## Notes\n\n${list(sb.notes)}`);
  return join(parts);
}

const renderSource = (s: SourceRecord) =>
  `**${s.id}** — ${[s.author ?? s.publisher, s.title, s.date].filter(Boolean).join('. ')}${s.url ? ` <${s.url}>` : ''} _(${s.type})_`;

export function renderDesignMarkdown(d: InstructionalDesign): string {
  return join([
    `# ${d.title}`,
    `Audience: ${d.audience}`,
    `Duration: ${d.durationMinutes} minutes`,
    d.prerequisites.length && `## Prerequisites\n\n${list(d.prerequisites)}`,
    d.scopeBoundaries.length && `## Scope boundaries\n\n${list(d.scopeBoundaries)}`,
    `## Learning objectives\n\n${d.objectives
      .map(
        (o) =>
          `${marker(o.id)}\n### ${o.id}\n\n${o.statement}\n\n_Verb: ${o.verb} · Bloom: ${o.bloomLevel} · Sources: ${o.sourceIds.join('; ') || 'none'}_`,
      )
      .join('\n\n')}`,
    d.dispositions.length &&
      `## Content dispositions\n\n| Topic | Disposition | Reason | Sources |\n| --- | --- | --- | --- |\n${d.dispositions
        .map((x) => `| ${x.topic} | ${x.disposition} | ${x.reason} | ${x.sourceIds.join('; ')} |`)
        .join('\n')}`,
    `## Modules\n\n${d.modules
      .map((m) =>
        join([
          `${marker(m.id)}\n### ${m.id} — ${m.title}`,
          `${m.purpose}\n\n_${m.durationMinutes} min · LOs: ${m.loIds.join(', ') || 'none'} · Sources: ${m.sourceIds.join('; ') || 'none'}_`,
          m.contentSequence.length && `Content sequence:\n\n${list(m.contentSequence)}`,
          m.misconceptions.length && `Misconceptions:\n\n${list(m.misconceptions)}`,
          m.examples.length && `Examples:\n\n${list(m.examples)}`,
          m.formativePractice.length && `Formative practice:\n\n${list(m.formativePractice)}`,
        ]).trim(),
      )
      .join('\n\n')}`,
    d.alignment.length &&
      `## Alignment\n\n| LO | Modules | Formative | Graded | Level |\n| --- | --- | --- | --- | --- |\n${d.alignment
        .map((a) => `| ${a.loId} | ${a.moduleIds.join(', ')} | ${a.formativeMethod} | ${a.gradedMethod} | ${a.cognitiveLevel} |`)
        .join('\n')}`,
    `## Assessment strategy\n\n${d.assessmentStrategy.gradedItemCount} graded items · passing ${d.assessmentStrategy.passingPercent}% · ${d.assessmentStrategy.formativePerModule} formative per module\n\n${d.assessmentStrategy.notes}`,
    `## Scenario strategy\n\n${d.scenarioStrategy}`,
    d.glossaryPlan.length && `## Glossary plan\n\n${list(d.glossaryPlan.map((g) => `**${g.term}** — ${g.definition}`))}`,
    d.evidenceGaps.length &&
      `## Evidence gaps\n\n${list(d.evidenceGaps.map((g) => `${g.description} — impact: ${g.impact}; action: ${g.action}`))}`,
  ]);
}

export function renderBriefMarkdown(b: ResearchBrief): string {
  return join([
    `# Research brief: ${b.title}`,
    `## Purpose\n\n${b.purpose}`,
    `## Audience\n\n${b.audience}`,
    `## Scope\n\n${list(b.scope)}`,
    `## Exclusions\n\n${list(b.exclusions)}`,
    `## Research questions\n\n${b.researchQuestions.map((q) => `${marker(q.id)}\n- **${q.id}** (${q.priority}) ${q.question}`).join('\n')}`,
    `## Source hierarchy\n\n${b.sourceHierarchy.map((s) => `${s.rank}. ${s.sourceType} — ${s.rationale}`).join('\n')}`,
    b.jurisdictions.length && `## Jurisdictions\n\n${list(b.jurisdictions)}`,
    `## Safety boundaries\n\n${list(b.safetyBoundaries)}`,
    `## Dossier plan\n\n${b.dossierPlan
      .map((s) => `${marker(s.sectionId)}\n- **${s.sectionId}** ${s.title}${s.questionIds.length ? ` (${s.questionIds.join(', ')})` : ''}`)
      .join('\n')}`,
    `## Evidence requirements\n\n${list(b.evidenceRequirements)}`,
    `## Currentness requirements\n\n${list(b.currentnessRequirements)}`,
  ]);
}

export function renderDossierMarkdown(d: ResearchDossier, sources: SourceRecord[] = [], claims: ClaimRecord[] = []): string {
  return join([
    `# ${d.title}`,
    `_Version ${d.version}_`,
    ...d.sections.map((s) => `${marker(s.sectionId)}\n## ${s.sectionId} — ${s.title}\n\n${s.markdown.trim()}`),
    claims.length &&
      `## Claim register\n\n| Claim ID | Claim | Category | Sources |\n| --- | --- | --- | --- |\n${claims
        .map((c) => `| ${c.id} | ${c.text.replace(/\|/g, '\\|')} | ${c.category} | ${cites(c.citations)} |`)
        .join('\n')}`,
    sources.length && `## Source register\n\n${list(sources.map(renderSource))}`,
  ]);
}

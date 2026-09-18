import { describe, expect, it } from 'vitest';
import type { ClaimRecord, SourceRecord } from '../../../src/core/schemas/content.js';
import { ReleaseManifestSchema } from '../../../src/core/schemas/reports.js';
import { releaseGate } from '../../../src/release/gate.js';
import { buildReleaseManifest, qaReportMarkdown, sourceReportMarkdown } from '../../../src/release/reports.js';
import { accessibility, finding, functional, passingInput } from './helpers.js';

const source = (id: string, over: Partial<SourceRecord> = {}): SourceRecord => ({
  id,
  title: `Title ${id}`,
  author: null,
  publisher: 'Alberta King’s Printer',
  type: 'legislation',
  url: `https://example.org/${id}`,
  doi: null,
  date: '2024-01-01',
  version: null,
  accessed: '2026-09-01',
  jurisdiction: 'AB',
  authority: 'primary',
  currentnessNotes: null,
  licenseNotes: null,
  ...over,
});

const claim = (id: string, sourceIds: string[]): ClaimRecord => ({
  id,
  text: `Claim ${id}`,
  category: 'law-regulation',
  citations: sourceIds.map((sourceId) => ({ sourceId, locator: null })),
  sectionId: null,
  jurisdiction: 'AB',
  confidence: 'high',
  qualifications: null,
});

describe('qaReportMarkdown', () => {
  const input = () => {
    const findings = [finding({ findingId: 'QA-C0-002', severity: 'major' }), finding({ findingId: 'QA-C0-001', status: 'fixed' })];
    return {
      model: null,
      functional: functional(false),
      accessibility: accessibility([
        { id: 'color-contrast', impact: 'serious' as const, nodes: ['#a', '#b'] },
        { id: 'region', impact: 'moderate' as const },
      ]),
      build: null,
      findings,
      decision: releaseGate({ ...passingInput(), functional: functional(false), findings }),
      screenshots: [
        { screenId: 'S-02', viewport: 390, path: 'review/screenshots/S-02-390.png' },
        { screenId: 'S-01', viewport: 1440, path: 'review/screenshots/S-01-1440.png' },
      ],
      courseTitle: 'Chemical Risk',
      releaseVersion: '1.0.0',
    };
  };

  it('is deterministic and contains the key sections', () => {
    const md = qaReportMarkdown(input());
    const shuffled = input();
    shuffled.screenshots.reverse();
    shuffled.findings.reverse();
    expect(qaReportMarkdown(shuffled)).toBe(md);
    for (const h of [
      '# QA report — Chemical Risk',
      '**Decision: BLOCK**',
      '## Functional results',
      '### Interactions',
      '### Scoring check',
      '## Accessibility',
      '### Top violations',
      '## Responsive screenshots',
      '## Open findings',
      '## Known limitations',
    ]) {
      expect(md).toContain(h);
    }
    expect(md).toContain('correct path pass rate 2/2 (100%) · incorrect path pass rate 0/1 (0%)');
    expect(md).toContain('| color-contrast | serious | 2 | 1 |');
    expect(md).toContain('QA-C0-002');
    expect(md).not.toContain('QA-C0-001');
    expect(md.indexOf('S-01-1440')).toBeLessThan(md.indexOf('S-02-390'));
    expect(md).toMatch(/not a formal accessibility audit/);
  });
});

describe('sourceReportMarkdown', () => {
  it('reverse-indexes citations and lists uncited, dangling, caveats', () => {
    const refs = [
      source('SRC-B', { currentnessNotes: 'Consolidated to 2024; not the official legal version.' }),
      source('SRC-A'),
      source('SRC-C'),
    ];
    const input = {
      references: refs,
      claims: [claim('CLM-0002', ['SRC-A']), claim('CLM-0001', ['SRC-A', 'SRC-B', 'SRC-Z'])],
      screens: [{ id: 'S-03', title: 'Duties', citations: [{ sourceId: 'SRC-B', locator: 's.21' }] }],
      traceSummary: {
        objectives: 4,
        screens: 12,
        assessedObjectives: 4,
        unassessedObjectives: [],
        danglingReferences: [],
        sourcesCited: 2,
      },
    };
    const md = sourceReportMarkdown(input);
    expect(sourceReportMarkdown({ ...input, references: [...refs].reverse(), claims: [...input.claims].reverse() })).toBe(md);
    expect(md).toContain('### SRC-A — Title SRC-A');
    expect(md).toContain('Cited by claims: CLM-0001, CLM-0002');
    expect(md).toContain('Cited on screens: S-03');
    expect(md).toMatch(/## Uncited sources\n\n- SRC-C/);
    expect(md).toContain('- SRC-Z (cited by CLM-0001)');
    expect(md).toContain('- SRC-B: Consolidated to 2024; not the official legal version.');
    expect(md.indexOf('### SRC-A')).toBeLessThan(md.indexOf('### SRC-B'));
  });
});

describe('buildReleaseManifest', () => {
  it('produces a schema-valid manifest and rejects bad input', () => {
    const decision = releaseGate(passingInput());
    const m = buildReleaseManifest({
      courseId: 'demo',
      title: 'Demo',
      releaseVersion: '1.0.0',
      releasedAt: '2026-09-18T00:00:00Z',
      file: { path: 'release/course.html', sha256: 'sha256:abc', bytes: 1234 },
      decision,
      backends: [{ name: 'fake', version: null }],
      toolVersions: { node: '24.0.0' },
      artifacts: [{ artifactId: 'ART-1', logicalKey: 'model', path: 'model/course.json', hash: 'sha256:1', label: 'v1' }],
      findings: { open: { blocker: 0, critical: 0, major: 0, minor: 1, style: 0 }, accepted: 0, waived: 0 },
      trace: { objectives: 4, screens: 12, assessedObjectives: 4, unassessedObjectives: [], danglingReferences: [], sourcesCited: 3 },
      riskTier: 'standard',
      riskOverride: null,
      humanApprovals: [{ stage: 'RELEASE', by: null, at: null }],
    });
    expect(ReleaseManifestSchema.parse(m)).toEqual(m);
    expect(m.schemaVersion).toBe(1);
    expect(decision.decision).toBe('pass');
    expect(() => buildReleaseManifest({ ...m, humanApprovals: [{ stage: 'NOPE' as 'RELEASE', by: null, at: null }] })).toThrow();
  });
});

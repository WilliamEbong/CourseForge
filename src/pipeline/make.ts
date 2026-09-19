/**
 * `make`: turn whatever the author has into a finished course. Works out what it was given: a prompt, documents
 * (files or folders, used as the author's source material), a half-finished course (one HTML or JSON file,
 * imported at the stage it belongs to), or an existing course ID. Then it runs the pipeline towards release.
 * Where it pauses depends on the course's review level (`one_shot` pauses once, before release).
 */
import { readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { registerArtifact } from '../artifacts/index.js';
import { usageError } from '../core/errors.js';
import { exists, walkFiles, writeAtomic } from '../core/fsx.js';
import { slugify } from '../core/ids.js';
import { COURSE_FILES } from '../core/paths.js';
import { parseDocument } from '../ingestion/index.js';
import type { MakeOptions, MakeResult, PipelineApi } from './api.js';
import { courseExists, requireCourse } from './store.js';

const DOCUMENT_EXT = new Set(['.md', '.markdown', '.txt', '.html', '.htm', '.json', '.docx', '.pdf']);
/** ponytail: fixed cap on source text handed to agents; chunk and index the documents if authors need more. */
const MAX_SOURCE_CHARS = 400_000;

export type MakeInput = { kind: 'course'; file: string } | { kind: 'documents'; files: string[] } | { kind: 'prompt' };

/** Decides what the paths are: one HTML/JSON file is a course to import; anything else is source documents. */
export function classifyInputs(paths: readonly string[]): MakeInput {
  const files: string[] = [];
  let anyDir = false;
  for (const raw of paths) {
    const p = resolve(raw);
    if (!exists(p)) throw usageError(`Not found: ${raw}`);
    if (statSync(p).isDirectory()) {
      anyDir = true;
      const found = walkFiles(p)
        .filter((rel) => !rel.split('/').some((part) => part.startsWith('.')) && DOCUMENT_EXT.has(extname(rel).toLowerCase()))
        .map((rel) => join(p, rel));
      if (!found.length) throw usageError(`No documents CourseForge can read in ${raw} (it reads ${[...DOCUMENT_EXT].join(' ')})`);
      files.push(...found);
    } else {
      if (!DOCUMENT_EXT.has(extname(p).toLowerCase())) throw usageError(`${raw}: CourseForge reads ${[...DOCUMENT_EXT].join(' ')} files`);
      files.push(p);
    }
  }
  if (!files.length) return { kind: 'prompt' };
  const single = paths.length === 1 && files.length === 1 && !anyDir ? files[0]! : null;
  if (single && ['.html', '.htm', '.json'].includes(extname(single).toLowerCase())) return { kind: 'course', file: single };
  return { kind: 'documents', files: [...new Set(files)] };
}

/** The author's documents as one Markdown file, one section per document, capped at MAX_SOURCE_CHARS. */
export async function sourceMaterial(files: readonly string[]): Promise<{ text: string; titles: string[]; truncated: boolean }> {
  const parts: string[] = [];
  const titles: string[] = [];
  let used = 0;
  let truncated = false;
  for (const file of files) {
    const doc = await parseDocument(readFileSync(file), basename(file));
    const title = doc.title?.trim() || basename(file);
    titles.push(title);
    let body = doc.text.trim();
    if (used + body.length > MAX_SOURCE_CHARS) {
      body = body.slice(0, Math.max(0, MAX_SOURCE_CHARS - used));
      truncated = true;
    }
    used += body.length;
    if (truncated)
      body += '\n\n[The rest of this document was left out: the documents are longer than CourseForge can pass to its writers in one go.]';
    parts.push(`## Document: ${title}\n\nFile: \`${basename(file)}\`\n\n${body}\n`);
    if (used >= MAX_SOURCE_CHARS) break;
  }
  return {
    text: `# Source material supplied by the author\n\n${parts.length} document(s). Treat them as the author's own material: authoritative for how their organisation works, not for law or science.\n\n${parts.join('\n')}`,
    titles,
    truncated,
  };
}

/** A title from the prompt's first line (or the first document), trimmed at a word boundary. */
export function titleFrom(prompt: string, fallback: string): string {
  const line =
    prompt
      .split(/\r?\n/)
      .find((l) => l.trim())
      ?.trim() ?? '';
  const text = (line || fallback).replace(/\s+/g, ' ').replace(/[.:;,!?]+$/, '');
  if (text.length <= 80) return text || 'Untitled course';
  return `${text.slice(0, 80).replace(/\s+\S*$/, '')}…`;
}

const resumeHint = (id: string) => `course "${id}" created; if this run is interrupted, resume with: courseforge continue --course ${id}`;

/** The id `make` gives a new course with this title: its slug, numbered when that course already exists. */
export function freeId(base: string): string {
  const root = slugify(base) || 'course';
  if (!courseExists(root)) return root;
  for (let i = 2; ; i++) {
    const id = `${root}-${i}`;
    if (!courseExists(id)) return id;
  }
}

export async function make(api: PipelineApi, o: MakeOptions, now: () => string, progress: (msg: string) => void): Promise<MakeResult> {
  const prompt = o.prompt?.trim() ?? '';
  const h = { backend: o.backend, harness: o.harness };
  if (o.courseId) {
    if (prompt || o.paths.length)
      throw usageError('make --course continues an existing course; to add a file to it, use `courseforge ingest <file> --course <id>`.');
    requireCourse(o.courseId);
    return {
      courseId: o.courseId,
      input: 'existing',
      created: false,
      outcome: await api.run({ courseId: o.courseId, to: 'RELEASE', ...h }),
      guides: [],
    };
  }
  const input = classifyInputs(o.paths);
  if (input.kind === 'prompt' && !prompt) throw usageError('make: say what the course is about, or give documents or a course file');

  if (input.kind === 'course') {
    const target = await api.ingestTarget({ file: input.file, courseId: o.id, title: o.title });
    if (!target.isNew)
      throw usageError(`Course "${target.courseId}" already exists. Continue it with: courseforge make --course ${target.courseId}`);
    const res = await api.ingest({ file: input.file, courseId: target.courseId, title: o.title, setup: o.setup, ...h });
    progress(resumeHint(res.courseId));
    return {
      courseId: res.courseId,
      input: 'course',
      created: true,
      outcome: await api.run({ courseId: res.courseId, to: 'RELEASE', ...h }),
      guides: res.guides,
    };
  }

  const material = input.kind === 'documents' ? await sourceMaterial(input.files) : null;
  const title = o.title ?? titleFrom(prompt, material?.titles[0] ?? '');
  const id = o.id ?? freeId(title);
  const request = [
    prompt || 'Make a course from the documents the author supplied.',
    ...(material
      ? [
          '',
          `The author supplied ${material.titles.length} document(s) in \`${COURSE_FILES.sourceMaterial}\`: ${material.titles.join('; ')}.`,
        ]
      : []),
  ].join('\n');
  const created = await api.newCourse({ title, id, setup: o.setup, request, ...h });
  const dir = created.courseDir;
  progress(resumeHint(id));
  if (material) {
    writeAtomic(join(dir, COURSE_FILES.sourceMaterial), material.text);
    registerArtifact(dir, {
      stage: 'CONCEPT',
      path: COURSE_FILES.sourceMaterial,
      logicalKey: 'source-material',
      producer: { kind: 'human' },
      event: 'imported',
      humanModified: true,
      now: now(),
    });
  }
  const outcome = await api.run({ courseId: id, from: 'CONCEPT', to: 'RELEASE', ...h });
  return {
    courseId: id,
    input: material ? 'documents' : 'prompt',
    created: true,
    outcome,
    guides: created.guides,
    truncated: material?.truncated ?? false,
  };
}

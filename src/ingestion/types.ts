import type { SourceFormat } from '../core/enums.js';

export interface DocHeading {
  level: number;
  text: string;
  line: number;
}

export interface DocTable {
  header: string[];
  rows: string[][];
  line: number;
}

export interface HtmlSummary {
  /** Course data embedded in the page (`const COURSE = {…}` or a JSON script), parsed; null when absent. */
  embeddedCourse: unknown | null;
  scriptCount: number;
  interactionHints: string[];
  dom: Record<string, number>;
}

/** Format-neutral view of an imported file; every adapter produces one. */
export interface NormalizedDocument {
  format: SourceFormat;
  name: string;
  title: string;
  /** Plain text (Markdown source for md/txt/pdf; body text for html/docx; raw JSON text for json). */
  text: string;
  headings: DocHeading[];
  tables: DocTable[];
  /** First occurrence of each storyboard/LO/source-like token. */
  ids: { id: string; line: number }[];
  links: string[];
  json: unknown | null;
  html: HtmlSummary | null;
  /** Raw HTML source (html/docx only) so model reconstruction can re-parse the DOM. */
  rawHtml: string | null;
  warnings: string[];
  lossy: boolean;
}

export interface IngestAdapter {
  formats: SourceFormat[];
  parse(bytes: Buffer, name: string): Promise<NormalizedDocument>;
}

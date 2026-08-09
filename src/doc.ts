/**
 * Structured paper model. All renderers walk this tree, so content is
 * identical across formats.
 */
import type { Expr } from "./math.js";
import type { Seed } from "./rng.js";

export type Run =
  | { k: "text"; s: string }
  | { k: "emph"; s: string }
  | { k: "math"; e: Expr }
  | { k: "cite"; ids: number[] }
  | { k: "eqref"; no: string }
  | { k: "resref"; kind: ResultKind; number: string };

export type Runs = Run[];

export type ResultKind =
  | "Theorem"
  | "Lemma"
  | "Proposition"
  | "Corollary"
  | "Definition"
  | "Conjecture"
  | "Axiom"
  | "Postulate"
  | "Remark"
  | "Example";

export type Block =
  | { k: "para"; runs: Runs }
  | { k: "display"; e: Expr; no?: string }
  | { k: "result"; kind: ResultKind; number: string; name?: string; statement: Runs; proof?: Block[] }
  | { k: "proofOf"; kind: ResultKind; number: string; body: Block[] };

export interface Author {
  name: string;
  affiliation: string;
  email: string;
}

export type RefType = "journal" | "book" | "thesis" | "preprint";

export interface RefEntry {
  type: RefType;
  authors: string;
  /** First author's surname, for alphabetization. */
  sortKey: string;
  title: string;
  year: number;
  venue?: string;
  vol?: number;
  issue?: number;
  pages?: [number, number];
  publisher?: string;
  city?: string;
  school?: string;
  arxiv?: string;
}

export interface Section {
  title: string;
  blocks: Block[];
}

export interface Paper {
  seed: Seed;
  title: string;
  authors: Author[];
  date: string;
  abstract: Runs;
  keywords: string[];
  msc: string[];
  sections: Section[];
  acknowledgments: Runs;
  references: RefEntry[];
}

/* Run constructors */
export const t = (s: string): Run => ({ k: "text", s });
export const emph = (s: string): Run => ({ k: "emph", s });
export const m = (e: Expr): Run => ({ k: "math", e });
export const citeRun = (ids: number[]): Run => ({ k: "cite", ids });
export const eqref = (no: string): Run => ({ k: "eqref", no });
export const resref = (kind: ResultKind, number: string): Run => ({ k: "resref", kind, number });

/** Tagged template for building Runs:
 *  T`Let ${m(x)} be ${an(buzz)} ${obj} such that ${m(rel)}.` */
export function T(strings: TemplateStringsArray, ...vals: (Run | Runs | string)[]): Runs {
  const out: Runs = [];
  strings.forEach((s, i) => {
    if (s) out.push(t(s));
    if (i < vals.length) {
      const v = vals[i];
      if (typeof v === "string") out.push(t(v));
      else if (Array.isArray(v)) out.push(...v);
      else out.push(v);
    }
  });
  return mergeText(out);
}

/** Merge adjacent text runs so renderers see clean strings. */
export function mergeText(runs: Runs): Runs {
  const out: Runs = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (r.k === "text" && prev?.k === "text") prev.s += r.s;
    else out.push(r.k === "text" ? { ...r } : r);
  }
  return out;
}

/** Join sentence Runs with single spaces. */
export function joinSentences(sentences: Runs[]): Runs {
  const out: Runs = [];
  sentences.forEach((s, i) => {
    if (i > 0) out.push(t(" "));
    out.push(...s);
  });
  return mergeText(out);
}

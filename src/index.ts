/**
 * theorem-ipsum: seeded generator of nonsense mathematics papers.
 *
 *   import { theoremIpsum } from "./dist/index.js";
 *   console.log(theoremIpsum({ seed: 42, format: "latex" }));
 */
import type { Block, Paper } from "./doc.js";
import type { Seed } from "./rng.js";
import { displayExpr, toLatex, toText } from "./math.js";
import {
  type PaperOptions, ctxParagraph, fragmentResult, generatePaper, makeCtx,
  makeTitle, randomSeed,
} from "./paper.js";
import { abstractRuns } from "./grammar.js";
import { latexFragments, renderLatex } from "./render/latex.js";
import { markdownFragments, renderMarkdown } from "./render/markdown.js";
import { escapeHtml, htmlFragments, renderHtml } from "./render/html.js";
import { renderText, textFragments } from "./render/text.js";

export type Format = "latex" | "markdown" | "html" | "text";

export type { Block, Paper, PaperOptions, Seed };
export type { Author, RefEntry, Run, Runs, Section, ResultKind } from "./doc.js";
export type { Expr } from "./math.js";

export { generatePaper, randomSeed };
export { renderLatex, renderMarkdown, renderHtml, renderText };
export { Rng } from "./rng.js";

/** Render a generated Paper to the given format. */
export function render(paper: Paper, format: Format = "latex"): string {
  switch (format) {
    case "latex": return renderLatex(paper);
    case "markdown": return renderMarkdown(paper);
    case "html": return renderHtml(paper);
    case "text": return renderText(paper);
  }
}

/** Generate a paper and render it in one call. */
export function theoremIpsum(opts: PaperOptions & { format?: Format } = {}): string {
  const { format = "latex", ...rest } = opts;
  return render(generatePaper(rest), format);
}

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

export interface FragmentOptions {
  seed?: Seed;
  format?: Format;
}

function renderBlocks(blocks: Block[], format: Format): string {
  switch (format) {
    case "latex": return latexFragments.blocks(blocks);
    case "markdown": return markdownFragments.blocks(blocks);
    case "html": return htmlFragments.blocks(blocks);
    case "text": return textFragments.blocks(blocks);
  }
}

/** A single display equation. */
export function equation(opts: FragmentOptions = {}): string {
  const c = makeCtx(opts.seed ?? randomSeed());
  const e = displayExpr(c.math);
  switch (opts.format ?? "latex") {
    case "latex": return `\\[\n  ${toLatex(e)}\n\\]`;
    case "markdown": return `$$\n${toLatex(e)}\n$$`;
    case "html": return `<div class="math display">${escapeHtml(toLatex(e))}</div>`;
    case "text": return toText(e);
  }
}

/** A theorem with proof. */
export function theorem(opts: FragmentOptions = {}): string {
  const c = makeCtx(opts.seed ?? randomSeed());
  return renderBlocks([fragmentResult(c, "Theorem")], opts.format ?? "latex");
}

/** A definition. */
export function definition(opts: FragmentOptions = {}): string {
  const c = makeCtx(opts.seed ?? randomSeed());
  return renderBlocks([fragmentResult(c, "Definition")], opts.format ?? "latex");
}

/** An abstract. */
export function abstract(opts: FragmentOptions = {}): string {
  const c = makeCtx(opts.seed ?? randomSeed());
  const runs = abstractRuns(c);
  switch (opts.format ?? "text") {
    case "latex": return latexFragments.runs(runs);
    case "markdown": return markdownFragments.runs(runs);
    case "html": return `<p>${htmlFragments.runs(runs)}</p>`;
    case "text": return textFragments.wrap(textFragments.runsToString(runs));
  }
}

/** n paragraphs of prose with occasional display equations. */
export function paragraphs(n = 3, opts: FragmentOptions = {}): string {
  const c = makeCtx(opts.seed ?? randomSeed());
  const blocks: Block[] = [];
  for (let i = 0; i < n; i++) blocks.push(...ctxParagraph(c));
  return renderBlocks(blocks, opts.format ?? "text");
}

/** A paper title. */
export function title(opts: { seed?: Seed } = {}): string {
  const c = makeCtx(opts.seed ?? randomSeed());
  return makeTitle(c);
}

export const VERSION = "0.1.0";

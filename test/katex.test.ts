/**
 * Every piece of math the generator can emit must be valid KaTeX; this keeps
 * the web demo and the LaTeX output free of parse errors. The sweep covers
 * many seeds so every AST node kind is exercised.
 */
import { describe, expect, test } from "vitest";
import katex from "katex";
import { generatePaper } from "../src/index.js";
import type { Block, Paper, Runs } from "../src/doc.js";
import { toLatex, type Expr } from "../src/math.js";

function collectExprs(paper: Paper): Expr[] {
  const out: Expr[] = [];
  const fromRuns = (runs: Runs) => {
    for (const r of runs) if (r.k === "math") out.push(r.e);
  };
  const fromBlocks = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.k === "para") fromRuns(b.runs);
      if (b.k === "display") out.push(b.e);
      if (b.k === "result") {
        fromRuns(b.statement);
        if (b.proof) fromBlocks(b.proof);
      }
      if (b.k === "proofOf") fromBlocks(b.body);
    }
  };
  fromRuns(paper.abstract);
  fromRuns(paper.acknowledgments);
  for (const s of paper.sections) fromBlocks(s.blocks);
  return out;
}

describe("KaTeX validity", () => {
  test("all generated math parses under KaTeX", () => {
    let checked = 0;
    for (let seed = 0; seed < 25; seed++) {
      const paper = generatePaper({ seed });
      for (const e of collectExprs(paper)) {
        const tex = toLatex(e);
        expect(
          () => katex.renderToString(tex, { throwOnError: true, displayMode: true }),
          `seed ${seed}: ${tex}`,
        ).not.toThrow();
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1500);
  });

  test("numbered displays render with \\tag", () => {
    const paper = generatePaper({ seed: "tagged" });
    let tagged = 0;
    for (const s of paper.sections) {
      for (const b of s.blocks) {
        if (b.k === "display" && b.no) {
          const tex = `${toLatex(b.e)}. \\tag{${b.no}}`;
          expect(() => katex.renderToString(tex, { throwOnError: true, displayMode: true })).not.toThrow();
          tagged++;
        }
      }
    }
    expect(tagged).toBeGreaterThan(0);
  });
});

import { describe, expect, test } from "vitest";
import {
  generatePaper, render, theoremIpsum, equation, theorem, definition,
  abstract, paragraphs, title, type Format, type Paper,
} from "../src/index.js";
import type { Block, Runs } from "../src/doc.js";

const FORMATS: Format[] = ["latex", "markdown", "html", "text"];

describe("determinism", () => {
  test("same seed, same paper", () => {
    for (const format of FORMATS) {
      expect(theoremIpsum({ seed: "quandle", format })).toEqual(
        theoremIpsum({ seed: "quandle", format }),
      );
    }
  });

  test("numeric and string seeds are both stable", () => {
    expect(theoremIpsum({ seed: 7, format: "text" })).toEqual(
      theoremIpsum({ seed: 7, format: "text" }),
    );
  });

  test("different seeds, different papers", () => {
    expect(theoremIpsum({ seed: 1, format: "text" })).not.toEqual(
      theoremIpsum({ seed: 2, format: "text" }),
    );
  });

  test("fragments are deterministic too", () => {
    expect(equation({ seed: "x" })).toEqual(equation({ seed: "x" }));
    expect(theorem({ seed: "x", format: "markdown" })).toEqual(theorem({ seed: "x", format: "markdown" }));
    expect(title({ seed: "x" })).toEqual(title({ seed: "x" }));
  });
});

describe("structure", () => {
  const paper = generatePaper({ seed: "structure-test" });

  test("respects section and reference counts", () => {
    const p = generatePaper({ seed: 3, sections: 5, references: 12 });
    expect(p.sections).toHaveLength(5);
    expect(p.references).toHaveLength(12);
  });

  test("clamps absurd options", () => {
    const p = generatePaper({ seed: 3, sections: 100, references: 0 });
    expect(p.sections.length).toBeLessThanOrEqual(10);
    expect(p.references.length).toBeGreaterThanOrEqual(1);
    const q = generatePaper({ seed: 3, sections: NaN, references: NaN });
    expect(q.sections.length).toBeGreaterThanOrEqual(3);
    expect(q.references.length).toBeGreaterThanOrEqual(1);
  });

  test("every citation points at a bibliography entry", () => {
    for (const seed of ["a", "b", "c", 99]) {
      const p = generatePaper({ seed });
      for (const ids of collect(p, "cite")) {
        for (const id of ids as number[]) {
          expect(id).toBeGreaterThanOrEqual(1);
          expect(id).toBeLessThanOrEqual(p.references.length);
        }
      }
    }
  });

  test("results are numbered by section, in order", () => {
    paper.sections.forEach((section, si) => {
      let counter = 0;
      for (const block of section.blocks) {
        if (block.k === "result") {
          counter += 1;
          expect(block.number).toBe(`${si + 1}.${counter}`);
        }
      }
    });
  });

  test("equations are numbered by section, in order, and eqrefs resolve", () => {
    for (const seed of ["eq-a", "eq-b", 5]) {
      const p = generatePaper({ seed });
      const numbers: string[] = [];
      p.sections.forEach((section, si) => {
        let counter = 0;
        for (const b of walkBlocks(section.blocks)) {
          if (b.k === "display" && b.no) {
            counter += 1;
            expect(b.no).toBe(`${si + 1}.${counter}`);
            numbers.push(b.no);
          }
        }
      });
      for (const no of collect(p, "eqref")) {
        expect(numbers).toContain(no as string);
      }
    }
  });

  test("resrefs point at results that exist", () => {
    for (const seed of ["rr-a", "rr-b"]) {
      const p = generatePaper({ seed });
      const stated = new Set<string>();
      for (const s of p.sections) {
        for (const b of walkBlocks(s.blocks)) {
          if (b.k === "result") stated.add(`${b.kind} ${b.number}`);
        }
      }
      for (const label of collect(p, "resref")) {
        expect(stated).toContain(label as string);
      }
    }
  });

  test("the introduction states a named main theorem and the proof is deferred", () => {
    const intro = paper.sections[0];
    const main = intro.blocks.find((b) => b.k === "result");
    expect(main).toBeDefined();
    if (main?.k === "result") {
      expect(main.number).toBe("1.1");
      expect(main.name).toBe("Main Theorem");
      expect(main.proof).toBeUndefined();
    }
    const hasProofOf = paper.sections.some((s) =>
      s.blocks.some((b) => b.k === "proofOf" && b.number === "1.1"),
    );
    expect(hasProofOf).toBe(true);
  });

  test("references are alphabetized and dated no later than the paper", () => {
    const paperYear = Number(paper.date.split(" ")[1]);
    const keys = paper.references.map((r) => r.sortKey);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    for (const r of paper.references) {
      expect(r.year).toBeLessThanOrEqual(paperYear);
    }
  });

  test("the abstract does not use bracketed citations", () => {
    for (const seed of [1, 2, 3, "abs"]) {
      const p = generatePaper({ seed });
      expect(p.abstract.some((r) => r.k === "cite")).toBe(false);
    }
  });

  test("authors carry addresses and emails", () => {
    for (const a of paper.authors) {
      expect(a.affiliation.length).toBeGreaterThan(5);
      expect(a.email).toMatch(/^[a-z0-9]+@[a-z.]+\.edu$/);
    }
  });
});

describe("fullness", () => {
  test("a default paper is a full-length article", () => {
    for (const seed of [10, 11, 12, "full"]) {
      const p = generatePaper({ seed });
      const all = p.sections.flatMap((s) => [...walkBlocks(s.blocks)]);
      const results = all.filter((b) => b.k === "result").length;
      const displays = all.filter((b) => b.k === "display").length;
      const proofs = all.filter(
        (b) => (b.k === "result" && b.proof !== undefined) || b.k === "proofOf",
      ).length;
      expect(p.sections.length).toBeGreaterThanOrEqual(6);
      expect(results).toBeGreaterThanOrEqual(10);
      expect(displays).toBeGreaterThanOrEqual(10);
      expect(proofs).toBeGreaterThanOrEqual(6);
      expect(p.references.length).toBeGreaterThanOrEqual(15);
      const words = render(p, "text").split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(2000);
    }
  });

  test("every section contains at least one display equation", () => {
    for (const seed of [20, 21, "disp"]) {
      const p = generatePaper({ seed });
      for (const s of p.sections) {
        const displays = [...walkBlocks(s.blocks)].filter((b) => b.k === "display");
        expect(displays.length, s.title).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("formats", () => {
  const paper = generatePaper({ seed: "format-test" });

  test.each(FORMATS)("%s output is substantial and clean", (format) => {
    const out = render(paper, format);
    expect(out.length).toBeGreaterThan(5000);
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("[object Object]");
    expect(out).not.toContain("NaN");
  });

  test("latex has balanced environments", () => {
    for (const seed of ["a", "b", "c", 1, 2, 3]) {
      const out = theoremIpsum({ seed, format: "latex" });
      const begins = [...out.matchAll(/\\begin\{(\w+)\}/g)].map((m) => m[1]);
      const ends = [...out.matchAll(/\\end\{(\w+)\}/g)].map((m) => m[1]);
      expect(begins.sort()).toEqual(ends.sort());

      const stripped = out.replace(/\\[{}]/g, "");
      let depth = 0;
      for (const ch of stripped) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
    }
  });

  test("latex document has the amsart essentials", () => {
    const out = render(paper, "latex");
    expect(out).toContain("\\documentclass[11pt]{amsart}");
    expect(out).toContain("\\numberwithin{equation}{section}");
    expect(out).toContain("\\subjclass[2020]");
    expect(out).toContain("\\keywords{");
    expect(out).toContain("\\address{");
    expect(out).toContain("\\email{");
    expect(out).toContain("\\begin{equation}");
    expect(out).toContain("\\label{theorem:1.1}");
    expect(out).toContain("[Proof of Theorem~\\ref{theorem:1.1}]");
    expect(out).toContain("\\section*{Acknowledgments}");
    expect(out).toContain("\\begin{thebibliography}");
    // The abstract precedes \maketitle, per amsart.
    expect(out.indexOf("\\begin{abstract}")).toBeLessThan(out.indexOf("\\maketitle"));
  });

  test("html is tag-balanced for the containers we emit", () => {
    const out = render(paper, "html");
    for (const tag of ["article", "section", "div", "p", "em", "ol", "li", "span", "h1", "h2", "footer"]) {
      const open = (out.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
      const close = (out.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      expect(open, `<${tag}> open/close`).toBe(close);
    }
  });

  test("fragment helpers return the right shapes", () => {
    expect(equation({ seed: 1, format: "latex" })).toMatch(/^\\\[/);
    expect(equation({ seed: 1, format: "markdown" })).toMatch(/^\$\$/);
    expect(theorem({ seed: 1, format: "latex" })).toContain("\\begin{theorem}");
    expect(definition({ seed: 1, format: "html" })).toContain("Definition");
    expect(abstract({ seed: 1, format: "text" }).length).toBeGreaterThan(50);
    expect(paragraphs(2, { seed: 1, format: "text" }).length).toBeGreaterThan(100);
    expect(title({ seed: 1 }).length).toBeGreaterThan(10);
  });
});

/* ------------------------------------------------------------------ */

function* walkBlocks(blocks: Block[]): Generator<Block> {
  for (const b of blocks) {
    yield b;
    if (b.k === "result" && b.proof) yield* walkBlocks(b.proof);
    if (b.k === "proofOf") yield* walkBlocks(b.body);
  }
}

/** Collect run payloads of a given kind from every Runs in the paper. */
function collect(paper: Paper, kind: "cite" | "eqref" | "resref"): unknown[] {
  const out: unknown[] = [];
  const fromRuns = (runs: Runs) => {
    for (const r of runs) {
      if (r.k !== kind) continue;
      if (r.k === "cite") out.push(r.ids);
      else if (r.k === "eqref") out.push(r.no);
      else if (r.k === "resref") out.push(`${r.kind} ${r.number}`);
    }
  };
  fromRuns(paper.abstract);
  fromRuns(paper.acknowledgments);
  for (const s of paper.sections) {
    for (const b of walkBlocks(s.blocks)) {
      if (b.k === "para") fromRuns(b.runs);
      if (b.k === "result") fromRuns(b.statement);
    }
  }
  return out;
}

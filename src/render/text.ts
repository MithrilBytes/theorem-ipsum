/**
 * Renders a Paper to plain text with Unicode math.
 */
import type { Block, Paper, RefEntry, Runs } from "../doc.js";
import { toText } from "../math.js";

const WIDTH = 78;

function runsToString(rs: Runs): string {
  return rs
    .map((r) => {
      switch (r.k) {
        case "text": return r.s;
        case "emph": return r.s;
        case "math": return toText(r.e);
        case "cite": return `[${r.ids.join(", ")}]`;
        case "eqref": return `(${r.no})`;
        case "resref": return `${r.kind} ${r.number}`;
      }
    })
    .join("");
}

function wrap(s: string, indent = ""): string {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = indent;
  for (const w of words) {
    if (line.length > indent.length && line.length + 1 + w.length > WIDTH) {
      lines.push(line);
      line = indent + w;
    } else {
      line += (line.length > indent.length ? " " : "") + w;
    }
  }
  if (line.trim()) lines.push(line);
  return lines.join("\n");
}

function center(s: string): string {
  return s
    .split("\n")
    .map((line) => " ".repeat(Math.max(0, Math.floor((WIDTH - line.length) / 2))) + line)
    .join("\n");
}

function renderDisplay(b: Extract<Block, { k: "display" }>): string {
  const body = `    ${toText(b.e)}.`;
  return b.no ? `${body}   (${b.no})` : body;
}

function proofBody(body: Block[], label: string): string {
  const [first, ...rest] = body;
  const labeled: Block[] =
    first?.k === "para"
      ? [{ k: "para", runs: [{ k: "text", s: `${label}. ` }, ...first.runs] }, ...rest]
      : body;
  return `${blocks(labeled)} ∎`;
}

function blocks(bs: Block[]): string {
  const out: string[] = [];
  for (const b of bs) {
    switch (b.k) {
      case "para":
        out.push(wrap(runsToString(b.runs)));
        break;
      case "display":
        out.push(renderDisplay(b));
        break;
      case "result": {
        const name = b.name ? ` (${b.name})` : "";
        out.push(wrap(`${b.kind} ${b.number}${name}. ${runsToString(b.statement)}`));
        if (b.proof) out.push(proofBody(b.proof, "Proof"));
        break;
      }
      case "proofOf":
        out.push(proofBody(b.body, `Proof of ${b.kind} ${b.number}`));
        break;
    }
  }
  return out.join("\n\n");
}

function reference(r: RefEntry, i: number): string {
  const head = `[${i + 1}] ${r.authors}, ${r.title}`;
  switch (r.type) {
    case "journal": {
      const issue = r.issue ? `, no. ${r.issue}` : "";
      const pages = r.pages ? `, ${r.pages[0]}–${r.pages[1]}` : "";
      return wrap(`${head}, ${r.venue} ${r.vol}${issue} (${r.year})${pages}.`);
    }
    case "book":
      return wrap(`${head}, ${r.publisher}, ${r.city}, ${r.year}.`);
    case "thesis":
      return wrap(`${head}, Ph.D. thesis, ${r.school}, ${r.year}.`);
    case "preprint":
      return wrap(`${head}, preprint, arXiv:${r.arxiv}.`);
  }
}

export function renderText(paper: Paper): string {
  const parts: string[] = [];
  parts.push(center(wrap(paper.title.toUpperCase())));
  parts.push(center(paper.authors.map((a) => a.name).join(", ")));
  if (paper.appendixBy) parts.push(center(`with an appendix by ${paper.appendixBy}`));
  parts.push(center(paper.date));
  parts.push("");
  parts.push(wrap(`ABSTRACT. ${runsToString(paper.abstract)}`, "   "));
  parts.push("");

  paper.sections.forEach((s, i) => {
    const head = s.appendix ? `APPENDIX A. ${s.title.toUpperCase()}` : `${i + 1}. ${s.title.toUpperCase()}`;
    parts.push(center(head));
    parts.push("");
    parts.push(blocks(s.blocks));
    parts.push("");
  });

  parts.push(center("ACKNOWLEDGMENTS"));
  parts.push("");
  parts.push(wrap(runsToString(paper.acknowledgments)));
  parts.push("");
  parts.push(center("REFERENCES"));
  parts.push("");
  parts.push(paper.references.map(reference).join("\n"));
  parts.push("");
  for (const a of paper.authors) {
    parts.push(wrap(`${a.affiliation}. Email address: ${a.email}`));
  }
  parts.push("");
  parts.push(`(theorem-ipsum, seed: ${String(paper.seed)})`);

  return parts.join("\n");
}

export const textFragments = { runsToString, blocks, wrap };

/**
 * Renders a Paper to a complete amsart document. The shared per-section
 * theorem counter and \numberwithin{equation}{section} reproduce exactly the
 * numbers stored in the model, so \ref and \eqref agree with the other
 * output formats.
 */
import type { Block, Paper, RefEntry, ResultKind, Runs } from "../doc.js";
import { toLatex } from "../math.js";

/** Escape plain text for LaTeX, mapping accented characters to macros. */
export function escapeLatex(s: string): string {
  const accents: Record<string, string> = {
    "ő": "\\H{o}", "ö": "\\\"o", "ä": "\\\"a", "ü": "\\\"u", "Ü": "\\\"U",
    "é": "\\'e", "è": "\\`e", "ń": "\\'n", "ś": "\\'s", "ó": "\\'o",
    "á": "\\'a", "í": "\\'i", "ç": "\\c{c}", "É": "\\'E",
    "—": "---", "–": "--", "’": "'", "‘": "`", "“": "``", "”": "''",
    "…": "\\dots ",
  };
  return s
    .replace(/[\\{}&%$#_~^]/g, (ch) => {
      switch (ch) {
        case "\\": return "\\textbackslash{}";
        case "~": return "\\textasciitilde{}";
        case "^": return "\\textasciicircum{}";
        default: return "\\" + ch;
      }
    })
    .replace(/[őöäüÜéèńśóáíçÉ—–’‘“”…]/g, (ch) => accents[ch] ?? ch);
}

const ENV: Record<ResultKind, string> = {
  Theorem: "theorem", Lemma: "lemma", Proposition: "proposition",
  Corollary: "corollary", Definition: "definition", Conjecture: "conjecture",
  Axiom: "axiom", Postulate: "postulate", Remark: "remark", Example: "example",
};

function runs(rs: Runs): string {
  return rs
    .map((r) => {
      switch (r.k) {
        case "text": return escapeLatex(r.s);
        case "emph": return `\\emph{${escapeLatex(r.s)}}`;
        case "math": return `$${toLatex(r.e)}$`;
        case "cite": return `\\cite{${r.ids.map((i) => `ref${i}`).join(",")}}`;
        case "eqref": return `\\eqref{eq:${r.no}}`;
        case "resref": return `${r.kind}~\\ref{${ENV[r.kind]}:${r.number}}`;
      }
    })
    .join("");
}

function renderDisplay(b: Extract<Block, { k: "display" }>, qed: boolean): string {
  const tail = qed ? " \\qedhere" : "";
  if (b.no) {
    return `\\begin{equation}\\label{eq:${b.no}}\n  ${toLatex(b.e)}.${tail}\n\\end{equation}`;
  }
  return `\\[\n  ${toLatex(b.e)}.${tail}\n\\]`;
}

function blocks(bs: Block[], { inProof = false } = {}): string {
  const parts: string[] = [];
  bs.forEach((b, i) => {
    const prev = bs[i - 1];
    // A display stays inside its sentence: no blank line on either side of it
    // when prose surrounds it.
    const sep = i === 0
      ? ""
      : (prev?.k === "para" && b.k === "display") || (prev?.k === "display" && b.k === "para")
        ? "\n"
        : "\n\n";
    parts.push(sep + renderBlock(b, { inProof, last: i === bs.length - 1 }));
  });
  return parts.join("");
}

function renderBlock(b: Block, opts: { inProof: boolean; last: boolean }): string {
  switch (b.k) {
    case "para":
      return runs(b.runs);
    case "display":
      return renderDisplay(b, opts.inProof && opts.last);
    case "result": {
      const env = ENV[b.kind];
      const name = b.name ? `[${escapeLatex(b.name)}]` : "";
      let s = `\\begin{${env}}${name}\\label{${env}:${b.number}}\n${runs(b.statement)}\n\\end{${env}}`;
      if (b.proof) {
        s += `\n\\begin{proof}\n${blocks(b.proof, { inProof: true })}\n\\end{proof}`;
      }
      return s;
    }
    case "proofOf": {
      const env = ENV[b.kind];
      return `\\begin{proof}[Proof of ${b.kind}~\\ref{${env}:${b.number}}]\n${blocks(b.body, { inProof: true })}\n\\end{proof}`;
    }
  }
}

function reference(r: RefEntry): string {
  const head = `${escapeLatex(r.authors)}, \\emph{${escapeLatex(r.title)}}`;
  switch (r.type) {
    case "journal": {
      const issue = r.issue ? `, no.~${r.issue}` : "";
      const pages = r.pages ? `, ${r.pages[0]}--${r.pages[1]}` : "";
      return `${head}, ${escapeLatex(r.venue ?? "")} \\textbf{${r.vol}}${issue} (${r.year})${pages}.`;
    }
    case "book":
      return `${head}, ${escapeLatex(r.publisher ?? "")}, ${escapeLatex(r.city ?? "")}, ${r.year}.`;
    case "thesis":
      return `${head}, Ph.D. thesis, ${escapeLatex(r.school ?? "")}, ${r.year}.`;
    case "preprint":
      return `${head}, preprint, arXiv:${r.arxiv}.`;
  }
}

export function renderLatex(paper: Paper): string {
  const frontAuthors = paper.authors
    .map((a) =>
      [
        `\\author{${escapeLatex(a.name)}}`,
        `\\address{${escapeLatex(a.affiliation)}}`,
        `\\email{${escapeLatex(a.email)}}`,
      ].join("\n"),
    )
    .join("\n");

  const [primary, ...secondary] = paper.msc;
  const subjclass = secondary.length > 0
    ? `Primary ${primary}; Secondary ${secondary.join(", ")}`
    : `Primary ${primary}`;

  const sections = paper.sections
    .map((s) => {
      const head = s.appendix ? "\\appendix\n\\section" : "\\section";
      return `${head}{${escapeLatex(s.title)}}\n\n${blocks(s.blocks)}`;
    })
    .join("\n\n");

  const bib = paper.references
    .map((r, i) => `\\bibitem{ref${i + 1}} ${reference(r)}`)
    .join("\n");

  return `% Generated by theorem-ipsum (seed: ${JSON.stringify(paper.seed)})
\\documentclass[11pt]{amsart}
\\usepackage{amssymb}
\\numberwithin{equation}{section}

\\newtheorem{theorem}{Theorem}[section]
\\newtheorem{lemma}[theorem]{Lemma}
\\newtheorem{proposition}[theorem]{Proposition}
\\newtheorem{corollary}[theorem]{Corollary}
\\newtheorem{conjecture}[theorem]{Conjecture}
\\newtheorem{axiom}[theorem]{Axiom}
\\newtheorem{postulate}[theorem]{Postulate}
\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{Definition}
\\newtheorem{example}[theorem]{Example}
\\theoremstyle{remark}
\\newtheorem{remark}[theorem]{Remark}

\\title{${escapeLatex(paper.title)}}
${frontAuthors}${paper.appendixBy ? `\n\\dedicatory{with an appendix by ${escapeLatex(paper.appendixBy)}}` : ""}
\\subjclass[2020]{${subjclass}}
\\keywords{${paper.keywords.map(escapeLatex).join("; ")}}
\\date{${escapeLatex(paper.date)}}

\\begin{document}

\\begin{abstract}
${runs(paper.abstract)}
\\end{abstract}

\\maketitle

${sections}

\\section*{Acknowledgments}

${runs(paper.acknowledgments)}

\\begin{thebibliography}{${paper.references.length >= 10 ? "99" : "9"}}
${bib}
\\end{thebibliography}

\\end{document}
`;
}

export const latexFragments = { runs, blocks };

/**
 * Renders a Paper to semantic HTML in amsart layout. Math is emitted as
 *   <span class="math inline">tex</span> / <div class="math display">tex</div>
 * with the TeX as escaped text content, ready for client-side KaTeX or
 * MathJax. Numbered displays carry \tag{n}, which KaTeX renders as the
 * equation number.
 */
import type { Block, Paper, RefEntry, Runs } from "../doc.js";
import { toLatex } from "../math.js";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function runs(rs: Runs): string {
  return rs
    .map((r) => {
      switch (r.k) {
        case "text": return escapeHtml(r.s);
        case "emph": return `<em>${escapeHtml(r.s)}</em>`;
        case "math": return `<span class="math inline">${escapeHtml(toLatex(r.e))}</span>`;
        case "cite": return `<span class="ti-cite">[${r.ids.join(", ")}]</span>`;
        case "eqref": return `(${r.no})`;
        case "resref": return `${r.kind} ${r.number}`;
      }
    })
    .join("");
}

function renderDisplay(b: Extract<Block, { k: "display" }>): string {
  const tex = `${toLatex(b.e)}.${b.no ? ` \\tag{${b.no}}` : ""}`;
  return `<div class="math display">${escapeHtml(tex)}</div>`;
}

function proofBody(body: Block[], label: string): string {
  const [first, ...rest] = body;
  const inner =
    first?.k === "para"
      ? `<p><em>${label}.</em> ${runs(first.runs)}</p>${rest.length ? "\n" + blocks(rest) : ""}`
      : `<p><em>${label}.</em></p>\n${blocks(body)}`;
  return `<div class="ti-proof">${inner}<div class="ti-qed">∎</div></div>`;
}

function blocks(bs: Block[]): string {
  return bs
    .map((b) => {
      switch (b.k) {
        case "para":
          return `<p>${runs(b.runs)}</p>`;
        case "display":
          return renderDisplay(b);
        case "result": {
          const italic = b.kind !== "Definition" && b.kind !== "Remark" && b.kind !== "Example";
          const name = b.name ? ` (${escapeHtml(b.name)})` : "";
          let s = `<div class="ti-result ti-${b.kind.toLowerCase()}"><p><span class="ti-result-head">${b.kind} ${b.number}${name}.</span> ${
            italic ? `<em>${runs(b.statement)}</em>` : runs(b.statement)
          }</p></div>`;
          if (b.proof) s += proofBody(b.proof, "Proof");
          return s;
        }
        case "proofOf":
          return proofBody(b.body, `Proof of ${b.kind} ${b.number}`);
      }
    })
    .join("\n");
}

function reference(r: RefEntry, i: number): string {
  const head = `${escapeHtml(r.authors)}, <em>${escapeHtml(r.title)}</em>`;
  switch (r.type) {
    case "journal": {
      const issue = r.issue ? `, no. ${r.issue}` : "";
      const pages = r.pages ? `, ${r.pages[0]}–${r.pages[1]}` : "";
      return `<li>${head}, ${escapeHtml(r.venue ?? "")} <strong>${r.vol}</strong>${issue} (${r.year})${pages}.</li>`;
    }
    case "book":
      return `<li>${head}, ${escapeHtml(r.publisher ?? "")}, ${escapeHtml(r.city ?? "")}, ${r.year}.</li>`;
    case "thesis":
      return `<li>${head}, Ph.D. thesis, ${escapeHtml(r.school ?? "")}, ${r.year}.</li>`;
    case "preprint":
      return `<li>${head}, preprint, arXiv:${r.arxiv}.</li>`;
  }
}

export function renderHtml(paper: Paper): string {
  const authors = paper.authors
    .map((a) => `<span class="ti-author">${escapeHtml(a.name)}</span>`)
    .join("\n");

  const sections = paper.sections
    .map(
      (s, i) =>
        `<section>\n<h2>${i + 1}. ${escapeHtml(s.title)}</h2>\n${blocks(s.blocks)}\n</section>`,
    )
    .join("\n");

  const addresses = paper.authors
    .map(
      (a) =>
        `<p class="ti-address">${escapeHtml(a.affiliation)}<br><span class="ti-email">Email address: ${escapeHtml(a.email)}</span></p>`,
    )
    .join("\n");

  return `<article class="ti-paper">
<header>
<h1 class="ti-title">${escapeHtml(paper.title)}</h1>
<div class="ti-authors">
${authors}
</div>
<div class="ti-date">${escapeHtml(paper.date)}</div>
</header>
<section class="ti-abstract">
<p><span class="ti-abstract-head">Abstract.</span> ${runs(paper.abstract)}</p>
<p class="ti-meta"><em>Key words and phrases:</em> ${paper.keywords.map(escapeHtml).join("; ")}.<br>
<em>2020 Mathematics Subject Classification:</em> ${paper.msc.join(", ")}.</p>
</section>
${sections}
<section class="ti-acknowledgments">
<h2 class="ti-unnumbered">Acknowledgments</h2>
<p>${runs(paper.acknowledgments)}</p>
</section>
<section class="ti-references">
<h2 class="ti-unnumbered">References</h2>
<ol>
${paper.references.map(reference).join("\n")}
</ol>
</section>
<footer class="ti-addresses">
${addresses}
</footer>
</article>
`;
}

export const htmlFragments = { runs, blocks };

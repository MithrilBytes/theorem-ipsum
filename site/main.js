/* Theorem Ipsum demo. One full paper, generated client-side. */
import { generatePaper, randomSeed, renderHtml, renderLatex } from "./theorem-ipsum.esm.js";

const paperEl = document.getElementById("paper");
let paper = null;

function coerceSeed(raw) {
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

function generate(seedText) {
  paper = generatePaper({ seed: coerceSeed(seedText) });
  paperEl.innerHTML = renderHtml(paper);
  typeset(paperEl);
  history.replaceState(null, "", `${location.pathname}?seed=${encodeURIComponent(seedText)}`);
}

function typeset(root) {
  if (typeof katex === "undefined") return;
  root.querySelectorAll(".math").forEach((el) => {
    try {
      katex.render(el.textContent, el, {
        displayMode: el.classList.contains("display"),
        throwOnError: false,
      });
    } catch {
      /* leave the raw TeX in place */
    }
  });
  // Keep a formula and its trailing punctuation on the same line.
  root.querySelectorAll(".math.inline").forEach((el) => {
    const next = el.nextSibling;
    if (next && next.nodeType === Node.TEXT_NODE) {
      const match = next.textContent.match(/^[,.;:!?)\]]+/);
      if (match) {
        el.appendChild(document.createTextNode(match[0]));
        next.textContent = next.textContent.slice(match[0].length);
      }
    }
  });
}

document.getElementById("randomize").addEventListener("click", () => {
  generate(randomSeed());
  window.scrollTo({ top: 0 });
});

document.getElementById("download").addEventListener("click", () => {
  if (!paper) return;
  const blob = new Blob([renderLatex(paper)], { type: "application/x-tex" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `theorem-ipsum-${String(paper.seed)}.tex`;
  a.click();
  URL.revokeObjectURL(url);
});

const initial = new URLSearchParams(location.search).get("seed") ?? randomSeed();
generate(initial);

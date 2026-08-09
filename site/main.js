/* Theorem Ipsum demo. One full paper, generated client-side. */
import { generatePaper, randomSeed, renderHtml, renderLatex } from "./theorem-ipsum.esm.js";

const paperEl = document.getElementById("paper");
const detailEl = document.getElementById("detail");
const detailValueEl = document.getElementById("detail-value");
let paper = null;
let seedText = "";

function coerceSeed(raw) {
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

function detail() {
  return Number(detailEl.value);
}

function generate() {
  paper = generatePaper({ seed: coerceSeed(seedText), detail: detail() });
  paperEl.innerHTML = renderHtml(paper);
  typeset(paperEl);
  const params = new URLSearchParams();
  params.set("seed", seedText);
  if (detail() !== 0.5) params.set("detail", detailEl.value);
  history.replaceState(null, "", `${location.pathname}?${params}`);
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
  seedText = randomSeed();
  generate();
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

let detailTimer;
detailEl.addEventListener("input", () => {
  detailValueEl.textContent = detail().toFixed(2);
  clearTimeout(detailTimer);
  detailTimer = setTimeout(generate, 150);
});

const params = new URLSearchParams(location.search);
seedText = params.get("seed") ?? randomSeed();
const initialDetail = Number(params.get("detail"));
if (Number.isFinite(initialDetail) && params.get("detail") !== null) {
  detailEl.value = String(Math.max(0, Math.min(1, initialDetail)));
}
detailValueEl.textContent = detail().toFixed(2);
generate();

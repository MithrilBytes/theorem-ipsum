/* Theorem Ipsum demo. One full paper, generated client-side. */
import { generatePaper, randomSeed, renderHtml, renderLatex } from "./theorem-ipsum.esm.js";

const DIALS = ["length", "sentence", "paragraph", "gobbledygook"];

const paperEl = document.getElementById("paper");
let paper = null;
let seedText = "";

function coerceSeed(raw) {
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

function dialValue(name) {
  return Number(document.getElementById(name).value);
}

function generate() {
  const opts = { seed: coerceSeed(seedText) };
  const params = new URLSearchParams();
  params.set("seed", seedText);
  for (const name of DIALS) {
    opts[name] = dialValue(name);
    if (opts[name] !== 0.5) params.set(name, String(opts[name]));
  }
  paper = generatePaper(opts);
  paperEl.innerHTML = renderHtml(paper);
  typeset(paperEl);
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

const seedEl = document.getElementById("seed");

document.getElementById("randomize").addEventListener("click", () => {
  seedText = randomSeed();
  seedEl.value = seedText;
  generate();
  window.scrollTo({ top: 0 });
});

let seedTimer;
seedEl.addEventListener("input", () => {
  clearTimeout(seedTimer);
  seedTimer = setTimeout(() => {
    const raw = seedEl.value.trim();
    if (!raw || raw === seedText) return;
    seedText = raw;
    generate();
  }, 250);
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

let dialTimer;
for (const name of DIALS) {
  const input = document.getElementById(name);
  const readout = document.querySelector(`[data-value="${name}"]`);
  input.addEventListener("input", () => {
    readout.textContent = dialValue(name).toFixed(2);
    clearTimeout(dialTimer);
    dialTimer = setTimeout(generate, 150);
  });
}

const params = new URLSearchParams(location.search);
seedText = params.get("seed") ?? randomSeed();
seedEl.value = seedText;
for (const name of DIALS) {
  const raw = params.get(name);
  if (raw !== null && Number.isFinite(Number(raw))) {
    document.getElementById(name).value = String(Math.max(0, Math.min(1, Number(raw))));
  }
  document.querySelector(`[data-value="${name}"]`).textContent = dialValue(name).toFixed(2);
}
generate();

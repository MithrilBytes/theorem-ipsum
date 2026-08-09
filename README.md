# theorem-ipsum

Seeded generator of nonsense mathematics papers. Produces complete amsart-style
articles (title, authors, abstract, numbered theorems with proofs, numbered
equations, alphabetized bibliography) in four formats: compilable LaTeX,
Markdown, KaTeX-ready HTML, and Unicode plain text.

Live demo: https://mithrilbytes.github.io/theorem-ipsum/

A successor to [sylvanfranklin/nonsense](https://github.com/sylvanfranklin/nonsense)
(Typst) and [mathgen](https://thatsmathematics.com/mathgen/). The same seed
always produces the same paper.

## CLI

```bash
npx theorem-ipsum                          # plain-text paper, random seed
npx theorem-ipsum --seed 42 -f latex -o paper.tex
npx theorem-ipsum -k theorem -f markdown   # one theorem with proof
npx theorem-ipsum -k equation -f latex     # one display equation
```

The LaTeX output is a complete amsart document that compiles as-is. CI
compiles four sample papers with Tectonic on every push.

| Flag | Values |
| --- | --- |
| `-s, --seed` | any string or number |
| `-f, --format` | `latex`, `markdown`, `html`, `text` |
| `-k, --kind` | `paper`, `theorem`, `definition`, `abstract`, `equation`, `paragraphs`, `title` |
| `--sections` | section count, 3 to 10 |
| `--refs` | bibliography size |
| `-n, --count` | paragraph count for `-k paragraphs` |
| `-o, --out` | output file |

## Library

```bash
npm install theorem-ipsum
```

```js
import { theoremIpsum, generatePaper, render, theorem, equation } from "theorem-ipsum";

const tex = theoremIpsum({ seed: "perverse-sheaf-42", format: "latex" });

const paper = generatePaper({ seed: 7, sections: 6, references: 18 });
const md = render(paper, "markdown");
const html = render(paper, "html");

theorem({ seed: 1, format: "markdown" });
equation({ seed: 2, format: "latex" });
```

`generatePaper` returns a plain data structure (sections, blocks, runs,
references) that all four renderers walk, so content is identical across
formats.

## What a generated paper contains

- amsart front matter: `\subjclass[2020]`, `\keywords`, per-author
  `\address` and `\email` blocks.
- An introduction that states the main theorem (`Theorem 1.1 (Main
  Theorem)`), reviews the literature, and ends with an
  organization-of-the-paper paragraph.
- A preliminaries section with a run-in notation paragraph, definitions,
  and lemmas; topic sections with theorems, propositions, corollaries,
  remarks, and examples; a section devoted to the proof of Theorem 1.1
  (`\begin{proof}[Proof of Theorem 1.1]`); applications; concluding
  remarks with open problems.
- Numbered equations (`\numberwithin{equation}{section}`) that later prose
  cites, theorem numbers that match amsthm's shared per-section counter in
  every format, `\label`/`\ref`/`\eqref` cross-references, and bracketed
  citations that always resolve to the bibliography.
- An alphabetized bibliography mixing journal articles, books, Ph.D.
  theses, and arXiv preprints, all dated no later than the paper.

## Development

```bash
npm install
npm test            # determinism, structure, fullness, KaTeX validity
npm run typecheck
npm run build       # library and CLI to dist/
npm run build:site  # browser bundle to site/theorem-ipsum.esm.js
python3 -m http.server 4173 --directory site
```

The demo deploys to GitHub Pages on push to `main`. One-time setup:
Settings, Pages, Source: GitHub Actions.

## License

MIT

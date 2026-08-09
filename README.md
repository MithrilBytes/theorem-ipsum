# theorem-ipsum

Seeded generator of nonsense mathematics papers. Produces complete amsart-style
articles (title, authors, abstract, numbered theorems with proofs, numbered
equations, alphabetized bibliography) in four formats: compilable LaTeX,
Markdown, KaTeX-ready HTML, and Unicode plain text.

Live demo: https://mithrilbytes.github.io/theorem-ipsum/

A successor to [sylvanfranklin/nonsense](https://github.com/sylvanfranklin/nonsense)
(Typst) and [mathgen](https://thatsmathematics.com/mathgen/). The same seed
always produces the same paper.

Not published to npm; clone and build locally.

## CLI

```bash
npm install && npm run build
node dist/cli.js                           # plain-text paper, random seed
node dist/cli.js --seed 42 -f latex -o paper.tex
node dist/cli.js -k theorem -f markdown    # one theorem with proof
node dist/cli.js -k equation -f latex      # one display equation
```

The LaTeX output is a complete amsart document that compiles as-is. CI
compiles four sample papers with Tectonic on every push.

| Flag | Values |
| --- | --- |
| `-s, --seed` | any string or number |
| `--length` | 0 to 1; page length: sections, results, proof depth, references, authors |
| `--sentence` | 0 to 1; sentence length |
| `--paragraph` | 0 to 1; paragraph length |
| `--gobbledygook` | 0 to 1; incoherence of the mathematical language |
| `-f, --format` | `latex`, `markdown`, `html`, `text` |
| `-k, --kind` | `paper`, `theorem`, `definition`, `abstract`, `equation`, `paragraphs`, `title` |
| `--sections` | section count, 3 to 10 |
| `--refs` | bibliography size |
| `-n, --count` | paragraph count for `-k paragraphs` |
| `-o, --out` | output file |

## Library

```js
import { theoremIpsum, generatePaper, render, theorem, equation } from "./dist/index.js";

const tex = theoremIpsum({ seed: "perverse-sheaf-42", format: "latex" });

const paper = generatePaper({ seed: 7, length: 0.8, gobbledygook: 0.9 });
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
- At high detail, an appendix ("Appendix A. A technical lemma") with its
  own contributor, credited "with an appendix by ..." under the byline.

Generation is controlled by four dials, each 0 to 1 (default 0.5), exposed
as sliders in the demo and flags in the CLI:

- `length`: page length. 0 is a four-page note by a single author; 1 is a
  twenty-page treatise with up to six authors, four-way case analyses, and
  the appendix.
- `sentence`: sentence length, via subordinate clauses and longer chains
  of relations.
- `paragraph`: paragraph length, via more sentences per paragraph and
  connective weaving.
- `gobbledygook`: incoherence of the mathematical language, via stacked
  pseudo-/quasi-/hyper- prefixes, notation that strays from the paper's
  palette, and increasingly silly eponyms.

## Development

```bash
npm install
npm test            # determinism, structure, fullness, KaTeX validity
npm run typecheck
npm run build       # library and CLI to dist/
npm run build:site  # browser bundle to site/theorem-ipsum.esm.js
python3 -m http.server 4173 --directory site
```

GitHub Actions:

- `ci.yml`: typecheck, tests, builds, and Tectonic compilation of four
  sample papers on every push and pull request.
- `pages.yml`: deploys the demo to GitHub Pages on push to `main`.
  One-time setup: Settings, Pages, Source: GitHub Actions.
- `daily.yml`: every day at 12:00 UTC, generates the paper of the day
  (seeded by the date), compiles it, and publishes the PDF and LaTeX
  source as a GitHub release.

## License

MIT

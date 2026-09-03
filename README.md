# theorem-ipsum

Generates nonsense math papers. Output is LaTeX, Markdown, HTML, or plain
text; the LaTeX compiles as-is. Same seed, same paper.

Demo: https://mithrilbytes.github.io/theorem-ipsum/

Successor to [nonsense](https://github.com/sylvanfranklin/nonsense) and
[mathgen](https://thatsmathematics.com/mathgen/). Not on npm; clone and
build.

## Usage

```bash
npm install && npm run build
node dist/cli.js --seed 42 -f latex -o paper.tex
```

| Flag | |
| --- | --- |
| `-s, --seed` | any string or number |
| `-f, --format` | `latex`, `markdown`, `html`, `text` |
| `-k, --kind` | `paper`, `theorem`, `definition`, `abstract`, `equation`, `paragraphs`, `title` |
| `--length`, `--sentence`, `--paragraph`, `--gobbledygook` | 0 to 1, default 0.5 |
| `--sections` | 3 to 10 |
| `--refs` | bibliography size |
| `-n, --count` | paragraphs for `-k paragraphs` |
| `-o, --out` | output file |

Or from code:

```js
import { generatePaper, render } from "./dist/index.js";
render(generatePaper({ seed: 7 }), "markdown");
```

## Development

```bash
npm test
npm run build:site
python3 -m http.server 4173 --directory site
```

The site deploys from `pages.yml` on push to main. `daily.yml` publishes a
paper as a release each day.

## License

MIT

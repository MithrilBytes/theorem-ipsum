#!/usr/bin/env node
/**
 * theorem-ipsum CLI.
 *
 *   npx theorem-ipsum --seed 42 --format latex > paper.tex
 *   npx theorem-ipsum -k theorem -f markdown
 */
import { writeFileSync } from "node:fs";
import {
  type Format, VERSION, abstract, definition, equation, paragraphs, theorem,
  theoremIpsum, title,
} from "./index.js";

const HELP = `theorem-ipsum ${VERSION}

Usage: theorem-ipsum [options]

Options:
  -s, --seed <seed>       any string or number; same seed, same paper
  -f, --format <format>   latex | markdown | html | text   (default: text,
                          or latex when --out ends in .tex)
  -k, --kind <kind>       paper | theorem | definition | abstract | equation
                          | paragraphs | title            (default: paper)
  -d, --detail <0..1>     how much paper to generate (default: 0.5)
  -n, --count <n>         paragraph count for --kind paragraphs (default: 3)
      --sections <n>      number of sections, 3-10
      --refs <n>          number of bibliography entries
  -o, --out <file>        write to a file instead of stdout
  -h, --help              show this help
  -v, --version           show version

Examples:
  theorem-ipsum --seed perverse-sheaf-42
  theorem-ipsum -f latex -o nonsense.tex && pdflatex nonsense.tex
  theorem-ipsum -k equation -f latex
  theorem-ipsum -k paragraphs -n 2
`;

interface Args {
  seed?: string | number;
  format?: Format;
  kind: string;
  count: number;
  detail?: number;
  sections?: number;
  refs?: number;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { kind: "paper", count: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) fail(`missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-h": case "--help":
        process.stdout.write(HELP);
        process.exit(0);
        break;
      case "-v": case "--version":
        process.stdout.write(VERSION + "\n");
        process.exit(0);
        break;
      case "-s": case "--seed": {
        const raw = next();
        args.seed = /^-?\d+$/.test(raw) ? Number(raw) : raw;
        break;
      }
      case "-f": case "--format": {
        const f = next();
        if (!["latex", "markdown", "html", "text"].includes(f)) {
          fail(`unknown format "${f}" (expected latex | markdown | html | text)`);
        }
        args.format = f as Format;
        break;
      }
      case "-k": case "--kind":
        args.kind = next();
        break;
      case "-n": case "--count":
        args.count = num(next(), a);
        break;
      case "-d": case "--detail":
        args.detail = num(next(), a);
        break;
      case "--sections":
        args.sections = num(next(), a);
        break;
      case "--refs":
        args.refs = num(next(), a);
        break;
      case "-o": case "--out":
        args.out = next();
        break;
      default:
        fail(`unknown option "${a}" (try --help)`);
    }
  }
  return args;
}

function fail(msg: string): never {
  process.stderr.write(`theorem-ipsum: ${msg}\n`);
  process.exit(1);
}

function num(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) fail(`invalid number "${raw}" for ${flag}`);
  return n;
}

const args = parseArgs(process.argv.slice(2));
const format: Format = args.format ?? (args.out?.endsWith(".tex") ? "latex" : "text");
const opts = { seed: args.seed, format };

let output: string;
switch (args.kind) {
  case "paper":
    output = theoremIpsum({ ...opts, detail: args.detail, sections: args.sections, references: args.refs });
    break;
  case "theorem": output = theorem(opts); break;
  case "definition": output = definition(opts); break;
  case "abstract": output = abstract(opts); break;
  case "equation": output = equation(opts); break;
  case "paragraphs": output = paragraphs(args.count, opts); break;
  case "title": output = title({ seed: args.seed }); break;
  default:
    fail(`unknown kind "${args.kind}" (try --help)`);
}

if (!output.endsWith("\n")) output += "\n";
if (args.out) {
  writeFileSync(args.out, output);
  process.stderr.write(`theorem-ipsum: wrote ${args.out}\n`);
} else {
  process.stdout.write(output);
}

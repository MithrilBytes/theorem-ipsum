/**
 * Assembles a full Paper. Result numbering matches amsart's shared,
 * per-section theorem counter, and equation numbering matches
 * \numberwithin{equation}{section}, so cross-references agree in every
 * output format.
 */
import { Rng, lerp, type Seed } from "./rng.js";
import { FANCY, GREEK_LOWER, GREEK_UPPER, LATIN, type MathCtx } from "./math.js";
import type { Author, Block, Paper, RefEntry, ResultKind, Runs, Section } from "./doc.js";
import { T, joinSentences } from "./doc.js";
import {
  type Ctx, type Dials, type ProvedRef, abstractRuns, acknowledgments,
  conclusion, display, introOpener, literature, mainStatement, namedResult,
  notation, npText, paragraph, proof, shortProof, statement, titleCase,
} from "./grammar.js";
import {
  ACTION_NOUNS, ADJECTIVES, FIELDS, MONTHS, NATIONALITIES, OBJECTS, PLACES,
  SURNAMES, VERBS, an, cap, plural,
} from "./vocab.js";

export interface PaperOptions {
  /** Any string or number; the same seed always yields the same paper. */
  seed?: Seed;
  /** Page length, 0 to 1: sections, results, proof depth, references,
   * authors; 1 also adds an appendix. Default 0.5. */
  length?: number;
  /** Sentence length, 0 to 1: subordinate clauses and longer chains of
   * relations. Default 0.5. */
  sentence?: number;
  /** Paragraph length, 0 to 1: sentences per paragraph and connective
   * weaving. Default 0.5. */
  paragraph?: number;
  /** Incoherence of the mathematical language, 0 to 1: stacked
   * pseudo-/quasi- prefixes, stray notation, sillier eponyms. Default 0.5. */
  gobbledygook?: number;
  /** Number of sections, 3 to 10. Overrides the length-based default. */
  sections?: number;
  /** Number of bibliography entries. Overrides the length-based default. */
  references?: number;
}

const DEFAULT_DIALS: Dials = { length: 0.5, sentence: 0.5, paragraph: 0.5, gobbledygook: 0.5 };

export function randomSeed(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const o = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  return `${a.replace(/\s+/g, "-")}-${o.replace(/\s+/g, "-")}-${Math.floor(Math.random() * 1000)}`;
}

export function makeCtx(seed: Seed, dials: Dials = DEFAULT_DIALS): Ctx {
  const rng = new Rng(seed);
  const boundPool = GREEK_LOWER.filter((s) => s.text !== "π");
  const scalars = [...rng.sample(LATIN, 4), ...rng.sample(boundPool, 3)];
  const palette = [...scalars, ...rng.sample(FANCY, 2), ...rng.sample(GREEK_UPPER, 1)];
  const math: MathCtx = {
    rng, palette, scalars,
    verbosity: dials.sentence,
    scatter: dials.gobbledygook,
  };
  return {
    rng,
    math,
    field: rng.pick(FIELDS),
    named: [namedResult(rng), namedResult(rng)],
    refCount: 18,
    proved: [],
    equations: [],
    eq: { label: "", count: 0 },
    dials,
    theme: { verb: rng.pick(VERBS), buzz: rng.pick(ADJECTIVES), obj: rng.pick(OBJECTS) },
  };
}

export function makeTitle(c: Ctx): string {
  const r = c.rng;
  const { verb, buzz, obj } = c.theme;
  const patterns: [() => string, number][] = [
    [() => `${cap(verb.ger)} ${c.named[0]} for ${buzz} ${plural(obj)}`, 3],
    [() => `${an(buzz)} approach to ${c.named[0]}`, 1],
    [() => `${cap(c.named[0].replace(/^the /, ""))} and its applications`, 1],
    [() => `On the failure of ${c.named[0]} for ${buzz} ${plural(obj)}`, 1],
    [() => `Some ${r.pick(ACTION_NOUNS)} results for ${npText(c, { plural: true })}`, 1.5],
    [() => `On the ${r.pick(ACTION_NOUNS)} of ${npText(c, { plural: true })}`, 1.5],
    [() => `${npText(c, { plural: true })} and ${r.pick(FIELDS)}`, 1],
    [() => `${r.pick(ACTION_NOUNS)} in ${r.pick(FIELDS)}`, 0.8],
    [() => `${npText(c, { plural: true })} over ${npText(c, { plural: true })}`, 0.8],
  ];
  return titleCase(r.weighted(patterns)());
}

/* ------------------------------------------------------------------ */
/* Front and back matter                                               */
/* ------------------------------------------------------------------ */

function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeAffiliation(c: Ctx): { text: string; place: string } {
  const r = c.rng;
  const place = r.pick(PLACES);
  const patterns: [() => string, number][] = [
    [() => `Department of ${titleCase(r.pick(FIELDS))}, University of ${place}`, 3],
    [() => `Institute for ${titleCase(r.pick(ADJECTIVES))} Studies, ${place}`, 2],
    [() => `${place} Institute of Technology`, 1.5],
    [() => `Faculty of ${titleCase(r.pick(FIELDS))}, ${place} State University`, 1.5],
  ];
  return { text: r.weighted(patterns)(), place };
}

function makeAuthors(c: Ctx): Author[] {
  const r = c.rng;
  const d = c.dials.length;
  const n = r.weighted([
    [1, lerp(5, 0.5, d)], [2, lerp(3, 2, d)], [3, lerp(1.5, 3, d)],
    [4, lerp(0.3, 2.5, d)], [5, lerp(0, 1.5, d)], [6, lerp(0, 0.8, d)],
  ] as const);
  const surnames = r.sample(SURNAMES, n);
  const letters = "ABCDEFGHJKLMNPQRSTVW";
  return surnames.map((s) => {
    const initials = r.chance(0.25)
      ? `${r.pick([...letters])}. ${r.pick([...letters])}.`
      : `${r.pick([...letters])}.`;
    const affiliation = makeAffiliation(c);
    return {
      name: `${initials} ${s}`,
      affiliation: affiliation.text,
      email: `${slug(s)}@math.${slug(affiliation.place)}.edu`,
    };
  });
}

function makeMsc(c: Ctx): string[] {
  const r = c.rng;
  const tops = ["03", "05", "06", "11", "13", "14", "16", "18", "20", "22", "28", "30", "37", "46", "54", "55", "57", "60"];
  const n = r.range(2, 3 + Math.round(2 * c.dials.length));
  const out = new Set<string>();
  while (out.size < n) {
    out.add(`${r.pick(tops)}${r.pick([..."ABCDEFGHK"])}${r.range(0, 9)}${r.range(0, 9)}`);
  }
  return [...out];
}

const PUBLISHERS: [string, string][] = [
  ["Springer-Verlag", "Berlin"],
  ["Cambridge University Press", "Cambridge"],
  ["North-Holland", "Amsterdam"],
  ["Birkhäuser", "Basel"],
  ["Academic Press", "New York"],
];

function refAuthors(c: Ctx): { text: string; sortKey: string } {
  const r = c.rng;
  const n = r.weighted([[1, 3], [2, 3], [3, 1]] as const);
  const names = r
    .sample(SURNAMES, n)
    .map((s) => `${r.pick([..."ABCDEFGHJKLMNPQRSTVW"])}. ${s}`);
  const text =
    n === 1 ? names[0]
    : n === 2 ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(", ")}, and ${names[n - 1]}`;
  return { text, sortKey: names[0].slice(3) };
}

function makeReference(c: Ctx, paperYear: number): RefEntry {
  const r = c.rng;
  const offset = r.weighted([[() => r.range(0, 10), 3], [() => r.range(10, 35), 2], [() => r.range(35, 80), 0.7]] as const)();
  const year = Math.max(1801, paperYear - offset);

  const titlePatterns: [() => string, number][] = [
    [() => `On ${r.pick(ADJECTIVES)} ${plural(r.pick(OBJECTS))}`, 3],
    [() => `${cap(r.pick(ADJECTIVES))} methods in ${r.pick(FIELDS)}`, 2],
    [() => `${cap(namedResult(r).replace(/^the /, ""))} and applications`, 1.5],
    [() => `A note on the ${r.pick(ADJECTIVES)} ${r.pick(OBJECTS)}`, 2],
    [() => `${cap(r.pick(VERBS).ger)} ${plural(r.pick(OBJECTS))} without tears`, 1],
    [() => `Sur quelques ${plural(r.pick(OBJECTS))} ${r.pick(ADJECTIVES)}`, 0.8],
    [() => `Über ${r.pick(ADJECTIVES)} ${cap(plural(r.pick(OBJECTS)))}`, 0.8],
  ];
  const title = r.weighted(titlePatterns)();
  const { text: authors, sortKey } = refAuthors(c);
  const base = { authors, sortKey, title, year };

  const type = r.weighted([
    ["journal", 0.62], ["book", 0.14], ["thesis", 0.08], ["preprint", 0.16],
  ] as const);

  if (type === "preprint" && year >= 2008) {
    const id = `${String(year).slice(2)}${String(r.range(1, 12)).padStart(2, "0")}.${String(r.range(1, 99999)).padStart(5, "0")}`;
    return { ...base, type: "preprint", arxiv: id };
  }
  if (type === "book") {
    const [publisher, city] = r.pick(PUBLISHERS);
    return { ...base, type: "book", publisher, city };
  }
  if (type === "thesis") {
    return { ...base, type: "thesis", school: `University of ${r.pick(PLACES)}` };
  }

  const venuePatterns: [() => string, number][] = [
    [() => `J. ${titleCase(r.pick(FIELDS))}`, 3],
    [() => `Ann. of ${titleCase(r.pick(FIELDS))}`, 2],
    [() => `${r.pick(NATIONALITIES)} J. Math.`, 2],
    [() => `Bull. ${r.pick(NATIONALITIES)} Math. Soc.`, 2],
    [() => `Proc. ${r.pick(NATIONALITIES)} Acad. ${titleCase(r.pick(FIELDS))}`, 1.5],
    [() => `Inventiones Zoncologicae`, 0.6],
  ];
  const start = r.range(1, 400);
  return {
    ...base,
    type: "journal",
    venue: r.weighted(venuePatterns)(),
    vol: Math.max(1, year - (1900 + r.range(0, 70))),
    issue: r.chance(0.4) ? r.range(1, 4) : undefined,
    pages: [start, start + r.range(2, 60)],
  };
}

/* ------------------------------------------------------------------ */
/* Section planning                                                    */
/* ------------------------------------------------------------------ */

type SecType = "intro" | "prelim" | "topic" | "proofsec" | "apps" | "concluding" | "appendix";

interface SectionPlan {
  type: SecType;
  title: string;
  /** Lowercase phrase used by the organization paragraph. */
  topic: string;
}

function planSections(c: Ctx, total: number): SectionPlan[] {
  const r = c.rng;
  const topicTitle = (): { title: string; topic: string } => {
    const patterns: [() => { title: string; topic: string }, number][] = [
      [() => { const t = `the ${r.pick(ADJECTIVES)} case`; return { title: t, topic: t }; }, 2],
      [() => { const t = npText(c, { plural: true }); return { title: `fundamental properties of ${t}`, topic: t }; }, 1.5],
      [() => { const t = r.pick(ACTION_NOUNS); return { title: `connections to ${t}`, topic: `questions of ${t}` }; }, 1.5],
      [() => { const t = r.pick(ACTION_NOUNS); return { title: `an application to ${t}`, topic: `an application to ${t}` }; }, 1.2],
      [() => { const t = `basic results of ${r.pick(FIELDS)}`; return { title: t, topic: t }; }, 1],
      [() => { const t = `an example of ${r.pick(SURNAMES)}`; return { title: t, topic: t }; }, 0.8],
      [() => { const t = `${r.pick(ADJECTIVES)} ${plural(r.pick(OBJECTS))}`; return { title: t, topic: t }; }, 1.5],
      [() => { const t = `${an(r.pick(ADJECTIVES))} counterexample`; return { title: t, topic: t }; }, 1],
      [() => { const t = c.named[1]; return { title: `${r.pick(VERBS).ger} ${t}`, topic: t }; }, 1.2],
    ];
    const { title, topic } = r.weighted(patterns)();
    return { title: titleCase(title), topic };
  };

  const middles = total - 2;
  const plans: SectionPlan[] = [{ type: "intro", title: "Introduction", topic: c.field }];

  if (middles === 1) {
    plans.push({ type: "proofsec", title: "Proof of Theorem 1.1", topic: "the proof" });
  } else if (middles >= 2) {
    plans.push({ type: "prelim", title: "Preliminaries", topic: c.field });
    const nTopics = Math.max(0, middles - 3);
    for (let i = 0; i < nTopics; i++) {
      const { title, topic } = topicTitle();
      plans.push({ type: "topic", title, topic });
    }
    plans.push({ type: "proofsec", title: "Proof of Theorem 1.1", topic: "the proof" });
    if (middles >= 3) {
      const field = c.rng.pick(FIELDS);
      plans.push({ type: "apps", title: titleCase(`Applications to ${field}`), topic: field });
    }
  }

  plans.push({ type: "concluding", title: "Concluding remarks", topic: "open problems" });
  if (c.rng.chance(Math.max(0, (c.dials.length - 0.55) * 2))) {
    plans.push({ type: "appendix", title: "A technical lemma", topic: "a technical lemma" });
  }
  return plans;
}

function organization(c: Ctx, plans: SectionPlan[]): Runs {
  const r = c.rng;
  const sentences: Runs[] = [T`The remainder of this paper is organized as follows.`];
  plans.forEach((p, i) => {
    const n = String(i + 1);
    switch (p.type) {
      case "prelim":
        sentences.push(
          p.topic.endsWith("theory")
            ? T`In Section ${n} we fix notation and review the fundamentals of ${p.topic}.`
            : T`In Section ${n} we fix notation and recall the basic theory of ${p.topic}.`,
        );
        break;
      case "topic": {
        const pron = p.topic.endsWith("s") ? "their" : "its";
        sentences.push(r.weighted<Runs>([
          [T`In Section ${n} we study ${p.topic}.`, 1],
          [T`Section ${n} introduces ${p.topic} and establishes ${pron} elementary properties.`, 1],
          [T`Section ${n} treats ${p.topic}.`, 1],
        ] as [Runs, number][]));
        break;
      }
      case "proofsec":
        sentences.push(T`Section ${n} is devoted to the proof of Theorem 1.1.`);
        break;
      case "apps":
        sentences.push(T`In Section ${n} we present applications to ${p.topic}.`);
        break;
      case "concluding":
        sentences.push(T`We conclude in Section ${n} with some open problems.`);
        break;
      case "appendix":
        sentences.push(T`The appendix contains the proof of a technical lemma.`);
        break;
      default:
        break;
    }
  });
  return joinSentences(sentences);
}

/* ------------------------------------------------------------------ */
/* Section content                                                     */
/* ------------------------------------------------------------------ */

interface Counter {
  n: number;
}

function result(
  c: Ctx,
  kind: ResultKind,
  sectionLabel: string | number,
  counter: Counter,
  opts: { name?: string; forceProof?: boolean } = {},
): Block {
  const number = `${sectionLabel}.${++counter.n}`;
  const provable = kind === "Theorem" || kind === "Proposition" || kind === "Lemma";
  const block: Block = {
    k: "result",
    kind,
    number,
    name: opts.name,
    statement: statement(c, kind),
    proof:
      provable && (opts.forceProof || c.rng.chance(0.9))
        ? proof(c)
        : kind === "Corollary" && c.rng.chance(0.7)
          ? shortProof(c)
          : undefined,
  };
  c.proved.push({ kind, number });
  return block;
}

const TOPIC_KINDS: [ResultKind, number][] = [
  ["Theorem", 2.5], ["Proposition", 2], ["Lemma", 2.5], ["Corollary", 1.5],
  ["Remark", 1.2], ["Example", 1.2], ["Conjecture", 0.4],
];

const PRELIM_KINDS: [ResultKind, number][] = [
  ["Definition", 3], ["Lemma", 2], ["Example", 1.2], ["Remark", 1],
  ["Axiom", 0.6], ["Postulate", 0.4],
];

const APPS_KINDS: [ResultKind, number][] = [
  ["Corollary", 2.5], ["Theorem", 1.5], ["Proposition", 1.5],
  ["Example", 1.5], ["Remark", 1],
];

function interleave(
  c: Ctx,
  sectionLabel: string,
  counter: Counter,
  kinds: [ResultKind, number][],
  nParas: number,
  nResults: number,
): Block[] {
  const blocks: Block[] = [];
  const total = Math.max(nParas, nResults);
  for (let i = 0; i < total; i++) {
    if (i < nParas) blocks.push(...paragraph(c));
    if (i < nResults) blocks.push(result(c, c.rng.weighted(kinds), sectionLabel, counter));
  }
  return blocks;
}

/** Every section carries at least one display equation. */
function ensureDisplay(c: Ctx, blocks: Block[]): void {
  const hasDisplay = (bs: Block[]): boolean =>
    bs.some((b) => b.k === "display"
      || (b.k === "result" && b.proof !== undefined && hasDisplay(b.proof))
      || (b.k === "proofOf" && hasDisplay(b.body)));
  if (!hasDisplay(blocks)) {
    const at = blocks.findIndex((b) => b.k === "para");
    blocks.splice(at + 1, 0, display(c));
  }
}

function buildSection(c: Ctx, index: number, plan: SectionPlan, main: ProvedRef): Section {
  const r = c.rng;
  const d = c.dials.length;
  const label = plan.type === "appendix" ? "A" : String(index);
  c.eq = { label, count: 0 };
  const counter: Counter = { n: 0 };
  const paras = (lo0: number, hi0: number, lo1: number, hi1: number) =>
    r.range(Math.round(lerp(lo0, lo1, d)), Math.round(lerp(hi0, hi1, d)));
  let blocks: Block[] = [];

  switch (plan.type) {
    case "prelim": {
      blocks.push({ k: "para", runs: notation(c) });
      blocks.push(...interleave(c, label, counter, PRELIM_KINDS, paras(1, 2, 3, 6), paras(2, 2, 4, 6)));
      break;
    }
    case "topic": {
      blocks = interleave(c, label, counter, TOPIC_KINDS, paras(2, 3, 4, 7), paras(1, 2, 3, 6));
      break;
    }
    case "proofsec": {
      blocks.push({
        k: "para",
        runs: joinSentences([
          r.pick([
            T`The goal of this section is to prove Theorem ${main.number}.`,
            T`We are now in a position to prove Theorem ${main.number}.`,
          ]),
          ...(r.chance(0.6) ? [paragraphLead(c)] : []),
        ]),
      });
      blocks.push(result(c, "Lemma", label, counter, {
        name: r.chance(0.5) ? "Key Lemma" : undefined,
        forceProof: true,
      }));
      blocks.push(...paragraph(c));
      if (r.chance(lerp(0.3, 0.9, d))) {
        blocks.push(result(c, "Lemma", label, counter, { forceProof: true }));
      }
      blocks.push({ k: "proofOf", kind: main.kind, number: main.number, body: proof(c, { deep: true }) });
      blocks.push(...paragraph(c, { display: false }));
      if (r.chance(0.7)) blocks.push(result(c, "Corollary", label, counter));
      if (r.chance(0.4)) blocks.push(result(c, "Remark", label, counter));
      break;
    }
    case "apps": {
      blocks = interleave(c, label, counter, APPS_KINDS, paras(1, 3, 3, 5), paras(1, 2, 3, 4));
      break;
    }
    case "concluding": {
      blocks.push({ k: "para", runs: conclusion(c) });
      if (r.chance(0.6)) blocks.push(result(c, "Conjecture", label, counter));
      if (r.chance(0.3)) blocks.push(result(c, "Remark", label, counter));
      break;
    }
    case "appendix": {
      blocks.push({
        k: "para",
        runs: T`This appendix supplies the proof of a technical lemma used in the proof of Theorem ${main.number}.`,
      });
      blocks.push(result(c, "Lemma", label, counter, { forceProof: true }));
      blocks.push(...paragraph(c));
      if (r.chance(0.6)) blocks.push(result(c, "Lemma", label, counter, { forceProof: true }));
      if (r.chance(0.4)) blocks.push(result(c, "Remark", label, counter));
      break;
    }
    default:
      break;
  }

  ensureDisplay(c, blocks);
  return { title: plan.title, blocks };
}

function paragraphLead(c: Ctx): Runs {
  return T`The argument follows the strategy of ${c.rng.pick(SURNAMES)}, with ${c.rng.pick(ADJECTIVES)} modifications.`;
}

/* ------------------------------------------------------------------ */
/* The whole paper                                                     */
/* ------------------------------------------------------------------ */

export function generatePaper(opts: PaperOptions = {}): Paper {
  const seed = opts.seed ?? randomSeed();
  const dials: Dials = {
    length: clamp01(opts.length ?? 0.5),
    sentence: clamp01(opts.sentence ?? 0.5),
    paragraph: clamp01(opts.paragraph ?? 0.5),
    gobbledygook: clamp01(opts.gobbledygook ?? 0.5),
  };
  const len = dials.length;
  const c = makeCtx(seed, dials);
  const r = c.rng;

  const totalSections = clamp(
    opts.sections ?? r.range(Math.round(lerp(4, 10, len)), Math.round(lerp(5, 12, len))),
    3, 10,
  );
  c.refCount = clamp(
    opts.references ?? r.range(Math.round(lerp(6, 24, len)), Math.round(lerp(8, 36, len))),
    1, 60,
  );

  const plans = planSections(c, totalSections);
  const title = makeTitle(c);
  const authors = makeAuthors(c);
  const paperYear = r.range(2018, 2026);
  const date = `${r.pick(MONTHS)} ${paperYear}`;
  const abstract = abstractRuns(c);
  const keywords = [
    npText(c, { plural: true }),
    c.field,
    c.named[1].replace(/^the /, ""),
    `${r.pick(ADJECTIVES)} ${r.pick(OBJECTS)}`,
  ].slice(0, 3 + Math.round(2 * len));
  const msc = makeMsc(c);

  // Introduction: motivation, literature, the main theorem, organization.
  c.eq = { label: "1", count: 0 };
  const counter: Counter = { n: 0 };
  const introBlocks: Block[] = [
    { k: "para", runs: introOpener(c) },
    { k: "para", runs: literature(c) },
    ...paragraph(c, { display: true }),
    { k: "para", runs: r.chance(0.5) ? T`We now state our main result.` : T`Our main result is the following.` },
  ];
  if (len > 0.7) introBlocks.splice(2, 0, ...paragraph(c));
  const main: ProvedRef = { kind: "Theorem", number: `1.${++counter.n}` };
  introBlocks.push({
    k: "result", kind: main.kind, number: main.number, name: "Main Theorem",
    statement: mainStatement(c),
  });
  c.proved.push(main);
  if (r.chance(0.5)) introBlocks.push(result(c, r.chance(0.6) ? "Definition" : "Remark", "1", counter));
  introBlocks.push({ k: "para", runs: organization(c, plans) });

  const sections: Section[] = [{ title: "Introduction", blocks: introBlocks }];
  plans.slice(1).forEach((plan, i) => {
    const section = buildSection(c, i + 2, plan, main);
    if (plan.type === "appendix") section.appendix = true;
    sections.push(section);
  });

  const hasAppendix = sections.some((s) => s.appendix);
  const appendixBy = hasAppendix
    ? `${r.pick([..."ABCDEFGHJKLMNPQRSTVW"])}. ${r.pick(SURNAMES.filter((n) => !authors.some((a) => a.name.endsWith(n))))}`
    : undefined;

  const references = Array.from({ length: c.refCount }, () => makeReference(c, paperYear));
  references.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return {
    seed, title, authors, appendixBy, date, abstract, keywords, msc, sections,
    acknowledgments: acknowledgments(c),
    references,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** A standalone numbered result for the fragment API. */
export function fragmentResult(c: Ctx, kind: ResultKind): Block {
  return result(c, kind, "1", { n: 0 }, { forceProof: kind === "Theorem" });
}

export { paragraph as ctxParagraph };

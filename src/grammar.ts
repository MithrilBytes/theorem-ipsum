/**
 * Sentence-level generation: noun phrases, prose templates, theorem
 * statements, proofs. Everything draws from a shared Ctx so a paper stays
 * coherent: the same symbols recur, named results are referred to
 * consistently, citations point at bibliography entries that exist, and later
 * prose can lean on results and numbered equations already stated.
 */
import { lerp, type Rng } from "./rng.js";
import type { Expr, MathCtx } from "./math.js";
import { displayExpr, distinctSyms, pureSym, relation, relationWith, term } from "./math.js";
import type { Block, ResultKind, Run, Runs } from "./doc.js";
import { T, citeRun, emph, eqref, joinSentences, m, mergeText, resref, t } from "./doc.js";
import {
  ACTION_NOUNS, ADJECTIVES, ADVERB_MODS, ADVERBS, CLOSERS, FIELDS, GLAZE,
  HEDGES, IVERBS, NAMED_KINDS, NATIONALITIES, OBJECTS, PREFIXES, SURNAMES,
  SURNAMES_REAL, SURNAMES_SILLY, VERBS, an, cap, plural, titleCase, type Verb,
} from "./vocab.js";

export interface ProvedRef {
  kind: ResultKind;
  number: string;
}

export interface Dials {
  /** Page length: sections, results, proof depth, references, authors. */
  length: number;
  /** Sentence length: subordinate clauses, longer relation chains. */
  sentence: number;
  /** Paragraph length: sentences per paragraph, connective weaving. */
  paragraph: number;
  /** Incoherence of the mathematical language. */
  gobbledygook: number;
}

export interface Ctx {
  rng: Rng;
  math: MathCtx;
  field: string;
  /** Named results, e.g. "the perverse Nozzle torsor conjecture". */
  named: string[];
  refCount: number;
  /** Results already stated, in order. */
  proved: ProvedRef[];
  /** Numbered display equations already emitted, e.g. "2.3". */
  equations: string[];
  /** Section label for equation numbering ("2", "A"); "" disables it. */
  eq: { label: string; count: number };
  /** The four generation dials, each 0 to 1 with 0.5 the calibrated default. */
  dials: Dials;
  /** Title ingredients, echoed by the abstract and conclusion. */
  theme: { verb: Verb; buzz: string; obj: string };
}

/* ------------------------------------------------------------------ */
/* Small pickers                                                       */
/* ------------------------------------------------------------------ */

/** Stack pseudo-/quasi-/anti- prefixes as gobbledygook rises. */
function decorate(c: Ctx, word: string): string {
  const g = c.dials.gobbledygook;
  if (c.rng.chance(lerp(0.02, 0.45, g))) word = `${c.rng.pick(PREFIXES)}${word}`;
  if (c.rng.chance(lerp(0, 0.18, g))) word = `${c.rng.pick(PREFIXES)}${word}`;
  return word;
}

const obj = (c: Ctx) => c.rng.pick(OBJECTS);
const verb = (c: Ctx) => c.rng.pick(VERBS);
const iverb = (c: Ctx) => c.rng.pick(IVERBS);
const adverb = (c: Ctx) => c.rng.pick(ADVERBS);
const act = (c: Ctx) => c.rng.pick(ACTION_NOUNS);
const hedge = (c: Ctx) => c.rng.pick(HEDGES);
const named = (c: Ctx) => c.rng.pick(c.named);
const rel = (c: Ctx) => m(relation(c.math));
const sym = (c: Ctx) => m(pureSym(c.math));
const sym2 = (c: Ctx) => distinctSyms(c.math, 2).map(m);
const surname = (c: Ctx) =>
  c.rng.chance(lerp(0.25, 0.75, c.dials.gobbledygook))
    ? c.rng.pick(SURNAMES_SILLY)
    : c.rng.pick(SURNAMES_REAL);
const surnames2 = (c: Ctx) => {
  const first = surname(c);
  let second = surname(c);
  for (let i = 0; i < 4 && second === first; i++) second = surname(c);
  return [first, second];
};
const provedRef = (c: Ctx) => {
  const p = c.rng.pick(c.proved);
  return resref(p.kind, p.number);
};
const eqRef = (c: Ctx) => eqref(c.rng.pick(c.equations));

export function cite(c: Ctx): Run {
  const r = c.rng;
  const first = r.range(1, c.refCount);
  const ids = [first];
  if (r.chance(0.18) && c.refCount > 1) {
    let second = r.range(1, c.refCount);
    if (second === first) second = (second % c.refCount) + 1;
    ids.push(second);
    ids.sort((a, b) => a - b);
  }
  return citeRun(ids);
}

/** "the perverse Nozzle torsor conjecture" and friends. */
export function namedResult(rng: Rng): string {
  const b = rng.pick(ADJECTIVES);
  const [s1, s2] = rng.sample(SURNAMES, 2);
  const o = rng.pick(OBJECTS);
  const kind = rng.pick(NAMED_KINDS);
  const patterns: [() => string, number][] = [
    [() => `the ${b} ${s1} ${o} ${kind}`, 3],
    [() => `the ${s1}–${s2} ${kind}`, 2],
    [() => `${s1}'s ${b} ${kind}`, 2],
    [() => `the ${b} ${kind} of ${s1}`, 1.5],
  ];
  return rng.weighted(patterns)();
}

/* ------------------------------------------------------------------ */
/* Noun phrases                                                        */
/* ------------------------------------------------------------------ */

/** A surname pressed into service as an adjective: "sub-Kepler", "Cauchy–Riemann". */
function eponymAdj(c: Ctx): string {
  const r = c.rng;
  let name: string = surname(c);
  if (r.chance(0.22)) name = `${r.pick(PREFIXES)}${name}`;
  if (r.chance(0.15)) {
    const other = surname(c);
    if (other !== name) name = `${name}–${other}`;
  } else if (r.chance(0.1)) {
    name = `${name}-type`;
  }
  return name;
}

/** One modifier: an adjective, possibly adverb-led, prefixed, or eponymous. */
function modifier(c: Ctx): string {
  const r = c.rng;
  const g = c.dials.gobbledygook;
  if (r.chance(lerp(0.2, 0.42, g))) return eponymAdj(c);
  let adj = decorate(c, r.pick(ADJECTIVES));
  if (r.chance(lerp(0.12, 0.4, g))) adj = `${r.pick(ADVERB_MODS)} ${adj}`;
  return adj;
}

const predAdj = modifier;

/** Attributive modifier list, comma-joined: "meager, Nozzle, pairwise affine". */
function modifierList(c: Ctx, max = 3): string {
  const r = c.rng;
  const g = c.dials.gobbledygook;
  const n = Math.min(max, r.weighted([
    [1, 3], [2, lerp(0.8, 2.2, g)], [3, lerp(0.1, 1.1, g)],
  ] as const));
  return Array.from({ length: n }, () => modifier(c)).join(", ");
}

/** Predicate modifier list, "and"-joined: "compact, Weyl and stochastically free". */
function predList(c: Ctx): string {
  const r = c.rng;
  const g = c.dials.gobbledygook;
  const n = r.weighted([[1, 3], [2, lerp(0.7, 2, g)], [3, lerp(0.15, 1, g)]] as const);
  const mods = Array.from({ length: n }, () => modifier(c));
  return n === 1 ? mods[0] : `${mods.slice(0, -1).join(", ")} and ${mods[n - 1]}`;
}

/** A full noun phrase, no article: "pairwise Nozzle, quasi-affine ideal over ℱ". */
function np(c: Ctx, opts: { plural?: boolean; pp?: boolean } = {}): Runs {
  const r = c.rng;
  const noun = opts.plural ? plural(obj(c)) : obj(c);
  const head: Runs = [t(`${modifierList(c)} ${noun}`)];
  if (opts.pp !== false && r.chance(0.22)) {
    const tail = r.weighted<() => Runs>([
      [() => T` over ${m(pureSym(c.math))}`, 2],
      [() => T` of ${m(pureSym(c.math))}`, 1.5],
      [() => T` acting on ${aNp(c, { pp: false })}`, 1.2],
      [() => T` equipped with ${aNp(c, { pp: false })}`, 1],
    ] as [() => Runs, number][])();
    return mergeText([...head, ...tail]);
  }
  return head;
}

const npPlural = (c: Ctx) => np(c, { plural: true });

/** Noun phrase with its article: "a pairwise Nozzle ideal". */
function aNp(c: Ctx, opts: { pp?: boolean } = {}): Runs {
  const phrase = np(c, opts);
  const first = phrase[0];
  const article = first?.k === "text" ? an(first.s).split(" ")[0] : "a";
  return mergeText([t(`${article} `), ...phrase]);
}

/** Capitalize the first word of a run sequence. */
function capRuns(runs: Runs): Runs {
  const first = runs[0];
  if (first?.k === "text") {
    return mergeText([{ k: "text", s: cap(first.s) }, ...runs.slice(1)]);
  }
  return runs;
}

/** Plain-text noun phrase, no math and no PP, for titles and keywords. */
export function npText(c: Ctx, opts: { plural?: boolean } = {}): string {
  const noun = opts.plural ? plural(obj(c)) : obj(c);
  return `${modifierList(c, 2)} ${noun}`;
}

/* ------------------------------------------------------------------ */
/* Assertions and appeals to authority                                 */
/* ------------------------------------------------------------------ */

const COMPARATORS = [
  "isomorphic to", "homeomorphic to", "diffeomorphic to", "equivalent to",
  "comparable to", "dominated by", "controlled by", "bounded by",
  "distinct from", "invariant under",
];

/** A claim: usually a formula, sometimes prose in the mathgen mold. */
function assertion(c: Ctx): Runs {
  const r = c.rng;
  if (r.chance(0.6)) return [rel(c)];
  return r.weighted<() => Runs>([
    [() => { const [x, y] = sym2(c); return T`${x} is ${r.chance(0.25) ? "not " : ""}${r.pick(COMPARATORS)} ${y}`; }, 3],
    [() => T`${sym(c)} is ${predList(c)}`, 2.5],
    [() => T`${surname(c)}'s conjecture is ${c.rng.pick(["true", "false"])} in the context of ${npPlural(c)}`, 0.8],
    [() => T`${surname(c)}'s ${r.pick(["condition is satisfied", "criterion applies"])}`, 0.8],
    [() => T`the Riemann hypothesis holds`, 0.5],
  ] as [() => Runs, number][])();
}

const CLEAR = [
  "clear", "simple", "elementary", "straightforward", "obvious", "trivial",
  "left as an exercise to the reader",
];

/** An appeal to authority: "a well-known result of Nozzle [3]". */
function bigTheorem(c: Ctx): Runs {
  const r = c.rng;
  return r.weighted<() => Runs>([
    [() => T`${surname(c)}'s theorem`, 2],
    [() => T`a ${r.pick(["well-known", "little-known", "recent"])} result of ${surname(c)} ${cite(c)}`, 2],
    [() => T`the general theory`, 1.5],
    [() => T`standard techniques of ${r.pick(FIELDS)}`, 1.5],
    [() => T`well-known properties of ${npPlural(c)}`, 1.2],
    [() => T`the ${act(c)} of ${npPlural(c)}`, 1.2],
    [() => T`a standard argument`, 1],
    [() => T`an approximation argument`, 1],
    [() => T`an easy exercise`, 0.8],
  ] as [() => Runs, number][])();
}

/** A display block; numbered with probability 0.45 when numbering is active. */
export function display(c: Ctx, e?: Expr): Block {
  const expr = e ?? displayExpr(c.math);
  if (c.eq.label && c.rng.chance(0.45)) {
    const no = `${c.eq.label}.${++c.eq.count}`;
    c.equations.push(no);
    return { k: "display", e: expr, no };
  }
  return { k: "display", e: expr };
}

/* ------------------------------------------------------------------ */
/* Prose sentences                                                     */
/* ------------------------------------------------------------------ */

type SGen = (c: Ctx) => Runs;

const SENTENCES: [SGen, number][] = [
  // Setup and exposition.
  [(c) => T`Let ${sym(c)} be ${aNp(c)}, and write ${m(term(c.math, 1))} for its ${np(c, { pp: false })}.`, 2],
  [(c) => T`Fix ${aNp(c)} in the sense of ${surname(c)} ${cite(c)}.`, 1.5],
  [(c) => T`Recall from ${cite(c)} that every ${np(c)} is ${predList(c)}.`, 2],
  [(c) => T`${cap(hedge(c))} that ${assertion(c)}.`, 2.5],
  [(c) => { const [a, b] = sym2(c); return T`Consider the ${np(c, { pp: false })} ${m(term(c.math, 1))} obtained by ${verb(c).ger} ${a} along ${b}.`; }, 1.4],
  [(c) => T`Observe that ${rel(c)}, at least ${adverb(c)}.`, 1.8],
  [(c) => T`It is well known that ${assertion(c)}.`, 1.5],
  [(c) => T`It has long been known that ${assertion(c)} ${cite(c)}.`, 1.5],
  [(c) => T`More generally, one may ${verb(c).base} any ${np(c)} provided ${rel(c)}.`, 1.2],
  [(c) => { const [a, b] = sym2(c); return T`Throughout, ${a} denotes ${aNp(c)} and ${b} its canonical ${obj(c)}.`; }, 1],
  [(c) => T`In particular, ${rel(c)}.`, 1.4],
  [(c) => T`Hence ${rel(c)}, and the analogous statement for ${npPlural(c)} follows ${adverb(c)}.`, 1.1],
  [(c) => T`On the other hand, ${rel(c)} whenever ${sym(c)} is ${predAdj(c)}.`, 1.2],
  [(c) => T`By construction, ${rel(c)}.`, 1.2],
  [(c) => T`By ${bigTheorem(c)}, ${assertion(c)}.`, 1.8],
  [(c) => T`By ${cap(act(c)).toLowerCase()}, ${rel(c)}.`, 0.9],
  [(c) => T`It follows from the definition of ${aNp(c, { pp: false })} that ${rel(c)}.`, 1.2],
  [(c) => T`We write ${m(term(c.math, 1))} for the ${obj(c)} of ${sym(c)}, following ${cite(c)}.`, 1],
  [(c) => T`Surprisingly, the ${obj(c)} ${sym(c)} is ${predList(c)}, though not ${adverb(c)} so.`, 1.1],
  // Literature and history.
  [(c) => T`In ${cite(c)}, it is shown that ${assertion(c)}.`, 1.8],
  [(c) => T`The ${c.rng.pick(GLAZE)} work of ${surname(c)} on ${named(c)} ${cite(c)} ${adverb(c)} ${verb(c).third} our ${obj(c)}.`, 1.3],
  [(c) => { const [s1, s2] = surnames2(c); return T`In ${cite(c)}, ${s1} and ${s2} asked whether every ${np(c)} ${iverb(c).third}; we answer this in the ${predAdj(c)} case.`; }, 1.1],
  [(c) => T`Recent developments in ${c.rng.pick(FIELDS)} ${cite(c)} have raised the question of whether ${assertion(c)}.`, 1.8],
  [(c) => T`It was ${surname(c)} who first asked whether ${npPlural(c)} can be ${verb(c).past}.`, 1.5],
  [(c) => T`A central problem in ${c.rng.pick(FIELDS)} is the ${act(c)} of ${npPlural(c)}.`, 1.7],
  [(c) => T`In ${cite(c)}, the main result was the ${act(c)} of ${npPlural(c)}.`, 1.6],
  [(c) => T`In ${cite(c)}, the authors address the ${act(c)} of ${npPlural(c)} under the additional assumption that ${assertion(c)}.`, 1.4],
  [(c) => { const [s1, s2] = surnames2(c); return T`${s1} ${cite(c)} improved upon the results of ${s2} by ${verb(c).ger} ${npPlural(c)}.`; }, 1.3],
  [(c) => T`It would be interesting to apply the techniques of ${cite(c)} to ${npPlural(c)}.`, 1.4],
  [(c) => T`We wish to extend the results of ${cite(c)} to ${npPlural(c)}.`, 1.4],
  [(c) => T`${surname(c)}'s ${act(c)} of ${npPlural(c)} was a milestone in ${c.rng.pick(FIELDS)}.`, 1.2],
  [(c) => T`The groundbreaking work of ${surname(c)} on ${npPlural(c)} was a major advance.`, 1],
  [(c) => T`A useful survey of the subject can be found in ${cite(c)}.`, 1],
  [(c) => T`In this context, the results of ${cite(c)} are highly relevant.`, 1.1],
  [(c) => T`This could shed important light on a conjecture of ${surname(c)}.`, 1.2],
  [(c) => T`The work in ${cite(c)} did not consider the ${predAdj(c)} case.`, 1.3],
  [(c) => T`This was extended to the ${predAdj(c)} setting in ${cite(c)}.`, 1],
  [(c) => T`Recent interest in ${npPlural(c)} has centered on ${verb(c).ger} ${npPlural(c)}.`, 1.2],
  [(c) => T`Recently, there has been much interest in the ${act(c)} of ${npPlural(c)}.`, 1.5],
  [(c) => T`A standard argument ${cite(c)} shows that every ${np(c)} ${iverb(c).third}.`, 1.2],
  // Rhetoric.
  [(c) => T`Is it possible to ${verb(c).base} ${npPlural(c)}?`, 1.1],
  [(c) => T`Can one ${verb(c).base} ${npPlural(c)}?`, 0.5],
  [(c) => T`In this setting, the ability to ${verb(c).base} ${npPlural(c)} is essential.`, 1.2],
  [(c) => T`Unfortunately, we cannot assume that ${assertion(c)}.`, 1.3],
  [(c) => T`Every student is aware that ${assertion(c)}.`, 1],
  [(c) => T`It is not yet known whether ${assertion(c)}, although ${cite(c)} does address the issue of ${act(c)}.`, 1.4],
  [(c) => T`This leaves open the question of ${act(c)}.`, 1.1],
  [(c) => T`Very little is known about ${npPlural(c)} beyond the ${predAdj(c)} case.`, 1.1],
  [(c) => T`It is essential to consider that ${sym(c)} may be ${predList(c)}.`, 1.1],
  [(c) => T`Here, ${act(c)} is ${c.rng.pick(["clearly", "obviously", "trivially"])} a concern.`, 0.6],
  [(c) => T`This stands in stark contrast to the ${predAdj(c)} case, where ${rel(c)} fails ${adverb(c)}.`, 1],
  [(c) => T`Suppose toward contradiction that ${rel(c)}. Then ${rel(c)}, which is absurd.`, 0.8],
  [(c) => T`By ${named(c)}, ${rel(c)} whenever ${rel(c)}.`, 1.3],
  [(c) => T`It is not known whether ${assertion(c)} in general.`, 1],
  [(c) => T`No ${np(c, { pp: false })} can ${verb(c).base} itself; this is ${c.rng.pick(["obvious", "an axiom", "folklore", "immediate from the definitions"])}.`, 0.6],
];

const PROVED_SENTENCES: [SGen, number][] = [
  [(c) => T`Combining ${provedRef(c)} with ${cite(c)} yields ${rel(c)}.`, 2],
  [(c) => T`By ${provedRef(c)}, we may assume that ${rel(c)}.`, 2],
  [(c) => T`Note that ${provedRef(c)} applies verbatim, since ${rel(c)}.`, 1.5],
  [(c) => T`In view of ${provedRef(c)}, ${rel(c)}.`, 1.5],
  [(c) => T`It would be interesting to remove the ${predAdj(c)} hypothesis from ${provedRef(c)}.`, 1],
];

const EQ_SENTENCES: [SGen, number][] = [
  [(c) => T`Combining ${eqRef(c)} with ${cite(c)} yields ${rel(c)}.`, 2],
  [(c) => T`By ${eqRef(c)}, we have ${rel(c)}.`, 2],
  [(c) => T`Substituting into ${eqRef(c)} gives ${rel(c)}.`, 1.5],
];

const CONNECTIVES = [
  "Moreover,", "Furthermore,", "In fact,", "Indeed,", "Thus,", "Therefore,",
  "Next,", "Now,", "On the other hand,", "In contrast,", "Likewise,",
];

// Sentence starts that already carry their own transition or are questions.
const NO_PREFIX = [
  "In particular", "Hence", "More generally", "On the other hand", "This ",
  "Surprisingly", "Throughout", "It is not", "Recently", "Unfortunately",
  "Is it", "Can one", "Here,", "By ", "In this context", "In contrast",
];

/** Prefix a sentence with a connective, lowercasing its first word. */
function weave(c: Ctx, runs: Runs): Runs {
  const first = runs[0];
  if (first?.k !== "text") return runs;
  if (NO_PREFIX.some((p) => first.s.startsWith(p))) return runs;
  const lowered = first.s.charAt(0).toLowerCase() + first.s.slice(1);
  return mergeText([
    t(`${c.rng.pick(CONNECTIVES)} `),
    { k: "text", s: lowered },
    ...runs.slice(1),
  ]);
}

/** Append a subordinate clause, splicing it in before the final period. */
function extendSentence(c: Ctx, runs: Runs): Runs {
  const last = runs[runs.length - 1];
  if (last?.k !== "text" || !last.s.endsWith(".")) return runs;
  const clause = c.rng.weighted<() => Runs>([
    [() => T`, provided ${rel(c)}.`, 2],
    [() => T`, whenever ${sym(c)} is ${predAdj(c)}.`, 2],
    [() => T`, in the sense of ${surname(c)} ${cite(c)}.`, 1.5],
    [() => T`, though the converse fails ${adverb(c)}.`, 1.2],
    [() => T`, as the reader may verify.`, 1],
    [() => T`, and similarly for ${npPlural(c)}.`, 1.3],
  ] as [() => Runs, number][])();
  return mergeText([...runs.slice(0, -1), t(last.s.slice(0, -1)), ...clause]);
}

export function sentence(c: Ctx): Runs {
  const r = c.rng;
  let pool = SENTENCES;
  if (c.proved.length > 0 && r.chance(0.18)) pool = PROVED_SENTENCES;
  else if (c.equations.length > 0 && r.chance(0.12)) pool = EQ_SENTENCES;
  let runs = r.weighted(pool)(c);
  if (r.chance(lerp(0.06, 0.5, c.dials.sentence))) runs = extendSentence(c, runs);
  return runs;
}

/** A paragraph whose length and display probability scale with the dials. */
export function paragraph(c: Ctx, opts: { display?: boolean } = {}): Block[] {
  const p = c.dials.paragraph;
  const n = c.rng.range(Math.round(lerp(2, 5, p)), Math.round(lerp(4, 10, p)));
  const sentences: Runs[] = [];
  for (let i = 0; i < n; i++) {
    let sent = sentence(c);
    if (i > 0 && c.rng.chance(lerp(0.15, 0.4, p))) sent = weave(c, sent);
    sentences.push(sent);
  }
  const blocks: Block[] = [{ k: "para", runs: joinSentences(sentences) }];
  const wantDisplay = opts.display ?? c.rng.chance(lerp(0.3, 0.6, c.dials.length));
  if (wantDisplay) blocks.push(display(c));
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Theorem statements                                                  */
/* ------------------------------------------------------------------ */

const SUPPOSE = ["Let us suppose", "Let us assume", "Assume", "Suppose"];

export function statement(c: Ctx, kind: ResultKind): Runs {
  const r = c.rng;
  switch (kind) {
    case "Definition":
      return r.weighted<() => Runs>([
        [() => T`${capRuns(aNp(c))} is said to be ${emph(predAdj(c))} if ${rel(c)}.`, 2],
        [() => T`${capRuns(aNp(c, { pp: false }))} is a ${emph(obj(c))} if it is ${predList(c)}.`, 1.5],
        [() => T`The ${emph(npText(c))} of ${sym(c)} is the ${obj(c)} ${m(term(c.math, 1))}, provided this exists.`, 1.5],
        [() => T`We say ${aNp(c, { pp: false })} ${sym(c)} is ${emph(predAdj(c))} if ${rel(c)}.`, 1.5],
        [() => T`We call ${sym(c)} ${emph(predAdj(c))} whenever ${rel(c)}, and ${emph(`totally ${predAdj(c)}`)} otherwise.`, 1],
      ])();
    case "Conjecture":
      return r.weighted<() => Runs>([
        [() => T`Every ${np(c)} ${iverb(c).third} after finitely many steps.`, 1.5],
        [() => T`${cap(named(c))} holds for all ${npPlural(c)}.`, 1],
        [() => { const e = pureSym(c.math); return T`There are infinitely many ${npPlural(c)} ${m(e)} with ${m(relationWith(c.math, e))}.`; }, 1.2],
      ])();
    case "Axiom":
    case "Postulate":
      return r.weighted<() => Runs>([
        [() => T`There is no ${np(c)}.`, 1],
        [() => T`${rel(c)}, always and without exception.`, 1.2],
        [() => T`Every ${obj(c)} is contained in ${aNp(c)}, which is itself ${predAdj(c)}.`, 1],
      ])();
    case "Corollary":
      return r.weighted<() => Runs>([
        [() => T`${rel(c)}.`, 1.5],
        [() => T`${cap(named(c))} holds ${adverb(c)}.`, 1],
        [() => { const [p, q] = c.rng.sample(ADJECTIVES, 2); return T`No ${obj(c)} is both ${decorate(c, p)} and ${decorate(c, q)}.`; }, 1],
      ])();
    case "Remark": {
      const variants: [() => Runs, number][] = [
        [() => c.proved.length > 0
          ? T`The converse of ${provedRef(c)} is false in general; see ${cite(c)}.`
          : T`The converse is false in general; see ${cite(c)}.`, 1.5],
        [() => T`The hypothesis that ${sym(c)} be ${predAdj(c)} cannot be dropped, as the ${obj(c)} ${m(term(c.math, 1))} shows.`, 1.5],
        [() => T`It is not known whether ${assertion(c)} in the ${predAdj(c)} case.`, 1.2],
        [() => T`A similar argument applies to ${npPlural(c)}, with ${sym(c)} replaced by ${m(term(c.math, 1))}.`, 1.2],
      ];
      return r.weighted(variants)();
    }
    case "Example": {
      const x = sym(c);
      const variants: [() => Runs, number][] = [
        [() => { const [p, q] = c.rng.sample(ADJECTIVES, 2); return T`Let ${x} = ${m(term(c.math, 2))}. Then ${x} is ${decorate(c, p)} but not ${decorate(c, q)}.`; }, 2],
        [() => T`Take ${x} to be the ${np(c, { pp: false })} of ${m(term(c.math, 1))}. Then ${rel(c)}, so ${x} fails to be ${predAdj(c)}.`, 1.5],
        [() => T`The ${obj(c)} ${m(term(c.math, 1))} is ${predList(c)}; however, it does not satisfy ${named(c)}.`, 1.2],
      ];
      return r.weighted(variants)();
    }
    default: {
      // Theorem, Lemma, Proposition
      const variants: [() => Runs, number][] = [
        [() => { const e = pureSym(c.math); return T`Let ${m(e)} be ${aNp(c)}. Then ${m(relationWith(c.math, e))}.`; }, 2.5],
        [() => T`Every ${np(c)} is ${predList(c)}, and moreover ${rel(c)}.`, 2],
        [() => { const [x, y] = distinctSyms(c.math, 2); return T`For every ${np(c, { pp: false })} ${m(x)} there exists a unique ${np(c, { pp: false })} ${m(y)} such that ${m(relationWith(c.math, y))}.`; }, 2],
        [() => T`If ${rel(c)}, then ${rel(c)}.`, 2],
        [() => T`There exists ${aNp(c, { pp: false })} that is ${predList(c)}.`, 1.2],
        [() => { const e = pureSym(c.math); const x = m(e); return T`Suppose ${x} ${iverb(c).third}. Then ${x} is ${predAdj(c)} if and only if ${m(relationWith(c.math, e))}.`; }, 1.5],
        [() => { const e = pureSym(c.math); return T`Assume ${rel(c)}. Then ${m(relationWith(c.math, e))}, and equality holds if and only if ${m(e)} is ${predAdj(c)}.`; }, 1.5],
        [() => {
          const [x, y] = distinctSyms(c.math, 2);
          const target = c.rng.chance(0.5) ? x : y;
          return T`${r.pick(SUPPOSE)} ${assertion(c)}. Let ${m(x)} be ${aNp(c)}. Further, let ${m(y)} be ${aNp(c)}. Then ${m(relationWith(c.math, target))}.`;
        }, 2],
      ];
      return r.weighted(variants)();
    }
  }
}

/** The main theorem's statement, echoing the title. */
export function mainStatement(c: Ctx): Runs {
  const { buzz: b, obj: o } = c.theme;
  const e = pureSym(c.math);
  const x = m(e);
  const variants: [() => Runs, number][] = [
    [() => T`Let ${x} be ${an(b)} ${o}. Then ${named(c)} holds for ${x}; in particular, ${m(relationWith(c.math, e))}.`, 2],
    [() => T`Every ${b} ${o} ${iverb(c).third}. Moreover, ${rel(c)}.`, 2],
    [() => T`${cap(c.named[0])} holds for every ${b} ${o}.`, 1.5],
  ];
  return c.rng.weighted(variants)();
}

/* ------------------------------------------------------------------ */
/* Proofs                                                              */
/* ------------------------------------------------------------------ */

const PROOF_OPENERS: [SGen, number][] = [
  [(c) => T`We begin by observing that ${assertion(c)}.`, 2],
  [(c) => T`Without loss of generality, ${rel(c)}, since ${sym(c)} may be ${verb(c).past} ${adverb(c)}.`, 1.6],
  [(c) => T`Suppose the contrary.`, 1.2],
  [(c) => T`The essential idea is that ${assertion(c)}.`, 1.6],
  [(c) => T`We follow ${cite(c)}.`, 1.2],
  [(c) => T`We show the contrapositive.`, 1],
  [(c) => T`One direction is ${c.rng.pick(CLEAR)}, so we consider the converse.`, 1.4],
  [(c) => T`This proof can be omitted on a first reading.`, 0.6],
  [(c) => T`Fix ${aNp(c)} ${sym(c)} and let ${m(term(c.math, 1))} denote its ${np(c, { pp: false })}.`, 1.8],
  [(c) => T`By Zorn's lemma, ${rel(c)}.`, 1],
  [(c) => T`Passing to a subsequence if necessary, we may assume ${rel(c)}.`, 1.2],
  [(c) => T`We first treat the case in which ${sym(c)} is ${predAdj(c)}.`, 1.3],
];

function closer(c: Ctx): Runs {
  const r = c.rng;
  return r.weighted<() => Runs>([
    [() => T`The result now follows by ${bigTheorem(c)}.`, 2],
    [() => T`The remaining details are ${r.pick(CLEAR)}.`, 1.6],
    [() => T`This is the desired statement.`, 1.2],
    [() => T`The interested reader can fill in the details.`, 1],
    [() => T`This contradicts the fact that ${assertion(c)}.`, 1],
    [() => T`See ${cite(c)} for a related argument.`, 0.9],
    [() => T`The remaining details are a routine exercise in ${r.pick(FIELDS)}.`, 0.8],
    [() => [t(r.pick(CLOSERS))], 2.5],
  ] as [() => Runs, number][])();
}

export function proof(c: Ctx, opts: { deep?: boolean } = {}): Block[] {
  const r = c.rng;
  const d = c.dials.length;
  const pd = c.dials.paragraph;
  const deep = opts.deep ?? r.chance(lerp(0.1, 0.6, d));

  if (!opts.deep && r.chance(0.07)) {
    return [{ k: "para", runs: r.chance(0.5) ? T`This is ${r.pick(CLEAR)}.` : T`See ${cite(c)}.` }];
  }

  const blocks: Block[] = [];
  const opener = r.weighted(PROOF_OPENERS)(c);
  const mid = () => {
    const extra =
      (r.chance(lerp(0.3, 0.6, pd)) ? 1 : 0) + (r.chance(lerp(0, 0.35, pd)) ? 1 : 0);
    const sentences = [sentence(c)];
    for (let i = 0; i < extra; i++) sentences.push(weave(c, sentence(c)));
    return joinSentences(sentences);
  };

  const shape = r.weighted([
    ["chain", 3], ["cases", 1.6], ["induction", deep ? 2 : 1],
  ] as const);

  if (shape === "induction") {
    blocks.push({
      k: "para",
      runs: joinSentences([
        r.chance(0.25) ? T`We proceed by transfinite induction.` : T`We proceed by induction on ${sym(c)}.`,
        T`For the base case, ${rel(c)}, so that`,
      ]),
    });
    blocks.push(display(c));
    blocks.push({
      k: "para",
      runs: joinSentences([T`For the inductive step, assume ${rel(c)}.`, mid(), T`It follows that`]),
    });
    blocks.push(display(c));
    if (deep || r.chance(lerp(0.3, 0.8, d))) {
      blocks.push({ k: "para", runs: joinSentences([sentence(c), T`Consequently,`]) });
      blocks.push(display(c));
    }
    blocks.push({ k: "para", runs: joinSentences([T`This closes the induction.`, closer(c)]) });
    return blocks;
  }

  if (shape === "cases") {
    const extra1 = (deep || r.chance(lerp(0, 0.7, d))) ? 1 : 0;
    const extra2 = extra1 && r.chance(lerp(0, 0.35, d)) ? 1 : 0;
    const n = 2 + extra1 + extra2;
    const words = ["two", "three", "four"][n - 2];
    blocks.push({ k: "para", runs: joinSentences([opener, T`We distinguish ${words} cases.`]) });
    for (let i = 1; i <= n; i++) {
      const label = emph(`Case ${i}.`);
      if (i === 1) blocks.push({ k: "para", runs: T`${label} Here ${rel(c)}, so that` });
      else if (i === n) blocks.push({ k: "para", runs: T`${label} Otherwise ${rel(c)}, and` });
      else blocks.push({ k: "para", runs: T`${label} Suppose instead that ${rel(c)}. Then` });
      blocks.push(display(c));
    }
    blocks.push({ k: "para", runs: joinSentences([T`In each case the claim follows.`, closer(c)]) });
    return blocks;
  }

  blocks.push({ k: "para", runs: joinSentences([opener, mid(), T`It follows that`]) });
  blocks.push(display(c));
  blocks.push({ k: "para", runs: joinSentences([sentence(c), T`Combining this with ${cite(c)}, we obtain`]) });
  blocks.push(display(c));
  if (deep || r.chance(lerp(0.25, 0.75, d))) {
    blocks.push({ k: "para", runs: joinSentences([sentence(c), T`Consequently,`]) });
    blocks.push(display(c));
  }
  if (r.chance(lerp(0.15, 0.4, d))) {
    blocks.push({ k: "para", runs: joinSentences([mid(), T`We conclude that`]) });
    blocks.push(display(c));
  } else {
    blocks.push({ k: "para", runs: closer(c) });
  }
  return blocks;
}

/** A one-line proof for corollaries. */
export function shortProof(c: Ctx): Block[] {
  const from: Run | string = c.proved.length > 0 ? provedRef(c) : named(c);
  return [{ k: "para", runs: T`Immediate from ${from} and ${cite(c)}.` }];
}

/* ------------------------------------------------------------------ */
/* Structured paragraphs                                               */
/* ------------------------------------------------------------------ */

export function introOpener(c: Ctx): Runs {
  const { verb: v, buzz: b, obj: o } = c.theme;
  const sentences = [
    T`In ${c.field}, ${c.named[0]} for ${b} ${plural(o)} has long been considered ${v.able}${c.rng.chance(0.5) ? ", if not " + adverb(c) + " so" : ""}.`,
    T`The goal of the present ${c.rng.pick(["paper", "article"])} is to ${v.base} it ${adverb(c)}.`,
    sentence(c),
  ];
  if (c.rng.chance(c.dials.paragraph)) sentences.push(weave(c, sentence(c)));
  return joinSentences(sentences);
}

/** A literature-review paragraph for the introduction. */
export function literature(c: Ctx): Runs {
  const sentences = [
    T`The systematic study of ${npPlural(c)} began with the ${c.rng.pick(GLAZE)} memoir of ${surname(c)} ${cite(c)}.`,
    T`Further progress was made in ${cite(c)}, where ${named(c)} was established for ${npPlural(c)}.`,
    sentence(c),
  ];
  const extra = c.rng.range(0, Math.round(2 * c.dials.paragraph));
  for (let i = 0; i < extra; i++) sentences.push(weave(c, sentence(c)));
  sentences.push(T`For general background on ${c.field}, we refer the reader to ${cite(c)}.`);
  return joinSentences(sentences);
}

/** A run-in notation paragraph for the preliminaries. */
export function notation(c: Ctx): Runs {
  const [a, b] = sym2(c);
  const sentences = [
    T`${emph("Notation.")} Throughout, ${a} denotes ${aNp(c, { pp: false })} and ${b} its canonical ${obj(c)}.`,
    T`We write ${m(term(c.math, 1))} for the ${obj(c)} associated to ${sym(c)}.`,
    T`All ${plural(obj(c))} are assumed ${predList(c)} unless stated otherwise.`,
  ];
  if (c.rng.chance(c.dials.paragraph)) {
    sentences.push(T`Subscripts are omitted whenever ${sym(c)} is clear from context.`);
  }
  if (c.rng.chance(c.dials.paragraph * 0.7)) {
    sentences.push(T`The symbol ${m(term(c.math, 0))} is reserved for ${aNp(c, { pp: false })}.`);
  }
  sentences.push(T`We use ${cite(c)} as a general reference for ${c.field}.`);
  return joinSentences(sentences);
}

export function abstractRuns(c: Ctx): Runs {
  const r = c.rng;
  const year = r.range(1995, 2024);
  const pool: Runs[] = [
    T`Our main result shows that ${rel(c)}, ${r.pick(["improving on", "sharpening", "extending"])} a bound of ${surname(c)} (${String(year)}).`,
    T`As an application, we obtain ${aNp(c, { pp: false })} that ${iverb(c).third}.`,
    T`The proof combines techniques from ${r.pick(FIELDS)} with ${predAdj(c)} methods from ${r.pick(FIELDS)}.`,
    T`Recently, there has been much interest in the ${act(c)} of ${npPlural(c)}; this paper addresses the question of ${act(c)}.`,
    T`The methods are elementary and make no use of ${plural(obj(c))}.`,
    T`Some consequences for ${r.pick(FIELDS)} are discussed.`,
    T`This answers a question of ${surname(c)}.`,
  ];
  const chosen = r.sample(pool, r.range(4, 5));
  return joinSentences([
    T`We ${c.theme.verb.base} ${c.named[0]} for ${c.theme.buzz} ${plural(c.theme.obj)}.`,
    ...chosen,
  ]);
}

export function conclusion(c: Ctx): Runs {
  const { verb: v, buzz: b, obj: o } = c.theme;
  const sentences = [
    T`We have ${v.past} ${c.named[0]} for every ${b} ${o}.`,
    sentence(c),
    sentence(c),
  ];
  const extra = c.rng.range(0, Math.round(2 * c.dials.paragraph));
  for (let i = 0; i < extra; i++) sentences.push(weave(c, sentence(c)));
  sentences.push(
    T`Whether the ${predAdj(c)} case admits a similar treatment remains open.`,
    T`In future work, we plan to address questions of ${act(c)} as well as ${act(c)}.`,
    T`We hope to return to this question in future work.`,
  );
  return joinSentences(sentences);
}

export function acknowledgments(c: Ctx): Runs {
  const r = c.rng;
  const sentences: Runs[] = [
    T`The authors thank ${surname(c)} for helpful conversations, and the anonymous referee for a careful reading of the manuscript.`,
  ];
  if (r.chance(0.6)) {
    const grant = `${r.pick([..."ABCDEFGH"])}${r.pick([..."ABCDEFGH"])}-${r.range(1000, 9999)}`;
    sentences.push(
      T`The ${r.pick(["first", "second"])} author was supported in part by ${r.pick(NATIONALITIES)} Science Foundation grant ${grant}.`,
    );
  }
  sentences.push(T`And most of all, thank you for using Theorem Ipsum.`);
  return joinSentences(sentences);
}

export { titleCase };

/**
 * Sentence-level generation: prose templates, theorem statements, proofs.
 * Everything draws from a shared Ctx so a paper stays coherent: the same
 * symbols recur, named results are referred to consistently, citations point
 * at bibliography entries that exist, and later prose can lean on results and
 * numbered equations already stated.
 */
import type { Rng } from "./rng.js";
import type { Expr, MathCtx } from "./math.js";
import { displayExpr, distinctSyms, pureSym, relation, term } from "./math.js";
import type { Block, ResultKind, Run, Runs } from "./doc.js";
import { T, citeRun, emph, eqref, joinSentences, m, resref, t } from "./doc.js";
import {
  ADJECTIVES, ADVERBS, CLOSERS, FIELDS, GLAZE, HEDGES, IVERBS, NAMED_KINDS,
  NATIONALITIES, OBJECTS, SURNAMES, VERBS, an, cap, plural, titleCase,
  type Verb,
} from "./vocab.js";

export interface ProvedRef {
  kind: ResultKind;
  number: string;
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
  /** Current section for equation numbering; 0 disables numbering. */
  eq: { section: number; count: number };
  /** Title ingredients, echoed by the abstract and conclusion. */
  theme: { verb: Verb; buzz: string; obj: string };
}

/* ------------------------------------------------------------------ */
/* Small pickers                                                       */
/* ------------------------------------------------------------------ */

const buzz = (c: Ctx) => c.rng.pick(ADJECTIVES);
const buzz2 = (c: Ctx) => c.rng.sample(ADJECTIVES, 2);
const obj = (c: Ctx) => c.rng.pick(OBJECTS);
const verb = (c: Ctx) => c.rng.pick(VERBS);
const iverb = (c: Ctx) => c.rng.pick(IVERBS);
const adverb = (c: Ctx) => c.rng.pick(ADVERBS);
const surname = (c: Ctx) => c.rng.pick(SURNAMES);
const surnames2 = (c: Ctx) => c.rng.sample(SURNAMES, 2);
const hedge = (c: Ctx) => c.rng.pick(HEDGES);
const named = (c: Ctx) => c.rng.pick(c.named);
const rel = (c: Ctx) => m(relation(c.math));
const sym = (c: Ctx) => m(pureSym(c.math));
const sym2 = (c: Ctx) => distinctSyms(c.math, 2).map(m);
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

/** A display block; numbered with probability 0.45 when numbering is active. */
export function display(c: Ctx, e?: Expr): Block {
  const expr = e ?? displayExpr(c.math);
  if (c.eq.section > 0 && c.rng.chance(0.45)) {
    const no = `${c.eq.section}.${++c.eq.count}`;
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
  [(c) => T`Let ${sym(c)} be ${an(buzz(c))} ${obj(c)}, and write ${m(term(c.math, 1))} for its ${buzz(c)} ${obj(c)}.`, 2],
  [(c) => T`Fix ${an(buzz(c))} ${obj(c)} in the sense of ${surname(c)} ${cite(c)}.`, 1.5],
  [(c) => T`Recall from ${cite(c)} that every ${buzz(c)} ${obj(c)} is ${adverb(c)} ${buzz(c)}.`, 2],
  [(c) => T`${cap(hedge(c))} that ${rel(c)}.`, 2.5],
  [(c) => T`This stands in stark contrast to the ${buzz(c)} case, where ${rel(c)} fails ${adverb(c)}.`, 1.2],
  [(c) => T`The ${c.rng.pick(GLAZE)} work of ${surname(c)} on ${named(c)} ${cite(c)} ${adverb(c)} ${verb(c).third} our ${obj(c)}.`, 1.5],
  [(c) => { const [s1, s2] = surnames2(c); return T`In ${cite(c)}, ${s1} and ${s2} asked whether every ${buzz(c)} ${obj(c)} ${iverb(c).third}; we answer this in the ${buzz(c)} case.`; }, 1.2],
  [(c) => T`Suppose toward contradiction that ${rel(c)}. Then ${rel(c)}, which is absurd.`, 1],
  [(c) => T`By ${named(c)}, ${rel(c)} whenever ${rel(c)}.`, 1.5],
  [(c) => { const [a, b] = sym2(c); return T`Consider the ${buzz(c)} ${obj(c)} ${m(term(c.math, 1))} obtained by ${verb(c).ger} ${a} along ${b}.`; }, 1.5],
  [(c) => T`Observe that ${rel(c)}, at least ${adverb(c)}.`, 1.8],
  [(c) => T`It is well known ${cite(c)} that ${rel(c)}.`, 1.5],
  [(c) => T`More generally, one may ${verb(c).base} any ${buzz(c)} ${obj(c)} provided ${rel(c)}.`, 1.3],
  [(c) => { const [a, b] = sym2(c); return T`Throughout, ${a} denotes ${an(buzz(c))} ${obj(c)} and ${b} its canonical ${obj(c)}.`; }, 1],
  [(c) => T`Surprisingly, the ${obj(c)} ${sym(c)} is ${buzz(c)}, though not ${adverb(c)} so.`, 1.2],
  [(c) => T`The study of ${buzz(c)} ${plural(obj(c))} goes back to the work of ${surname(c)} on ${buzz(c)} ${plural(obj(c))}.`, 1],
  [(c) => T`In particular, ${rel(c)}.`, 1.4],
  [(c) => T`Hence ${rel(c)}, and the analogous statement for ${buzz(c)} ${plural(obj(c))} follows ${adverb(c)}.`, 1.2],
  [(c) => T`On the other hand, ${rel(c)} whenever ${sym(c)} is ${buzz(c)}.`, 1.3],
  [(c) => T`By construction, ${rel(c)}.`, 1.2],
  [(c) => T`It follows from the definition of ${an(buzz(c))} ${obj(c)} that ${rel(c)}.`, 1.2],
  [(c) => T`A standard argument ${cite(c)} shows that every ${buzz(c)} ${obj(c)} ${iverb(c).third}.`, 1.3],
  [(c) => T`This was extended to the ${buzz(c)} setting in ${cite(c)}.`, 1.1],
  [(c) => T`It is not known whether ${rel(c)} in general.`, 1],
  [(c) => T`We write ${m(term(c.math, 1))} for the ${obj(c)} of ${sym(c)}, following ${cite(c)}.`, 1.1],
  [(c) => T`No ${buzz(c)} ${obj(c)} can ${verb(c).base} itself; this is ${c.rng.pick(["obvious", "an axiom", "folklore", "immediate from the definitions"])}.`, 0.8],
];

const PROVED_SENTENCES: [SGen, number][] = [
  [(c) => T`Combining ${provedRef(c)} with ${cite(c)} yields ${rel(c)}.`, 2],
  [(c) => T`By ${provedRef(c)}, we may assume that ${rel(c)}.`, 2],
  [(c) => T`Note that ${provedRef(c)} applies verbatim, since ${rel(c)}.`, 1.5],
  [(c) => T`In view of ${provedRef(c)}, ${rel(c)}.`, 1.5],
];

const EQ_SENTENCES: [SGen, number][] = [
  [(c) => T`Combining ${eqRef(c)} with ${cite(c)} yields ${rel(c)}.`, 2],
  [(c) => T`By ${eqRef(c)}, we have ${rel(c)}.`, 2],
  [(c) => T`Substituting into ${eqRef(c)} gives ${rel(c)}.`, 1.5],
];

export function sentence(c: Ctx): Runs {
  const r = c.rng;
  let pool = SENTENCES;
  if (c.proved.length > 0 && r.chance(0.18)) pool = PROVED_SENTENCES;
  else if (c.equations.length > 0 && r.chance(0.12)) pool = EQ_SENTENCES;
  return r.weighted(pool)(c);
}

/** A paragraph of 3 to 6 sentences, optionally followed by a display. */
export function paragraph(c: Ctx, opts: { display?: boolean } = {}): Block[] {
  const n = c.rng.range(3, 6);
  const runs = joinSentences(Array.from({ length: n }, () => sentence(c)));
  const blocks: Block[] = [{ k: "para", runs }];
  const wantDisplay = opts.display ?? c.rng.chance(0.45);
  if (wantDisplay) blocks.push(display(c));
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Theorem statements                                                  */
/* ------------------------------------------------------------------ */

export function statement(c: Ctx, kind: ResultKind): Runs {
  const r = c.rng;
  switch (kind) {
    case "Definition": {
      const variants: [() => Runs, number][] = [
        [() => T`${cap(an(buzz(c)))} ${obj(c)} is said to be ${emph(buzz(c))} if ${rel(c)}.`, 2],
        [() => T`The ${emph(`${buzz(c)} ${obj(c)}`)} of ${sym(c)} is the ${obj(c)} ${m(term(c.math, 1))}, provided this exists.`, 1.5],
        [() => T`We call ${sym(c)} ${emph(buzz(c))} whenever ${rel(c)}, and ${emph(`totally ${buzz(c)}`)} otherwise.`, 1],
      ];
      return r.weighted(variants)();
    }
    case "Conjecture":
      return r.weighted<() => Runs>([
        [() => T`Every ${buzz(c)} ${obj(c)} ${iverb(c).third} after finitely many steps.`, 1.5],
        [() => T`${cap(named(c))} holds for all ${buzz(c)} ${plural(obj(c))}.`, 1],
        [() => T`There are infinitely many ${buzz(c)} ${plural(obj(c))} ${sym(c)} with ${rel(c)}.`, 1.2],
      ])();
    case "Axiom":
    case "Postulate":
      return r.weighted<() => Runs>([
        [() => T`There is no ${buzz(c)} ${obj(c)}.`, 1],
        [() => T`${rel(c)}, always and without exception.`, 1.2],
        [() => T`Every ${obj(c)} is contained in ${an(buzz(c))} ${obj(c)}, which is itself ${buzz(c)}.`, 1],
      ])();
    case "Corollary":
      return r.weighted<() => Runs>([
        [() => T`${rel(c)}.`, 1.5],
        [() => T`${cap(named(c))} holds ${adverb(c)}.`, 1],
        [() => { const [p, q] = buzz2(c); return T`No ${obj(c)} is both ${p} and ${q}.`; }, 1],
      ])();
    case "Remark": {
      const variants: [() => Runs, number][] = [
        [() => c.proved.length > 0
          ? T`The converse of ${provedRef(c)} is false in general; see ${cite(c)}.`
          : T`The converse is false in general; see ${cite(c)}.`, 1.5],
        [() => T`The hypothesis that ${sym(c)} be ${buzz(c)} cannot be dropped, as the ${obj(c)} ${m(term(c.math, 1))} shows.`, 1.5],
        [() => T`It is not known whether ${rel(c)} in the ${buzz(c)} case.`, 1.2],
        [() => T`A similar argument applies to ${buzz(c)} ${plural(obj(c))}, with ${sym(c)} replaced by ${m(term(c.math, 1))}.`, 1.2],
      ];
      return r.weighted(variants)();
    }
    case "Example": {
      const x = sym(c);
      const variants: [() => Runs, number][] = [
        [() => { const [p, q] = buzz2(c); return T`Let ${x} = ${m(term(c.math, 2))}. Then ${x} is ${p} but not ${q}.`; }, 2],
        [() => T`Take ${x} to be the ${buzz(c)} ${obj(c)} of ${m(term(c.math, 1))}. Then ${rel(c)}, so ${x} fails to be ${buzz(c)}.`, 1.5],
        [() => T`The ${obj(c)} ${m(term(c.math, 1))} is ${buzz(c)}; however, it does not satisfy ${named(c)}.`, 1.2],
      ];
      return r.weighted(variants)();
    }
    default: {
      // Theorem, Lemma, Proposition
      const variants: [() => Runs, number][] = [
        [() => T`Let ${sym(c)} be ${an(buzz(c))} ${obj(c)}. Then ${rel(c)}.`, 2.5],
        [() => { const [p, q] = buzz2(c); return T`Every ${p} ${obj(c)} is ${q}, and moreover ${rel(c)}.`; }, 2],
        [() => { const [x, y] = sym2(c); return T`For every ${buzz(c)} ${obj(c)} ${x} there exists a unique ${buzz(c)} ${obj(c)} ${y} such that ${rel(c)}.`; }, 2],
        [() => T`If ${rel(c)}, then ${rel(c)}.`, 2],
        [() => { const x = sym(c); return T`Suppose ${x} ${verb(c).third} ${an(buzz(c))} ${obj(c)}. Then ${x} is ${buzz(c)} if and only if ${rel(c)}.`; }, 1.5],
        [() => { const x = sym(c); return T`Assume ${rel(c)}. Then ${rel(c)}, and equality holds if and only if ${x} is ${buzz(c)}.`; }, 1.5],
      ];
      return r.weighted(variants)();
    }
  }
}

/** The main theorem's statement, echoing the title. */
export function mainStatement(c: Ctx): Runs {
  const { buzz: b, obj: o } = c.theme;
  const x = sym(c);
  const variants: [() => Runs, number][] = [
    [() => T`Let ${x} be ${an(b)} ${o}. Then ${named(c)} holds for ${x}; in particular, ${rel(c)}.`, 2],
    [() => T`Every ${b} ${o} ${iverb(c).third}. Moreover, ${rel(c)}.`, 2],
    [() => T`${cap(c.named[0])} holds for every ${b} ${o}.`, 1.5],
  ];
  return c.rng.weighted(variants)();
}

/* ------------------------------------------------------------------ */
/* Proofs                                                              */
/* ------------------------------------------------------------------ */

const PROOF_OPENERS: [SGen, number][] = [
  [(c) => T`Without loss of generality, ${rel(c)}, since ${sym(c)} may be ${verb(c).past} ${adverb(c)}.`, 2],
  [(c) => T`We proceed by induction on ${sym(c)}, the base case being ${adverb(c)} vacuous.`, 2],
  [(c) => T`Suppose toward contradiction that ${rel(c)}.`, 1.5],
  [(c) => T`Fix ${an(buzz(c))} ${obj(c)} ${sym(c)} and let ${m(term(c.math, 1))} denote its ${buzz(c)} ${obj(c)}.`, 2],
  [(c) => T`By Zorn's lemma, ${rel(c)}.`, 1.2],
  [(c) => T`Passing to a subsequence if necessary, we may assume ${rel(c)}.`, 1.2],
  [(c) => T`We first treat the case in which ${sym(c)} is ${buzz(c)}.`, 1.3],
];

function closer(c: Ctx): Runs {
  const r = c.rng;
  if (r.chance(0.18)) return T`See ${cite(c)} for a related argument.`;
  if (r.chance(0.22)) return T`The remaining details are a routine exercise in ${r.pick(FIELDS)}.`;
  return [t(r.pick(CLOSERS))];
}

export function proof(c: Ctx, opts: { deep?: boolean } = {}): Block[] {
  const r = c.rng;
  const deep = opts.deep ?? r.chance(0.3);
  const blocks: Block[] = [];
  const opener = r.weighted(PROOF_OPENERS)(c);
  const mid = () => joinSentences([sentence(c), ...(r.chance(0.4) ? [sentence(c)] : [])]);

  const shape = r.weighted([
    ["chain", 3], ["cases", 1.6], ["induction", deep ? 2 : 1],
  ] as const);

  if (shape === "induction") {
    blocks.push({
      k: "para",
      runs: joinSentences([T`We proceed by induction on ${sym(c)}.`, T`For the base case, ${rel(c)}, so that`]),
    });
    blocks.push(display(c));
    blocks.push({
      k: "para",
      runs: joinSentences([T`For the inductive step, assume ${rel(c)}.`, mid(), T`It follows that`]),
    });
    blocks.push(display(c));
    if (deep || r.chance(0.5)) {
      blocks.push({ k: "para", runs: joinSentences([sentence(c), T`Consequently,`]) });
      blocks.push(display(c));
    }
    blocks.push({ k: "para", runs: joinSentences([T`This closes the induction.`, closer(c)]) });
    return blocks;
  }

  if (shape === "cases") {
    const three = deep && r.chance(0.5);
    blocks.push({
      k: "para",
      runs: joinSentences([opener, three ? T`We distinguish three cases.` : T`We distinguish two cases.`]),
    });
    blocks.push({ k: "para", runs: T`${emph("Case 1.")} Here ${rel(c)}, so that` });
    blocks.push(display(c));
    if (three) {
      blocks.push({ k: "para", runs: T`${emph("Case 2.")} Suppose instead that ${rel(c)}. Then` });
      blocks.push(display(c));
    }
    blocks.push({ k: "para", runs: T`${emph(three ? "Case 3." : "Case 2.")} Otherwise ${rel(c)}, and` });
    blocks.push(display(c));
    blocks.push({ k: "para", runs: joinSentences([T`In each case the claim follows.`, closer(c)]) });
    return blocks;
  }

  blocks.push({ k: "para", runs: joinSentences([opener, mid(), T`It follows that`]) });
  blocks.push(display(c));
  blocks.push({ k: "para", runs: joinSentences([sentence(c), T`Combining this with ${cite(c)}, we obtain`]) });
  blocks.push(display(c));
  if (deep || r.chance(0.45)) {
    blocks.push({ k: "para", runs: joinSentences([sentence(c), T`Consequently,`]) });
    blocks.push(display(c));
  }
  if (r.chance(0.25)) {
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
  return joinSentences([
    T`In ${c.field}, ${c.named[0]} for ${b} ${plural(o)} has long been considered ${v.able}${c.rng.chance(0.5) ? ", if not " + adverb(c) + " so" : ""}.`,
    T`The purpose of the present paper is to ${v.base} it ${adverb(c)}.`,
    sentence(c),
  ]);
}

/** A literature-review paragraph for the introduction. */
export function literature(c: Ctx): Runs {
  const sentences = [
    T`The systematic study of ${buzz(c)} ${plural(obj(c))} began with the ${c.rng.pick(GLAZE)} memoir of ${surname(c)} ${cite(c)}.`,
    T`Further progress was made in ${cite(c)}, where ${named(c)} was established for ${buzz(c)} ${plural(obj(c))}.`,
    sentence(c),
    T`For general background on ${c.field}, we refer the reader to ${cite(c)}.`,
  ];
  return joinSentences(sentences);
}

/** A run-in notation paragraph for the preliminaries. */
export function notation(c: Ctx): Runs {
  const [a, b] = sym2(c);
  const sentences = [
    T`${emph("Notation.")} Throughout, ${a} denotes ${an(buzz(c))} ${obj(c)} and ${b} its canonical ${obj(c)}.`,
    T`We write ${m(term(c.math, 1))} for the ${obj(c)} associated to ${sym(c)}.`,
    T`All ${plural(obj(c))} are assumed ${buzz(c)} unless stated otherwise.`,
    T`We use ${cite(c)} as a general reference for ${c.field}.`,
  ];
  return joinSentences(sentences);
}

export function abstractRuns(c: Ctx): Runs {
  const r = c.rng;
  const year = r.range(1995, 2024);
  const pool: Runs[] = [
    T`Our main result shows that ${rel(c)}, ${r.pick(["improving on", "sharpening", "extending"])} a bound of ${surname(c)} (${String(year)}).`,
    T`As an application, we obtain ${an(buzz(c))} ${obj(c)} that ${iverb(c).third}.`,
    T`The proof combines techniques from ${r.pick(FIELDS)} with ${buzz(c)} methods from ${r.pick(FIELDS)}.`,
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
  return joinSentences([
    T`We have ${v.past} ${c.named[0]} for every ${b} ${o}.`,
    sentence(c),
    sentence(c),
    T`Whether the ${buzz(c)} case admits a similar treatment remains open.`,
    T`We hope to return to this question in future work.`,
  ]);
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

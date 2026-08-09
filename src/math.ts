/**
 * Math expression AST. Expressions are generated from a seeded Rng and
 * rendered to LaTeX (KaTeX-compatible, amsmath-compatible) or Unicode text.
 */
import type { Rng } from "./rng.js";

export interface Sym {
  latex: string;
  text: string;
}

export interface OpSpec {
  latex: string;
  text: string;
  /** 2 binds tighter than 1; relations are 0. */
  prec: number;
}

export interface FnSpec {
  latex: string;
  text: string;
  /** Number of arguments; 1 if omitted. */
  arity?: 2;
  /** May carry a numeric superscript between name and arguments, as in Ext^1. */
  sup?: boolean;
}

export type Deco = "bar" | "hat" | "tilde" | "star" | "prime" | "inv";
export type Quant = "forall" | "exists" | "nexists" | "existsu";
export type BigOp = "sum" | "prod" | "int" | "bigcup" | "bigoplus" | "bigotimes";

export type Expr =
  | { k: "sym"; s: Sym }
  | { k: "num"; v: number }
  | { k: "bin"; op: OpSpec; l: Expr; r: Expr }
  | { k: "rel"; ops: OpSpec[]; parts: Expr[] }
  | { k: "call"; fn: FnSpec; inv?: boolean; sup?: number; arg: Expr }
  | { k: "frac"; num: Expr; den: Expr }
  | { k: "pow"; base: Expr; e: Expr }
  | { k: "idx"; base: Expr; i: Expr }
  | { k: "sqrt"; body: Expr }
  | { k: "abs"; body: Expr }
  | { k: "norm"; body: Expr }
  | { k: "deco"; d: Deco; body: Expr }
  | { k: "set"; elems: Expr[]; etc?: boolean }
  | { k: "setb"; v: Expr; dom?: Expr; pred: Expr }
  | { k: "tuple"; elems: Expr[] }
  | { k: "quant"; q: Quant; v: Expr; dom?: Expr; body: Expr }
  | { k: "big"; op: BigOp; lo?: Expr; hi?: Expr; body: Expr; dv?: Expr }
  | { k: "lim"; v: Expr; to: Expr; body: Expr }
  | { k: "cases"; arms: { e: Expr; cond: Expr | null }[] }
  | { k: "mat"; rows: Expr[][] }
  | { k: "typing"; f: Expr; from: Expr; to: Expr };

/* ------------------------------------------------------------------ */
/* Symbol and operator tables                                          */
/* ------------------------------------------------------------------ */

const sym = (latex: string, text: string): Sym => ({ latex, text });

// e, i, j, l, o are excluded: they collide with constants and indices.
export const LATIN: Sym[] = [..."abcdfghkmnpqrstuvwxyz"].map((c) => sym(c, c));

// pi is excluded from bound-variable use by the palette builder; it remains
// available as an object symbol (projections, permutations).
export const GREEK_LOWER: Sym[] = [
  sym("\\alpha", "α"), sym("\\beta", "β"), sym("\\gamma", "γ"),
  sym("\\delta", "δ"), sym("\\varepsilon", "ε"), sym("\\zeta", "ζ"),
  sym("\\eta", "η"), sym("\\theta", "θ"), sym("\\kappa", "κ"),
  sym("\\lambda", "λ"), sym("\\mu", "μ"), sym("\\nu", "ν"), sym("\\xi", "ξ"),
  sym("\\pi", "π"), sym("\\rho", "ρ"), sym("\\sigma", "σ"), sym("\\tau", "τ"),
  sym("\\varphi", "φ"), sym("\\chi", "χ"), sym("\\psi", "ψ"), sym("\\omega", "ω"),
];

export const GREEK_UPPER: Sym[] = [
  sym("\\Gamma", "Γ"), sym("\\Delta", "Δ"), sym("\\Theta", "Θ"),
  sym("\\Lambda", "Λ"), sym("\\Xi", "Ξ"), sym("\\Phi", "Φ"),
  sym("\\Psi", "Ψ"), sym("\\Omega", "Ω"),
];

export const GREEK: Sym[] = [...GREEK_LOWER, ...GREEK_UPPER];

export const FANCY: Sym[] = [
  sym("\\mathcal{A}", "𝒜"), sym("\\mathcal{F}", "ℱ"), sym("\\mathcal{L}", "ℒ"),
  sym("\\mathcal{M}", "ℳ"), sym("\\mathcal{O}", "𝒪"), sym("\\mathcal{T}", "𝒯"),
  sym("\\mathbb{R}", "ℝ"), sym("\\mathbb{Z}", "ℤ"), sym("\\mathbb{Q}", "ℚ"),
  sym("\\mathbb{C}", "ℂ"), sym("\\mathbb{N}", "ℕ"), sym("\\mathbb{F}", "𝔽"),
  sym("\\mathfrak{g}", "𝔤"), sym("\\mathfrak{m}", "𝔪"), sym("\\mathfrak{p}", "𝔭"),
  sym("\\mathfrak{A}", "𝔄"), sym("\\mathfrak{S}", "𝔖"),
];

export const CONSTANTS: Sym[] = [
  sym("\\aleph_0", "ℵ₀"), sym("\\varnothing", "∅"), sym("\\infty", "∞"),
  sym("\\hbar", "ℏ"), sym("0", "0"), sym("1", "1"),
];

const INFTY: Sym = sym("\\infty", "∞");
const ZERO: Expr = { k: "num", v: 0 };

export const ALL_SYMS: Sym[] = [...LATIN, ...GREEK, ...FANCY];

const op = (latex: string, text: string, prec: number): OpSpec => ({ latex, text, prec });

export const OPS: OpSpec[] = [
  op("+", "+", 1), op("-", "−", 1), op("\\times", "×", 2),
  op("\\otimes", "⊗", 2), op("\\oplus", "⊕", 1), op("\\cup", "∪", 1),
  op("\\cap", "∩", 2), op("\\setminus", "∖", 1), op("\\circ", "∘", 2),
  op("\\cdot", "⋅", 2), op("\\wedge", "∧", 2), op("\\vee", "∨", 1),
  op("\\ast", "∗", 2),
];

export const EQ: OpSpec = op("=", "=", 0);
export const IN: OpSpec = op("\\in", "∈", 0);
export const TO: OpSpec = op("\\to", "→", 0);

export const RELS: OpSpec[] = [
  EQ, op("\\ne", "≠", 0), op("\\le", "≤", 0), op("\\ge", "≥", 0),
  op("<", "<", 0), op("\\equiv", "≡", 0), op("\\cong", "≅", 0),
  op("\\simeq", "≃", 0), op("\\sim", "∼", 0), op("\\approx", "≈", 0),
  op("\\subseteq", "⊆", 0), op("\\supseteq", "⊇", 0), IN,
  op("\\notin", "∉", 0), op("\\mid", "∣", 0), op("\\perp", "⊥", 0),
  op("\\prec", "≺", 0), op("\\succeq", "⪰", 0), op("\\models", "⊨", 0),
  op("\\vdash", "⊢", 0), op("\\mapsto", "↦", 0), TO,
  op("\\Rightarrow", "⇒", 0), op("\\Leftrightarrow", "⇔", 0),
  op("\\rightsquigarrow", "⇝", 0), op("\\hookrightarrow", "↪", 0),
  op("\\twoheadrightarrow", "↠", 0),
];

const fn = (latex: string, text: string, opts: { arity?: 2; sup?: boolean } = {}): FnSpec => ({
  latex, text, ...opts,
});

export const FNS: FnSpec[] = [
  fn("\\sin", "sin"), fn("\\cos", "cos"), fn("\\tan", "tan"),
  fn("\\log", "log"), fn("\\ln", "ln"), fn("\\exp", "exp"),
  fn("\\det", "det"), fn("\\deg", "deg"), fn("\\dim", "dim"),
  fn("\\ker", "ker"), fn("\\gcd", "gcd", { arity: 2 }),
  fn("\\operatorname{tr}", "tr"), fn("\\operatorname{rank}", "rank"),
  fn("\\operatorname{sgn}", "sgn"), fn("\\operatorname{Spec}", "Spec"),
  fn("\\operatorname{Gal}", "Gal"), fn("\\operatorname{Hom}", "Hom", { arity: 2 }),
  fn("\\operatorname{Ext}", "Ext", { arity: 2, sup: true }),
  fn("\\operatorname{Tor}", "Tor", { arity: 2, sup: true }),
  fn("\\operatorname{Res}", "Res"), fn("\\operatorname{Sym}", "Sym"),
  fn("\\operatorname{Aut}", "Aut"), fn("\\operatorname{End}", "End"),
  fn("\\operatorname{Fix}", "Fix"), fn("\\operatorname{colim}", "colim"),
  fn("\\operatorname{Zonc}", "Zonc"),
];

/* ------------------------------------------------------------------ */
/* Random generation                                                   */
/* ------------------------------------------------------------------ */

export interface MathCtx {
  rng: Rng;
  /** The paper's working symbols, reused so notation stays consistent. */
  palette: Sym[];
  /** Letter symbols for bound and index variables. */
  scalars: Sym[];
}

function leaf(c: MathCtx): Expr {
  const r = c.rng;
  if (r.chance(0.07)) return { k: "num", v: r.range(0, 9) };
  if (r.chance(0.06)) return { k: "sym", s: r.pick(CONSTANTS) };
  if (r.chance(0.85)) return { k: "sym", s: r.pick(c.palette) };
  return { k: "sym", s: r.pick(ALL_SYMS) };
}

function paletteSym(c: MathCtx): Expr {
  return { k: "sym", s: c.rng.pick(c.palette) };
}

function scalarSym(c: MathCtx): Expr {
  return { k: "sym", s: c.rng.pick(c.scalars) };
}

function fancySym(c: MathCtx): Expr {
  return { k: "sym", s: c.rng.pick(FANCY) };
}

/** A bare symbol from the paper's palette, for prose slots. */
export function pureSym(c: MathCtx): Expr {
  return paletteSym(c);
}

/** n distinct palette symbols. */
export function distinctSyms(c: MathCtx, n: number): Expr[] {
  return c.rng.sample(c.palette, n).map((s) => ({ k: "sym", s }));
}

/** Generate with gen(), rerolling while pred rejects, at most `tries` times. */
function reroll(gen: () => Expr, pred: (e: Expr) => boolean, tries = 4): Expr {
  let e = gen();
  for (let i = 0; i < tries && !pred(e); i++) e = gen();
  return e;
}

const notTupleOrSet = (e: Expr) => e.k !== "tuple" && e.k !== "set";

function powExponent(c: MathCtx): Expr {
  const r = c.rng;
  if (r.chance(0.55)) return { k: "num", v: r.range(2, 3) };
  if (r.chance(0.2)) return { k: "num", v: -1 };
  return scalarSym(c);
}

function callArg(c: MathCtx, f: FnSpec, depth: number): Expr {
  if (f.arity === 2) {
    const a = term(c, Math.min(depth, 1));
    const b = reroll(
      () => term(c, Math.min(depth, 1)),
      (e) => toText(e) !== toText(a),
    );
    return { k: "tuple", elems: [a, b] };
  }
  return reroll(() => term(c, depth), notTupleOrSet);
}

function makeCall(c: MathCtx, depth: number): Expr {
  const r = c.rng;
  const f = r.pick(FNS);
  return {
    k: "call",
    fn: f,
    inv: !f.arity && r.chance(0.12),
    sup: f.sup && r.chance(0.6) ? r.range(1, 2) : undefined,
    arg: callArg(c, f, depth - 1),
  };
}

export function term(c: MathCtx, depth: number): Expr {
  const r = c.rng;
  if (depth <= 0) return leaf(c);
  const gens: [() => Expr, number][] = [
    [() => leaf(c), 2.6],
    [() => {
      const l = term(c, depth - 1);
      const right = reroll(() => term(c, depth - 1), (e) => toText(e) !== toText(l));
      return { k: "bin", op: r.pick(OPS), l, r: right };
    }, 2.2],
    [() => makeCall(c, depth), 1.6],
    [() => {
      const num = reroll(() => term(c, depth - 1), notTupleOrSet);
      const den = reroll(
        () => term(c, depth - 1),
        (e) => notTupleOrSet(e) && toText(e) !== toText(num),
      );
      return { k: "frac", num, den };
    }, 1.0],
    [() => ({ k: "pow", base: leaf(c), e: powExponent(c) }), 1.2],
    [() => {
      const base = paletteSym(c);
      const baseText = toText(base);
      const i = r.chance(0.45)
        ? ({ k: "num", v: r.range(0, 9) } as Expr)
        : reroll(() => scalarSym(c), (e) => toText(e) !== baseText);
      return { k: "idx", base, i };
    }, 1.2],
    [() => ({ k: "deco", d: r.pick(["bar", "hat", "tilde", "star", "prime", "inv"] as const), body: paletteSym(c) }), 0.9],
    [() => ({ k: "sqrt", body: reroll(() => term(c, depth - 1), notTupleOrSet) }), 0.5],
    [() => ({ k: "abs", body: reroll(() => term(c, depth - 1), notTupleOrSet) }), 0.6],
    [() => ({ k: "norm", body: term(c, depth - 1) }), 0.4],
    [() => {
      const a = term(c, depth - 1);
      const b = reroll(() => term(c, depth - 1), (e) => toText(e) !== toText(a));
      return { k: "tuple", elems: [a, b] };
    }, 0.4],
    [() => {
      const a = leaf(c);
      const b = reroll(() => leaf(c), (e) => toText(e) !== toText(a));
      return { k: "set", elems: [a, b], etc: r.chance(0.5) };
    }, 0.35],
  ];
  return r.weighted(gens)();
}

function relChain(c: MathCtx, depth: number, parts?: number): Expr {
  const r = c.rng;
  const n = parts ?? (r.chance(0.8) ? 2 : 3);
  const pickRel = () => (r.chance(0.35) ? EQ : r.pick(RELS));
  const exprs: Expr[] = [term(c, depth)];
  for (let i = 1; i < n; i++) {
    const prev = toText(exprs[i - 1]);
    exprs.push(reroll(() => term(c, depth), (e) => toText(e) !== prev));
  }
  return {
    k: "rel",
    ops: Array.from({ length: n - 1 }, pickRel),
    parts: exprs,
  };
}

/** A term guaranteed to mention the bound variable v. */
function bodyWith(c: MathCtx, v: Expr): Expr {
  const r = c.rng;
  const vText = toText(v);
  const gens: [() => Expr, number][] = [
    [() => ({ k: "idx", base: reroll(() => paletteSym(c), (e) => toText(e) !== vText), i: v }), 2],
    [() => ({ k: "bin", op: r.pick(OPS), l: reroll(() => term(c, 1), (e) => !toText(e).includes(vText)), r: v }), 2],
    [() => ({ k: "call", fn: r.pick(FNS.filter((f) => !f.arity)), arg: v }), 1.5],
    [() => ({ k: "pow", base: v, e: { k: "num", v: r.range(2, 3) } }), 1],
    [() => ({ k: "frac", num: v, den: reroll(() => term(c, 1), (e) => notTupleOrSet(e) && toText(e) !== toText(v)) }), 1],
  ];
  return r.weighted(gens)();
}

/** A free-standing mathematical claim. */
export function relation(c: MathCtx): Expr {
  const r = c.rng;
  const gens: [() => Expr, number][] = [
    [() => relChain(c, 2), 4.0],
    [() => {
      const v = scalarSym(c);
      return {
        k: "quant", q: r.pick(["forall", "exists", "existsu", "nexists"] as const),
        v, dom: r.chance(0.6) ? fancySym(c) : undefined,
        body: { k: "rel", ops: [r.chance(0.5) ? EQ : r.pick(RELS)], parts: [bodyWith(c, v), term(c, 1)] },
      };
    }, 1.4],
    [() => ({ k: "typing", f: paletteSym(c), from: fancySym(c), to: fancySym(c) }), 1.0],
    [() => {
      const v = scalarSym(c);
      return {
        k: "rel", ops: [IN],
        parts: [term(c, 1), { k: "setb", v, dom: r.chance(0.5) ? fancySym(c) : undefined, pred: { k: "rel", ops: [r.pick(RELS)], parts: [bodyWith(c, v), term(c, 1)] } }],
      };
    }, 1.0],
    [() => {
      const { e, vText } = bigOpV(c);
      return { k: "rel", ops: [EQ], parts: [e, reroll(() => term(c, 1), (x) => !toText(x).includes(vText))] };
    }, 1.0],
    [() => {
      const v = scalarSym(c);
      const vText = toText(v);
      return {
        k: "rel", ops: [EQ],
        parts: [
          { k: "lim", v, to: { k: "sym", s: INFTY }, body: bodyWith(c, v) },
          reroll(() => term(c, 1), (x) => !toText(x).includes(vText)),
        ],
      };
    }, 0.7],
  ];
  return r.weighted(gens)();
}

function bigOp(c: MathCtx): Expr {
  return bigOpV(c).e;
}

/** A big operator together with its bound variable's text, so callers can
 * keep the bound variable out of expressions beyond its scope. */
function bigOpV(c: MathCtx): { e: Expr; vText: string } {
  const r = c.rng;
  const which = r.pick(["sum", "prod", "int", "bigcup", "bigoplus", "bigotimes"] as const);
  // Exclude d as the variable of integration so the output never reads "dd".
  const dvPool = c.scalars.filter((s) => s.text !== "d");
  const v: Expr =
    which === "int"
      ? { k: "sym", s: r.pick(dvPool.length ? dvPool : c.scalars) }
      : scalarSym(c);
  const vText = v.k === "sym" ? v.s.text : "";
  if (which === "int") {
    return {
      vText,
      e: {
        k: "big", op: which,
        lo: r.chance(0.7) ? ZERO : scalarSym(c),
        hi: { k: "sym", s: INFTY },
        body: bodyWith(c, v),
        dv: v,
      },
    };
  }
  // Keep the upper bound distinct from the bound variable.
  const hiPool = c.scalars.filter((s) => s.text !== vText);
  return {
    vText,
    e: {
      k: "big", op: which,
      lo: { k: "rel", ops: [EQ], parts: [v, { k: "num", v: r.range(0, 1) }] },
      hi: r.chance(0.7)
        ? { k: "sym", s: r.pick(hiPool.length ? hiPool : c.scalars) }
        : { k: "sym", s: INFTY },
      body: bodyWith(c, v),
    },
  };
}

/** 0 -> A -> B -> C -> 0 */
function exactSequence(c: MathCtx): Expr {
  const mid = distinctSyms(c, 3);
  return {
    k: "rel",
    ops: [TO, TO, TO, TO],
    parts: [ZERO, ...mid, ZERO],
  };
}

/** A larger expression for display equations. */
export function displayExpr(c: MathCtx): Expr {
  const r = c.rng;
  const gens: [() => Expr, number][] = [
    [() => {
      const { e, vText } = bigOpV(c);
      return { k: "rel", ops: [EQ], parts: [e, reroll(() => term(c, 2), (x) => !toText(x).includes(vText))] };
    }, 3.0],
    [() => relChain(c, 2, 3), 2.2],
    [() => exactSequence(c), 1.0],
    [() => ({
      k: "rel", ops: [EQ],
      parts: [paletteSym(c), {
        k: "cases",
        arms: [
          { e: term(c, 1), cond: relChain(c, 1) },
          { e: term(c, 1), cond: r.chance(0.5) ? relChain(c, 1) : null },
        ],
      }],
    }), 1.2],
    [() => ({
      k: "rel", ops: [EQ],
      parts: [
        { k: "deco", d: "hat", body: paletteSym(c) },
        { k: "mat", rows: [[leaf(c), term(c, 1)], [term(c, 1), leaf(c)]] },
      ],
    }), 1.0],
    [() => {
      const v = scalarSym(c);
      const vText = toText(v);
      return {
        k: "rel", ops: [EQ],
        parts: [
          { k: "lim", v, to: { k: "sym", s: INFTY }, body: { k: "frac", num: bodyWith(c, v), den: reroll(() => term(c, 1), notTupleOrSet) } },
          reroll(() => term(c, 2), (x) => !toText(x).includes(vText)),
        ],
      };
    }, 1.2],
    [() => {
      const v = scalarSym(c);
      return {
        k: "quant", q: "forall", v, dom: fancySym(c),
        body: { k: "rel", ops: [r.chance(0.5) ? EQ : r.pick(RELS)], parts: [bodyWith(c, v), term(c, 1)] },
      };
    }, 1.0],
  ];
  return r.weighted(gens)();
}

/* ------------------------------------------------------------------ */
/* LaTeX rendering                                                     */
/* ------------------------------------------------------------------ */

const QUANT_LATEX: Record<Quant, string> = {
  forall: "\\forall", exists: "\\exists", nexists: "\\nexists", existsu: "\\exists!",
};
const QUANT_TEXT: Record<Quant, string> = {
  forall: "∀", exists: "∃", nexists: "∄", existsu: "∃!",
};
const BIG_LATEX: Record<BigOp, string> = {
  sum: "\\sum", prod: "\\prod", int: "\\int", bigcup: "\\bigcup",
  bigoplus: "\\bigoplus", bigotimes: "\\bigotimes",
};
const BIG_TEXT: Record<BigOp, string> = {
  sum: "∑", prod: "∏", int: "∫", bigcup: "⋃", bigoplus: "⨁", bigotimes: "⨂",
};

function parenLatex(e: Expr, parent: OpSpec): string {
  const s = toLatex(e);
  return e.k === "bin" && e.op.prec < parent.prec ? `( ${s} )` : s;
}

export function toLatex(e: Expr): string {
  switch (e.k) {
    case "sym": return e.s.latex;
    case "num": return e.v < 0 ? `-${-e.v}` : String(e.v);
    case "bin": return `${parenLatex(e.l, e.op)} ${e.op.latex} ${parenLatex(e.r, e.op)}`;
    case "rel": return e.parts.map(toLatex).reduce((acc, p, i) => (i === 0 ? p : `${acc} ${e.ops[i - 1].latex} ${p}`), "");
    case "call": {
      const script = e.inv ? "^{-1}" : e.sup !== undefined ? `^{${e.sup}}` : "";
      // Tuple arguments supply their own parentheses.
      const arg = e.arg.k === "tuple"
        ? `\\left( ${e.arg.elems.map(toLatex).join(", ")} \\right)`
        : `\\left( ${toLatex(e.arg)} \\right)`;
      return `${e.fn.latex}${script}${arg}`;
    }
    case "frac": return `\\frac{${toLatex(e.num)}}{${toLatex(e.den)}}`;
    case "pow": {
      const base = e.base.k === "bin" || e.base.k === "frac" ? `\\left( ${toLatex(e.base)} \\right)` : toLatex(e.base);
      return `${base}^{${toLatex(e.e)}}`;
    }
    case "idx": return `${toLatex(e.base)}_{${toLatex(e.i)}}`;
    case "sqrt": return `\\sqrt{${toLatex(e.body)}}`;
    case "abs": return `\\left| ${toLatex(e.body)} \\right|`;
    case "norm": return `\\left\\| ${toLatex(e.body)} \\right\\|`;
    case "deco": {
      const b = toLatex(e.body);
      switch (e.d) {
        case "bar": return `\\overline{${b}}`;
        case "hat": return `\\hat{${b}}`;
        case "tilde": return `\\tilde{${b}}`;
        case "star": return `${b}^{*}`;
        case "prime": return `${b}'`;
        case "inv": return `${b}^{-1}`;
      }
      break;
    }
    case "set": return `\\left\\{ ${e.elems.map(toLatex).join(", ")}${e.etc ? ", \\dots" : ""} \\right\\}`;
    case "setb": return `\\left\\{ ${toLatex(e.v)}${e.dom ? ` \\in ${toLatex(e.dom)}` : ""} : ${toLatex(e.pred)} \\right\\}`;
    case "tuple": return `\\left( ${e.elems.map(toLatex).join(", ")} \\right)`;
    case "quant": return `${QUANT_LATEX[e.q]} ${toLatex(e.v)}${e.dom ? ` \\in ${toLatex(e.dom)}` : ""} ,\\; ${toLatex(e.body)}`;
    case "big": {
      const lo = e.lo ? `_{${toLatex(e.lo)}}` : "";
      const hi = e.hi ? `^{${toLatex(e.hi)}}` : "";
      const dv = e.dv ? ` \\, d${toLatex(e.dv)}` : "";
      return `${BIG_LATEX[e.op]}${lo}${hi} ${toLatex(e.body)}${dv}`;
    }
    case "lim": return `\\lim_{${toLatex(e.v)} \\to ${toLatex(e.to)}} ${toLatex(e.body)}`;
    case "cases":
      return `\\begin{cases} ${e.arms
        .map((a) => `${toLatex(a.e)} & ${a.cond ? `\\text{if } ${toLatex(a.cond)}` : "\\text{otherwise}"}`)
        .join(" \\\\ ")} \\end{cases}`;
    case "mat":
      return `\\begin{pmatrix} ${e.rows.map((row) => row.map(toLatex).join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
    case "typing": return `${toLatex(e.f)} \\colon ${toLatex(e.from)} \\to ${toLatex(e.to)}`;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Unicode (plain text) rendering                                      */
/* ------------------------------------------------------------------ */

const SUP_DIGITS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
  "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};
const SUB_DIGITS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
  "7": "₇", "8": "₈", "9": "₉",
};

function supNum(n: number): string {
  return String(n).split("").map((c) => SUP_DIGITS[c] ?? c).join("");
}

function isSimple(e: Expr): boolean {
  return e.k === "sym" || e.k === "num";
}

function parenText(e: Expr, parent: OpSpec): string {
  const s = toText(e);
  return e.k === "bin" && e.op.prec < parent.prec ? `(${s})` : s;
}

/** Wrap in parentheses unless the string is already fully parenthesized. */
function wrapParen(s: string): string {
  if (s.startsWith("(") && s.endsWith(")")) {
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") d++;
      else if (s[i] === ")") {
        d--;
        if (d === 0) return i === s.length - 1 ? s : `(${s})`;
      }
    }
  }
  return `(${s})`;
}

const DECO_COMBINING: Record<Deco, string> = {
  bar: "̄", hat: "̂", tilde: "̃", star: "", prime: "", inv: "",
};

export function toText(e: Expr): string {
  switch (e.k) {
    case "sym": return e.s.text;
    case "num": return String(e.v);
    case "bin": return `${parenText(e.l, e.op)} ${e.op.text} ${parenText(e.r, e.op)}`;
    case "rel": return e.parts.map(toText).reduce((acc, p, i) => (i === 0 ? p : `${acc} ${e.ops[i - 1].text} ${p}`), "");
    case "call": {
      const script = e.inv ? "⁻¹" : e.sup !== undefined ? supNum(e.sup) : "";
      const arg = e.arg.k === "tuple"
        ? `(${e.arg.elems.map(toText).join(", ")})`
        : `(${toText(e.arg)})`;
      return `${e.fn.text}${script}${arg}`;
    }
    case "frac": {
      const n = toText(e.num);
      const d = toText(e.den);
      if (isSimple(e.num) && isSimple(e.den)) return `${n}/${d}`;
      return `${wrapParen(n)}/${wrapParen(d)}`;
    }
    case "pow": {
      const base = isSimple(e.base) || e.base.k === "call" ? toText(e.base) : `(${toText(e.base)})`;
      if (e.e.k === "num") return `${base}${supNum(e.e.v)}`;
      return `${base}^${isSimple(e.e) ? toText(e.e) : `(${toText(e.e)})`}`;
    }
    case "idx": {
      if (e.i.k === "num") return `${toText(e.base)}${String(e.i.v).split("").map((c) => SUB_DIGITS[c] ?? c).join("")}`;
      return `${toText(e.base)}_${isSimple(e.i) ? toText(e.i) : `(${toText(e.i)})`}`;
    }
    case "sqrt": return `√(${toText(e.body)})`;
    case "abs": return `|${toText(e.body)}|`;
    case "norm": return `‖${toText(e.body)}‖`;
    case "deco": {
      const b = toText(e.body);
      switch (e.d) {
        case "star": return `${b}*`;
        case "prime": return `${b}′`;
        case "inv": return `${b}⁻¹`;
        default: return b + DECO_COMBINING[e.d];
      }
    }
    case "set": return `{${e.elems.map(toText).join(", ")}${e.etc ? ", …" : ""}}`;
    case "setb": return `{ ${toText(e.v)}${e.dom ? ` ∈ ${toText(e.dom)}` : ""} : ${toText(e.pred)} }`;
    case "tuple": return `(${e.elems.map(toText).join(", ")})`;
    case "quant": return `${QUANT_TEXT[e.q]}${toText(e.v)}${e.dom ? ` ∈ ${toText(e.dom)}` : ""}. ${toText(e.body)}`;
    case "big": {
      const lo = e.lo ? `_{${toText(e.lo)}}` : "";
      const hi = e.hi ? `^{${toText(e.hi)}}` : "";
      const dv = e.dv ? ` d${toText(e.dv)}` : "";
      return `${BIG_TEXT[e.op]}${lo}${hi} ${toText(e.body)}${dv}`;
    }
    case "lim": return `lim_{${toText(e.v)} → ${toText(e.to)}} ${toText(e.body)}`;
    case "cases":
      return `{ ${e.arms.map((a) => `${toText(a.e)} ${a.cond ? `if ${toText(a.cond)}` : "otherwise"}`).join("; ")} }`;
    case "mat": return `[ ${e.rows.map((row) => row.map(toText).join("  ")).join(" ; ")} ]`;
    case "typing": return `${toText(e.f)} : ${toText(e.from)} → ${toText(e.to)}`;
  }
  return "";
}

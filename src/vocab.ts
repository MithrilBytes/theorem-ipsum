/**
 * Word lists. Mostly real mathematical vocabulary; a few invented names are
 * kept from sylvanfranklin/nonsense (Nozzle, Snaggle, Wumpin, Quabosh,
 * zoncology).
 */

export const ADJECTIVES = [
  "abelian", "absolutely continuous", "admissible", "affine", "almost-periodic",
  "analytic", "anti-standard", "bijective", "bounded", "canonical", "coherent",
  "cohomologically trivial", "compact", "complete", "conditionally hyperbolic",
  "connected", "constructible", "contravariant", "countable", "covariant",
  "degenerate", "dense", "discrete", "dually flat", "enriched", "ergodic",
  "essentially unique", "exotic", "faithfully flat", "finitely presented",
  "formal", "free", "generic", "half-open", "harmonic", "hereditarily normal",
  "higher-order", "holomorphic", "homogeneous", "hyperbolic", "idempotent",
  "ill-founded", "injective", "integrable", "invariant", "irreducible",
  "left-compact", "left-exact", "linear", "locally trivial", "maximal",
  "meager", "measurable", "modal", "monoidal", "morally correct", "natural",
  "nilpotent", "noetherian", "non-degenerate", "non-euclidean", "nowhere dense",
  "ordered", "paraconsistent", "partially bounded", "perverse", "pointless",
  "positive-definite", "profinite", "projective", "pseudo-riemannian",
  "quasi-coherent", "reflexive", "residually finite", "semi-decidable",
  "separable", "simplicial", "skew-symmetric", "smooth", "stable", "strict",
  "strongly regular", "structural", "substructural", "surjective", "symmetric",
  "tame", "torsion-free", "totally disconnected", "transfinite", "tropical",
  "ultraweak", "unbounded", "uncountable", "universally closed", "unramified",
  "virtually abelian", "weakly mixing", "well-founded", "wild", "zonal",
] as const;

export const OBJECTS = [
  "algebra", "amplitude", "automorphism", "bicategory", "bifunctor", "bundle",
  "cardinal", "category", "chain complex", "coalgebra", "cochain",
  "coequalizer", "combinator", "comonad", "cone", "congruence", "crystal",
  "cycle", "derivation", "diagram", "endofunctor", "fan", "fibration",
  "filtration", "functor", "germ", "gerbe", "graph", "group", "groupoid",
  "homomorphism", "hyperplane", "ideal", "invariant", "isomorphism", "jet",
  "kernel", "lattice", "limit", "magma", "manifold", "martingale", "matrix",
  "matroid", "module", "monad", "monoid", "morphism", "motive", "operad",
  "orbifold", "ordinal", "pencil", "polytope", "poset", "presheaf", "quandle",
  "quiver", "relation", "residue", "ring", "semigroup", "sheaf", "simplex",
  "spectral sequence", "spectrum", "stack", "subspace", "syzygy", "tensor",
  "topos", "torsor", "tower", "ultrafilter", "universe", "variety", "vector",
  "web",
] as const;

export const FIELDS = [
  "algebraic geometry", "analytic number theory", "category theory",
  "chromatic homotopy theory", "combinatorics", "commutative algebra",
  "descriptive set theory", "differential geometry", "dynamical systems",
  "ergodic theory", "functional analysis", "game theory",
  "geometric group theory", "graph theory", "harmonic analysis",
  "homological algebra", "inner model theory", "knot theory", "lattice theory",
  "low-dimensional topology", "matroid theory", "measure theory", "mereology",
  "model theory", "non-commutative geometry", "number theory", "order theory",
  "pointless topology", "proof theory", "quandle theory", "ramsey theory",
  "representation theory", "singularity theory", "spectral theory",
  "symplectic geometry", "tropical geometry", "universal algebra", "zoncology",
] as const;

export const SURNAMES_REAL = [
  "Abel", "Banach", "Bernstein", "Borel", "Cantor", "Cartan", "Cauchy",
  "Conway", "Curry", "Dedekind", "Eilenberg", "Erdős", "Euler", "Fréchet",
  "Frege", "Galois", "Gauss", "Grothendieck", "Gödel", "Hausdorff", "Hilbert",
  "Klein", "Kolmogorov", "Lagrange", "Lebesgue", "Mac Lane", "Markov",
  "Minkowski", "Mumford", "Noether", "Pascal", "Peano", "Poincaré",
  "Ramanujan", "Riemann", "Russell", "Schröder", "Serre", "Sierpiński",
  "Tarski", "Ulam", "Weil", "Weyl", "Zeno", "Zilber", "Zorn",
] as const;

// From sylvanfranklin/nonsense, plus names invented here.
export const SURNAMES_SILLY = [
  "Nozzle", "Snaggle", "Wumpin", "Quabosh", "Barsik", "Sharik", "Pythis",
  "Rubble", "Fawkes", "Hitches", "Wager",
  "Bumbershoot", "Crumb", "Fiddlecomb", "Grimble", "Hornswoggle", "Ostrander",
  "Pemberton", "Quill", "Thistlewood", "Vexler", "Wrenn",
] as const;

export const SURNAMES: readonly string[] = [...SURNAMES_REAL, ...SURNAMES_SILLY];

/** Adjective prefixes stacked on at high gobbledygook. */
export const PREFIXES = [
  "pseudo-", "quasi-", "semi-", "anti-", "hyper-", "ultra-", "co-", "non-",
  "bi-", "meta-",
] as const;

export const NAMED_KINDS = [
  "lemma", "theorem", "conjecture", "principle", "postulate", "paradox",
  "duality", "hypothesis", "inequality", "correspondence", "dichotomy",
  "obstruction", "trick", "swindle", "phenomenon", "machine",
] as const;

export const RESULT_KINDS = [
  "Theorem", "Lemma", "Proposition", "Corollary", "Definition", "Conjecture",
  "Axiom", "Postulate",
] as const;

export interface Verb {
  base: string;
  third: string;
  past: string;
  ger: string;
  able: string;
}

const VERB_BASES = [
  "enrich", "structure", "relate", "interpolate", "construct", "generalize",
  "abstract", "localize", "sheafify", "compactify", "categorify", "quantize",
  "normalize", "resolve", "stabilize", "trivialize", "tropicalize",
  "complexify", "decompose", "linearize", "deform", "untangle", "flatten",
  "refine", "saturate", "collapse", "axiomatize",
] as const;

export function conjugate(base: string): Verb {
  const endsE = base.endsWith("e");
  const endsY = base.endsWith("y");
  const endsCh = base.endsWith("ch") || base.endsWith("sh");
  const stem = endsE ? base.slice(0, -1) : base;
  return {
    base,
    third: endsY ? base.slice(0, -1) + "ies" : endsCh ? base + "es" : base + "s",
    past: endsY ? base.slice(0, -1) + "ied" : endsE ? base + "d" : base + "ed",
    ger: stem + "ing",
    able: endsY ? base.slice(0, -1) + "iable" : stem + "able",
  };
}

export const VERBS: Verb[] = VERB_BASES.map(conjugate);

// Verbs that read naturally without an object ("every poset sheafifies").
// Excludes bases like "structure" or "construct" whose third-person forms
// parse as plural nouns in intransitive slots.
const INTRANSITIVE_BASES = new Set([
  "interpolate", "generalize", "localize", "sheafify", "compactify",
  "categorify", "quantize", "normalize", "stabilize", "trivialize",
  "tropicalize", "complexify", "decompose", "linearize", "deform",
  "flatten", "saturate", "collapse",
]);

export const IVERBS: Verb[] = VERBS.filter((v) => INTRANSITIVE_BASES.has(v.base));

export const ADVERBS = [
  "vacuously", "trivially", "logically", "necessarily", "formally",
  "ostensibly", "hypothetically", "obliquely", "indirectly", "superficially",
  "redundantly", "strictly", "presumably", "nominally", "fundamentally",
  "canonically", "generically", "tautologically", "morally", "virtually",
  "essentially", "manifestly", "mysteriously", "allegedly", "axiomatically",
  "unnaturally",
] as const;

export const GLAZE = [
  "groundbreaking", "seminal", "celebrated", "indispensable", "penetrating",
  "illuminating", "definitive", "visionary", "criminally underappreciated",
  "magisterial", "unimpeachable", "epoch-making",
] as const;

export const HEDGES = [
  "it is easy to see", "it is obvious", "one readily verifies",
  "the reader may check", "a moment's thought reveals",
  "it is a standard exercise to show", "any self-respecting logician will agree",
  "every well-educated mathematician knows", "it follows by abstract nonsense",
  "a routine diagram chase shows", "it is folklore",
] as const;

export const CLOSERS = [
  "The rest is trivial.",
  "The remaining cases are symmetric.",
  "The details are left as an exercise to the reader.",
  "The converse is immediate.",
  "This completes the proof.",
  "The reverse inclusion is proved similarly.",
  "The general case follows by induction.",
  "We omit the details, which are tedious but straightforward.",
] as const;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
] as const;

export const NATIONALITIES = [
  "American", "Belgian", "Canadian", "Danish", "Dutch", "English", "French",
  "German", "Hungarian", "Icelandic", "Italian", "Japanese", "Norwegian",
  "Polish", "Russian", "Scottish", "Swedish", "Swiss", "Turkish", "Peruvian",
  "Bavarian", "Ruritanian", "Freedonian", "Atlantean",
] as const;

export const PLACES = [
  "Pons Asinorum", "Threnody", "Vexford", "Grimblewald", "Lower Wumpington",
  "East Quabosh", "Nullstellen", "Kleinburg", "Erlangen", "Alexandria",
  "Uqbar", "Middlemarch", "New Snaggle", "Hilbertshire", "Upper Zilch",
] as const;

/* ------------------------------------------------------------------ */
/* Little English helpers                                              */
/* ------------------------------------------------------------------ */

const PLURAL_EXCEPTIONS: Record<string, string> = {
  matrix: "matrices",
  simplex: "simplices",
  vertex: "vertices",
  torus: "tori",
  topos: "topoi",
  spectrum: "spectra",
  sheaf: "sheaves",
  presheaf: "presheaves",
  calculus: "calculi",
  basis: "bases",
  locus: "loci",
  modulus: "moduli",
  genus: "genera",
};

/** Pluralize a (possibly multi-word) noun; the last word carries the plural. */
export function plural(noun: string): string {
  const words = noun.split(" ");
  const last = words[words.length - 1];
  let p = PLURAL_EXCEPTIONS[last];
  if (!p) {
    if (/(s|x|z|ch|sh)$/.test(last)) p = last + "es";
    else if (/[^aeiou]y$/.test(last)) p = last.slice(0, -1) + "ies";
    else p = last + "s";
  }
  words[words.length - 1] = p;
  return words.join(" ");
}

/** Prefix with "a" or "an" by vowel sound. */
export function an(phrase: string): string {
  const first = phrase.toLowerCase();
  // Vowel-initial words that open with consonant sounds ("universal",
  // "useful", "one", "euclidean") take "a".
  const article = /^(uni|use|one|eu)/.test(first)
    ? "a"
    : /^[aeiou]/.test(first)
      ? "an"
      : "a";
  return `${article} ${phrase}`;
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MINOR_WORDS = new Set([
  "of", "the", "for", "and", "in", "a", "an", "on", "to", "its", "with",
  "without", "via", "de", "von", "under",
]);

/** Title Case, leaving minor words (except the first) alone. */
export function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w, i) => (i > 0 && MINOR_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : cap(w)))
    .join(" ");
}

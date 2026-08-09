import { describe, expect, test } from "vitest";
import { an, cap, conjugate, plural, titleCase } from "../src/vocab.js";

describe("plural", () => {
  test.each([
    ["matrix", "matrices"],
    ["simplex", "simplices"],
    ["sheaf", "sheaves"],
    ["topos", "topoi"],
    ["spectrum", "spectra"],
    ["syzygy", "syzygies"],
    ["variety", "varieties"],
    ["chain complex", "chain complexes"],
    ["spectral sequence", "spectral sequences"],
    ["functor", "functors"],
    ["class", "classes"],
  ])("%s → %s", (one, many) => {
    expect(plural(one)).toBe(many);
  });
});

describe("an", () => {
  test.each([
    ["abelian group", "an abelian group"],
    ["functor", "a functor"],
    ["ordered set", "an ordered set"],
    ["universal cover", "a universal cover"],
    ["euclidean domain", "a euclidean domain"],
    ["Euler relation", "an Euler relation"],
    ["idempotent", "an idempotent"],
  ])("%s → %s", (word, expected) => {
    expect(an(word)).toBe(expected);
  });
});

describe("conjugate", () => {
  test("regular verb", () => {
    expect(conjugate("enrich")).toEqual({
      base: "enrich", third: "enriches", past: "enriched",
      ger: "enriching", able: "enrichable",
    });
  });
  test("e-final verb", () => {
    expect(conjugate("structure")).toEqual({
      base: "structure", third: "structures", past: "structured",
      ger: "structuring", able: "structurable",
    });
  });
  test("y-final verb", () => {
    expect(conjugate("sheafify")).toEqual({
      base: "sheafify", third: "sheafifies", past: "sheafified",
      ger: "sheafifying", able: "sheafifiable",
    });
  });
});

describe("casing", () => {
  test("cap", () => {
    expect(cap("perverse sheaf")).toBe("Perverse sheaf");
  });
  test("titleCase keeps minor words down", () => {
    expect(titleCase("on the failure of the trick for tame quivers")).toBe(
      "On the Failure of the Trick for Tame Quivers",
    );
  });
});

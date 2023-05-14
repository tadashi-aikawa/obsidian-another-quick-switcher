import { describe, expect, test } from "@jest/globals";
import { round } from "./math";

describe.each`
  n          | decimalPlace | expected
  ${34.5678} | ${2}         | ${34.57}
  ${0.1234}  | ${1}         | ${0.1}
`("round", ({ n, decimalPlace, expected }) => {
  test(`round(${n}, ${decimalPlace}) = ${expected}`, () => {
    expect(round(n, decimalPlace)).toBe(expected);
  });
});

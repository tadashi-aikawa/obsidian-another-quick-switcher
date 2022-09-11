import { count, intersection } from "./collection-helper";
import { describe, expect, test } from "@jest/globals";

describe.each<{ values: number[][]; expected: number[] }>`
  values                    | expected
  ${[[1, 2], [2, 3]]}       | ${[2]}
  ${[[1, 2, 3], [2, 3, 4]]} | ${[2, 3]}
  ${[[1, 2], [3, 4]]}       | ${[]}
  ${[[], []]}               | ${[]}
  ${[]}                     | ${[]}
`("intersection", ({ values, expected }) => {
  test(`intersection(${values}) = ${expected}`, () => {
    expect(intersection(values)).toStrictEqual(expected);
  });
});

describe.each<{ values: string[]; expected: { [x: string]: number } }>`
  values                | expected
  ${["aa", "ii", "aa"]} | ${{ aa: 2, ii: 1 }}
`("count", ({ values, expected }) => {
  test(`count(${values}) = ${expected}`, () => {
    expect(count(values)).toStrictEqual(expected);
  });
});

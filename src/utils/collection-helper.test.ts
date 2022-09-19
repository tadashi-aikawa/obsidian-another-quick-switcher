import { count, equalsAsSet, intersection } from "./collection-helper";
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

describe.each<{ ary1: string[]; ary2: string[]; expected: boolean }>`
  ary1      | ary2      | expected
  ${[1]}    | ${[1]}    | ${true}
  ${[1, 2]} | ${[1, 2]} | ${true}
  ${[1, 2]} | ${[2, 1]} | ${true}
  ${[]}     | ${[]}     | ${true}
  ${[1]}    | ${[2]}    | ${false}
  ${[1, 2]} | ${[2, 2]} | ${false}
`("equalsAsSet", ({ ary1, ary2, expected }) => {
  test(`equalsAsSet(${ary1}, ${ary2}) = ${expected}`, () => {
    expect(equalsAsSet(ary1, ary2)).toStrictEqual(expected);
  });
});

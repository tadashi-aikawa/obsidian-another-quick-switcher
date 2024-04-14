import { describe, expect, test } from "@jest/globals";
import {
  count,
  equalsAsSet,
  flatten,
  groupBy,
  intersection,
  keyBy,
  mirrorMap,
  omitBy,
  range,
  uniqBy,
} from "./collection-helper";

describe.each<{ n: number; expected: number[] }>`
  n    | expected
  ${0} | ${[]}
  ${1} | ${[0]}
  ${2} | ${[0, 1]}
  ${3} | ${[0, 1, 2]}
`("range", ({ n, expected }) => {
  test(`range(${n}) = ${expected}`, () => {
    expect(range(n)).toStrictEqual(expected);
  });
});

describe.each<{ matrix: any[][]; expected: any[] }>`
  matrix                      | expected
  ${[["a", "b"], ["c", "d"]]} | ${["a", "b", "c", "d"]}
  ${[["a"], ["c"]]}           | ${["a", "c"]}
  ${[["a"]]}                  | ${["a"]}
`("flatten", ({ matrix, expected }) => {
  test(`flatten(${matrix}) = ${expected}`, () => {
    expect(flatten(matrix)).toStrictEqual(expected);
  });
});

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

describe.each<{
  obj: any;
  shouldOmit: (key: string, value: any) => boolean;
  expected: any;
}>`
  obj                     | shouldOmit                                 | expected
  ${{ id: 1, name: "a" }} | ${(k: string, _: unknown) => k === "id"}   | ${{ name: "a" }}
  ${{ id: 2, name: "a" }} | ${(k: string, _: unknown) => k === "name"} | ${{ id: 2 }}
  ${{ id: 3, name: "a" }} | ${(k: string, _: unknown) => false}        | ${{ id: 3, name: "a" }}
  ${{ id: 4, name: "a" }} | ${(k: string, _: unknown) => true}         | ${{}}
`("omitBy", ({ obj, shouldOmit, expected }) => {
  test(`omitBy(${JSON.stringify(obj)}, shouldOmit) = ${JSON.stringify(
    expected,
  )}`, () => {
    expect(omitBy(obj, shouldOmit)).toStrictEqual(expected);
  });
});

describe.each<{
  values: any;
  toKey: (t: any) => string;
  expected: { [key: string]: any[] };
}>`
  values                    | toKey                           | expected
  ${["1", "20", "3", "40"]} | ${(t: any) => String(t.length)} | ${{ "1": ["1", "3"], "2": ["20", "40"] }}
  ${[1, 11, 111]}           | ${(t: any) => String(t % 10)}   | ${{ "1": [1, 11, 111] }}
`("groupBy", ({ values, toKey, expected }) => {
  test(`groupBy(${JSON.stringify(values)}, toKey) = ${JSON.stringify(
    expected,
  )}`, () => {
    expect(groupBy(values, toKey)).toStrictEqual(expected);
  });
});

describe.each<{
  values: any;
  toKey: (t: any) => string;
  expected: { [key: string]: any };
}>`
  values                    | toKey                           | expected
  ${["1", "20", "300"]}     | ${(t: any) => String(t.length)} | ${{ "1": "1", "2": "20", "3": "300" }}
  ${[1, 12, 123]}           | ${(t: any) => String(t % 10)}   | ${{ "1": 1, "2": 12, "3": 123 }}
  ${["1", "20", "3", "40"]} | ${(t: any) => String(t.length)} | ${{ "1": "3", "2": "40" }}
  ${[1, 11, 111]}           | ${(t: any) => String(t % 10)}   | ${{ "1": 111 }}
`("keyBy", ({ values, toKey, expected }) => {
  test(`keyBy(${JSON.stringify(values)}, toKey) = ${JSON.stringify(
    expected,
  )}`, () => {
    expect(keyBy(values, toKey)).toStrictEqual(expected);
  });
});

describe.each<{
  values: any[];
  fn: (t: any) => string;
  expected: any[];
}>`
  values              | fn                              | expected
  ${["1", "2", "30"]} | ${(t: any) => String(t.length)} | ${["1", "30"]}
`("uniqBy", ({ values, fn, expected }) => {
  test(`uniqBy(${JSON.stringify(values)}, fn) = ${JSON.stringify(
    expected,
  )}`, () => {
    expect(uniqBy(values, fn)).toStrictEqual(expected);
  });
});

describe.each<{
  values: any[];
  toValue: (t: any) => string;
  expected: { [key: string]: any };
}>`
  values         | toValue                         | expected
  ${["1", "20"]} | ${(t: any) => String(t.length)} | ${{ "1": "1", "2": "2" }}
`("mirrorMap", ({ values, toValue, expected }) => {
  test(`mirrorMap(${JSON.stringify(values)}, toValue) = ${JSON.stringify(
    expected,
  )}`, () => {
    expect(mirrorMap(values, toValue)).toStrictEqual(expected);
  });
});

import {
  excludeEmoji,
  excludeSpace,
  normalizeAccentsDiacritics,
  smartIncludes,
  smartStartsWith,
} from "./strings";

describe.each`
  text        | expected
  ${"aa bb"}  | ${"aabb"}
  ${" pre"}   | ${"pre"}
  ${"suf "}   | ${"suf"}
  ${" both "} | ${"both"}
  ${" a ll "} | ${"all"}
`("excludeSpace", ({ text, expected }) => {
  test(`excludeSpace(${text}) = ${expected}`, () => {
    expect(excludeSpace(text)).toBe(expected);
  });
});

describe.each`
  text           | expected
  ${"a🍰b"}      | ${"ab"}
  ${"🍰pre"}     | ${"pre"}
  ${"suf🍰"}     | ${"suf"}
  ${"🍰both😌"}  | ${"both"}
  ${"🍰a🍊ll🅰️"} | ${"all"}
`("excludeEmoji", ({ text, expected }) => {
  test(`excludeEmoji(${text}) = ${expected}`, () => {
    expect(excludeEmoji(text)).toBe(expected);
  });
});

describe.each`
  text        | expected
  ${"abcde"}  | ${"abcde"}
  ${"àáâãäå"} | ${"aaaaaa"}
  ${"çüöà"}   | ${"cuoa"}
  ${"Ø"}      | ${"O"}
  ${"a🍰b"}   | ${"a🍰b"}
`("normalizeAccentsDiacritics", ({ text, expected }) => {
  test(`normalizeAccentsDiacritics(${text}) = ${expected}`, () => {
    expect(normalizeAccentsDiacritics(text)).toBe(expected);
  });
});

describe.each`
  text            | query      | expected
  ${"abcd"}       | ${"bc"}    | ${true}
  ${"abcd"}       | ${"BC"}    | ${true}
  ${"ABCD"}       | ${"bc"}    | ${true}
  ${" AB CD "}    | ${"bc"}    | ${true}
  ${"🍰Cake"}     | ${"cake"}  | ${true}
  ${"🍰Cake"}     | ${"🍰"}    | ${true}
  ${"🍰AB🍰CD🍰"} | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab bc"} | ${false}
`("smartIncludes", ({ text, query, expected }) => {
  test(`smartIncludes(${text}, ${query}) = ${expected}`, () => {
    expect(smartIncludes(text, query)).toBe(expected);
  });
});

describe.each`
  text            | query      | expected
  ${"abcd"}       | ${"ab"}    | ${true}
  ${"abcd"}       | ${"AB"}    | ${true}
  ${"ABCD"}       | ${"ab"}    | ${true}
  ${"abcd"}       | ${"bc"}    | ${false}
  ${"abcd"}       | ${"BC"}    | ${false}
  ${"ABCD"}       | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab"}    | ${true}
  ${" AB CD "}    | ${"bc"}    | ${false}
  ${"🍰Cake"}     | ${"cake"}  | ${true}
  ${"🍰Cake"}     | ${"🍰"}    | ${false}
  ${"🍰AB🍰CD🍰"} | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab bc"} | ${false}
`("smartStartsWith", ({ text, query, expected }) => {
  test(`smartStartsWith(${text}, ${query}) = ${expected}`, () => {
    expect(smartStartsWith(text, query)).toBe(expected);
  });
});

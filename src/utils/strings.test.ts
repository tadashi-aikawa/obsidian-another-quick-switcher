import { describe, expect, test } from "@jest/globals";
import {
  type FuzzyResult,
  capitalIncludes,
  capitalizeFirstLetter,
  excludeEmoji,
  excludeFormat,
  excludeSpace,
  hasCapitalLetter,
  includes,
  microFuzzy,
  normalizeAccentsDiacritics,
  smartCommaSplit,
  smartEquals,
  smartIncludes,
  smartLineBreakSplit,
  smartMicroFuzzy,
  smartStartsWith,
  smartWhitespaceSplit,
  trimLineByEllipsis,
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
  text          | expected
  ${"a🍰b"}     | ${"ab"}
  ${"🍰pre"}    | ${"pre"}
  ${"suf🍰"}    | ${"suf"}
  ${"🍰both😌"} | ${"both"}
  ${"🍰a🍊ll🅰"} | ${"all"}
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

describe.each<{ text: string; query: string; expected: boolean }>`
  text            | query      | expected
  ${"abcd"}       | ${"bc"}    | ${true}
  ${"abcd"}       | ${"BC"}    | ${true}
  ${"ABCD"}       | ${"bc"}    | ${true}
  ${" AB CD "}    | ${"bc"}    | ${false}
  ${"🍰Cake"}     | ${"cake"}  | ${true}
  ${"🍰Cake"}     | ${"🍰"}    | ${true}
  ${"🍰AB🍰CD🍰"} | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab bc"} | ${false}
  ${" AB CD "}    | ${"ab cd"} | ${true}
`("includes", ({ text, query, expected }) => {
  test(`includes(${text}, ${query}) = ${expected}`, () => {
    expect(includes(text, query, false)).toBe(expected);
  });
});

describe.each<{
  text: string;
  query: string;
  isNormalizeAccentsDiacritics: boolean;
  expected: boolean;
}>`
  text            | query       | isNormalizeAccentsDiacritics | expected
  ${"abcd"}       | ${"bc"}     | ${false}                     | ${true}
  ${"abcd"}       | ${"BC"}     | ${false}                     | ${false}
  ${"ABCD"}       | ${"bc"}     | ${false}                     | ${true}
  ${"ABCD"}       | ${"bC"}     | ${false}                     | ${false}
  ${"ABCD"}       | ${"Bc"}     | ${false}                     | ${false}
  ${"ABCD"}       | ${"BC"}     | ${false}                     | ${true}
  ${" AB CD "}    | ${"bc"}     | ${false}                     | ${false}
  ${"🍰Cake"}     | ${"cake"}   | ${false}                     | ${true}
  ${"🍰Cake"}     | ${"🍰"}     | ${false}                     | ${true}
  ${"🍰AB🍰CD🍰"} | ${"bc"}     | ${false}                     | ${false}
  ${" AB CD "}    | ${"ab bc"}  | ${false}                     | ${false}
  ${" AB CD "}    | ${"ab cd"}  | ${false}                     | ${true}
  ${"àáâãäå"}     | ${"aaaaaa"} | ${false}                     | ${false}
  ${"àáâãäå"}     | ${"aaaaaa"} | ${true}                      | ${true}
  ${"àáâãäå"}     | ${"AAAAAA"} | ${true}                      | ${false}
`(
  "capitalIncludes",
  ({ text, query, isNormalizeAccentsDiacritics, expected }) => {
    test(`capitalIncludes(${text}, ${query}, ${isNormalizeAccentsDiacritics}) = ${expected}`, () => {
      expect(capitalIncludes(text, query, isNormalizeAccentsDiacritics)).toBe(
        expected,
      );
    });
  },
);

describe.each<{ text: string; query: string; expected: boolean }>`
  text            | query      | expected
  ${"abcd"}       | ${"bc"}    | ${true}
  ${"abcd"}       | ${"BC"}    | ${true}
  ${"ABCD"}       | ${"bc"}    | ${true}
  ${" AB CD "}    | ${"bc"}    | ${true}
  ${"🍰Cake"}     | ${"cake"}  | ${true}
  ${"🍰Cake"}     | ${"🍰"}    | ${true}
  ${"🍰AB🍰CD🍰"} | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab bc"} | ${false}
  ${" AB CD "}    | ${"ab cd"} | ${true}
`("smartIncludes", ({ text, query, expected }) => {
  test(`smartIncludes(${text}, ${query}) = ${expected}`, () => {
    expect(smartIncludes(text, query, false)).toBe(expected);
  });
});

describe.each<{ text: string; query: string; expected: boolean }>`
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
  ${" AB CD "}    | ${"ab cd"} | ${true}
`("smartStartsWith", ({ text, query, expected }) => {
  test(`smartStartsWith(${text}, ${query}) = ${expected}`, () => {
    expect(smartStartsWith(text, query, false)).toBe(expected);
  });
});

describe.each<{ text: string; query: string; expected: boolean }>`
  text            | query      | expected
  ${"abcd"}       | ${"ab"}    | ${false}
  ${"abcd"}       | ${"AB"}    | ${false}
  ${"ABCD"}       | ${"ab"}    | ${false}
  ${"abcd"}       | ${"bc"}    | ${false}
  ${"abcd"}       | ${"BC"}    | ${false}
  ${"ABCD"}       | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab"}    | ${false}
  ${" AB CD "}    | ${"bc"}    | ${false}
  ${"🍰Cake"}     | ${"cake"}  | ${true}
  ${"🍰Cake"}     | ${"🍰"}    | ${false}
  ${"🍰AB🍰CD🍰"} | ${"bc"}    | ${false}
  ${" AB CD "}    | ${"ab bc"} | ${false}
`("smartStartsWith", ({ text, query, expected }) => {
  test(`smartStartsWith(${text}, ${query}) = ${expected}`, () => {
    expect(smartEquals(text, query, false)).toBe(expected);
  });
});

describe.each`
  text                                     | expected
  ${"[[aaa]]"}                             | ${"aaa"}
  ${"[[aaa]] aaa"}                         | ${"aaa aaa"}
  ${"aaa [[aaa]]"}                         | ${"aaa aaa"}
  ${"aaa [[aaa]] aaa"}                     | ${"aaa aaa aaa"}
  ${"[[aaa]] [[bbb]]"}                     | ${"aaa bbb"}
  ${"[[aaa|bbb]]"}                         | ${"bbb"}
  ${"[[aaa|bbb]] [[aaa|ccc]]"}             | ${"bbb ccc"}
  ${"[[aaa]] [[aaa|ccc]]"}                 | ${"aaa ccc"}
  ${"[[aaa|bbb]] [[aaa]]"}                 | ${"bbb aaa"}
  ${"[aaa](http://aaa)"}                   | ${"aaa"}
  ${"[aaa](https://aaa)"}                  | ${"aaa"}
  ${"[aaa]"}                               | ${"aaa"}
  ${"`aaa`"}                               | ${"aaa"}
  ${"~~aaa~~"}                             | ${"aaa"}
  ${"==aaa=="}                             | ${"aaa"}
  ${"**aaa**"}                             | ${"aaa"}
  ${"*aaa*"}                               | ${"aaa"}
  ${"*aaa* **bbb** *ccc* **ddd**"}         | ${"aaa bbb ccc ddd"}
  ${"__aaa__"}                             | ${"aaa"}
  ${"_aaa_"}                               | ${"aaa"}
  ${"_aaa_ __bbb__ _ccc_ __ddd__"}         | ${"aaa bbb ccc ddd"}
  ${"<div>aaa</div>"}                      | ${"aaa"}
  ${"<div>aaa</div> [bbb] <b>ccc</b>"}     | ${"aaa bbb ccc"}
  ${"[[aa]] [bb](https://bb) `cc` **dd**"} | ${"aa bb cc dd"}
`("excludeFormat", ({ text, expected }) => {
  test(`excludeFormat(${text}) = ${expected}`, () => {
    expect(excludeFormat(text)).toBe(expected);
  });
});

describe.each<{ text: string; expected: string[] }>`
  text       | expected
  ${"aa,bb"} | ${["aa", "bb"]}
  ${""}      | ${[]}
`("smartCommaSplit", ({ text, expected }) => {
  test(`smartCommaSplit(${text}) = ${expected}`, () => {
    expect(smartCommaSplit(text)).toStrictEqual(expected);
  });
});

describe.each<{ text: string; expected: string[] }>`
  text        | expected
  ${"aa\nbb"} | ${["aa", "bb"]}
  ${""}       | ${[]}
`("smartLineBreakSplit", ({ text, expected }) => {
  test(`smartLineBreakSplit(${text}) = ${expected}`, () => {
    expect(smartLineBreakSplit(text)).toStrictEqual(expected);
  });
});

describe.each<{ text: string; expected: string[] }>`
  text                      | expected
  ${"aa"}                   | ${["aa"]}
  ${"aa "}                  | ${["aa"]}
  ${"aa bb"}                | ${["aa", "bb"]}
  ${" aa bb"}               | ${["aa", "bb"]}
  ${"aa bb "}               | ${["aa", "bb"]}
  ${" aa bb "}              | ${["aa", "bb"]}
  ${"aa bb cc"}             | ${["aa", "bb", "cc"]}
  ${" aa bb cc"}            | ${["aa", "bb", "cc"]}
  ${" aa bb cc "}           | ${["aa", "bb", "cc"]}
  ${'"aa bb" cc'}           | ${["aa bb", "cc"]}
  ${'aa "bb cc"'}           | ${["aa", "bb cc"]}
  ${'"aa bb cc"'}           | ${["aa bb cc"]}
  ${'"aa bb" "bb cc"'}      | ${["aa bb", "bb cc"]}
  ${'"aa bb" dd "bb cc"'}   | ${["aa bb", "dd", "bb cc"]}
  ${'c"aa bb"d'}            | ${["caa bbd"]}
`("smartWhitespaceSplit", ({ text, expected }) => {
  test(`smartWhitespaceSplit(${text}) = ${expected}`, () => {
    expect(smartWhitespaceSplit(text)).toStrictEqual(expected);
  });
});

describe.each`
  text        | expected
  ${"abc"}    | ${"Abc"}
  ${"Abc"}    | ${"Abc"}
  ${"ABC"}    | ${"ABC"}
  ${" abc"}   | ${" abc"}
  ${"あいう"} | ${"あいう"}
  ${"🍰🍴"}   | ${"🍰🍴"}
`("capitalizeFirstLetter", ({ text, expected }) => {
  test(`capitalizeFirstLetter(${text}) = ${expected}`, () => {
    expect(capitalizeFirstLetter(text)).toBe(expected);
  });
});

describe.each<{ text: string; expected: boolean }>`
  text        | expected
  ${"abc"}    | ${false}
  ${"Abc"}    | ${true}
  ${"あいう"} | ${false}
  ${"🍰🍴"}   | ${false}
`("hasCapitalLetter", ({ text, expected }) => {
  test(`hasCapitalLetter(${text}) = ${expected}`, () => {
    expect(hasCapitalLetter(text)).toBe(expected);
  });
});

describe.each<{ value: string; query: string; expected: FuzzyResult }>`
  value                 | query       | expected
  ${"abcde"}            | ${"ab"}     | ${{ type: "starts-with", score: 0.8 }}
  ${"abcde"}            | ${"bc"}     | ${{ type: "includes", score: 0.8 }}
  ${"abcde"}            | ${"ace"}    | ${{ type: "fuzzy", score: 1.2 }}
  ${"abcde"}            | ${"abcde"}  | ${{ type: "starts-with", score: 6.4 }}
  ${"abcde"}            | ${"abcdf"}  | ${{ type: "none", score: 0 }}
  ${"abcde"}            | ${"abcdef"} | ${{ type: "none", score: 0 }}
  ${"abcde"}            | ${"bd"}     | ${{ type: "fuzzy", score: 0.8 }}
  ${"abcde"}            | ${"ba"}     | ${{ type: "none", score: 0 }}
  ${"fuzzy name match"} | ${"match"}  | ${{ type: "includes", score: 2 }}
  ${"📝memo"}           | ${"mem"}    | ${{ type: "starts-with", score: 1.3333333333333333 }}
  ${"📝memo"}           | ${"📝"}     | ${{ type: "starts-with", score: 0.6666666666666666 }}
`("microFuzzy", ({ value, query, expected }) => {
  test(`microFuzzy(${value}, ${query}) = ${expected}`, () => {
    expect(microFuzzy(value, query)).toStrictEqual(expected);
  });
});

describe.each<{ value: string; query: string; expected: FuzzyResult }>`
  value                 | query       | expected
  ${"abcde"}            | ${"ab"}     | ${{ type: "starts-with", score: 0.8 }}
  ${"abcde"}            | ${"bc"}     | ${{ type: "includes", score: 0.8 }}
  ${"abcde"}            | ${"ace"}    | ${{ type: "fuzzy", score: 1.2 }}
  ${"abcde"}            | ${"abcde"}  | ${{ type: "starts-with", score: 6.4 }}
  ${"abcde"}            | ${"abcdef"} | ${{ type: "none", score: 0 }}
  ${"abcde"}            | ${"bd"}     | ${{ type: "fuzzy", score: 0.8 }}
  ${"abcde"}            | ${"ba"}     | ${{ type: "none", score: 0 }}
  ${"fuzzy name match"} | ${"match"}  | ${{ type: "includes", score: 2.2857142857142856 }}
  ${"📝memo"}           | ${"mem"}    | ${{ type: "starts-with", score: 1.3333333333333333 }}
  ${"📝memo"}           | ${"📝"}     | ${{ type: "starts-with", score: 0.6666666666666666 }}
`("smartMicroFuzzy", ({ value, query, expected }) => {
  test(`smartMicroFuzzy(${value}, ${query}) = ${expected}`, () => {
    expect(smartMicroFuzzy(value, query, false)).toStrictEqual(expected);
  });
});

describe.each<{ value: string; max: number; expected: string }>`
  value           | max  | expected
  ${"1234567890"} | ${1} | ${"1 ... 0"}
  ${"1234567890"} | ${3} | ${"123 ... 890"}
  ${"1234567890"} | ${4} | ${"1234 ... 7890"}
  ${"1234567890"} | ${5} | ${"1234567890"}
  ${"1234567890"} | ${6} | ${"1234567890"}
`("trimLineByEllipsis", ({ value, max, expected }) => {
  test(`trimLineByEllipsis(${value}, ${max}) = ${expected}`, () => {
    expect(trimLineByEllipsis(value, max)).toStrictEqual(expected);
  });
});

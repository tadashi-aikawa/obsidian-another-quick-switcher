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
  text                    | expected
  ${"aa"}                 | ${["aa"]}
  ${"aa "}                | ${["aa"]}
  ${"aa bb"}              | ${["aa", "bb"]}
  ${" aa bb"}             | ${["aa", "bb"]}
  ${"aa bb "}             | ${["aa", "bb"]}
  ${" aa bb "}            | ${["aa", "bb"]}
  ${"aa bb cc"}           | ${["aa", "bb", "cc"]}
  ${" aa bb cc"}          | ${["aa", "bb", "cc"]}
  ${" aa bb cc "}         | ${["aa", "bb", "cc"]}
  ${'"aa bb" cc'}         | ${["aa bb", "cc"]}
  ${'aa "bb cc"'}         | ${["aa", "bb cc"]}
  ${'"aa bb cc"'}         | ${["aa bb cc"]}
  ${'"aa bb" "bb cc"'}    | ${["aa bb", "bb cc"]}
  ${'"aa bb" dd "bb cc"'} | ${["aa bb", "dd", "bb cc"]}
  ${'c"aa bb"d'}          | ${["caa bbd"]}
  ${'search \\"quote'}    | ${["search", '"quote']}
  ${'search \\" test'}    | ${["search", '"', "test"]}
  ${'\\"hello world\\"'}  | ${['"hello', 'world"']}
  ${'pre \\"mid\\" post'} | ${["pre", '"mid"', "post"]}
  ${'aa \\"bb cc\\" dd'}  | ${["aa", '"bb', 'cc"', "dd"]}
  ${'\\"'}                | ${['"']}
  ${'\\"\\"'}             | ${['""']}
  ${'test \\"'}           | ${["test", '"']}
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
  ${"abcde"}            | ${"ab"}     | ${{ type: "starts-with", score: 0.8, ranges: [{ start: 0, end: 1 }] }}
  ${"abcde"}            | ${"bc"}     | ${{ type: "includes", score: 0.8, ranges: [{ start: 1, end: 2 }] }}
  ${"abcde"} | ${"ace"} | ${{ type: "fuzzy", score: 1.2, ranges: [{ start: 0, end: 0 }, { start: 2, end: 2 }, { start: 4, end: 4 }] }}
  ${"abcde"}            | ${"abcde"}  | ${{ type: "starts-with", score: 6.4, ranges: [{ start: 0, end: 4 }] }}
  ${"abcde"}            | ${"abcdf"}  | ${{ type: "none", score: 0 }}
  ${"abcde"}            | ${"abcdef"} | ${{ type: "none", score: 0 }}
  ${"abcde"} | ${"bd"} | ${{ type: "fuzzy", score: 0.8, ranges: [{ start: 1, end: 1 }, { start: 3, end: 3 }] }}
  ${"abcde"}            | ${"ba"}     | ${{ type: "none", score: 0 }}
  ${"fuzzy name match"} | ${"match"}  | ${{ type: "includes", score: 2, ranges: [{ start: 11, end: 15 }] }}
  ${"📝memo"}           | ${"mem"}    | ${{ type: "starts-with", score: 1.3333333333333333, ranges: [{ start: 0, end: 2 }] }}
  ${"📝memo"}           | ${"📝"}     | ${{ type: "starts-with", score: 0.6666666666666666, ranges: [{ start: 0, end: 1 }] }}
`("microFuzzy", ({ value, query, expected }) => {
  test(`microFuzzy(${value}, ${query}) = ${expected}`, () => {
    expect(microFuzzy(value, query)).toStrictEqual(expected);
  });
});

describe.each<{ value: string; query: string; expected: FuzzyResult }>`
  value                 | query       | expected
  ${"abcde"}            | ${"ab"}     | ${{ type: "starts-with", score: 0.8, ranges: [{ start: 0, end: 1 }] }}
  ${"abcde"}            | ${"bc"}     | ${{ type: "includes", score: 0.8, ranges: [{ start: 1, end: 2 }] }}
  ${"abcde"} | ${"ace"} | ${{ type: "fuzzy", score: 1.2, ranges: [{ start: 0, end: 0 }, { start: 2, end: 2 }, { start: 4, end: 4 }] }}
  ${"abcde"}            | ${"abcde"}  | ${{ type: "starts-with", score: 6.4, ranges: [{ start: 0, end: 4 }] }}
  ${"abcde"}            | ${"abcdef"} | ${{ type: "none", score: 0 }}
  ${"abcde"} | ${"bd"} | ${{ type: "fuzzy", score: 0.8, ranges: [{ start: 1, end: 1 }, { start: 3, end: 3 }] }}
  ${"abcde"}            | ${"ba"}     | ${{ type: "none", score: 0 }}
  ${"fuzzy name match"} | ${"match"}  | ${{ type: "includes", score: 2.2857142857142856, ranges: [{ start: 11, end: 15 }] }}
  ${"📝memo"}           | ${"mem"}    | ${{ type: "starts-with", score: 2, ranges: [{ start: 2, end: 4 }] }}
  ${"📝memo"}           | ${"📝"}     | ${{ type: "starts-with", score: 0.25, ranges: [{ start: 0, end: 1 }] }}
`("smartMicroFuzzy", ({ value, query, expected }) => {
  test(`smartMicroFuzzy(${value}, ${query}) = ${expected}`, () => {
    expect(smartMicroFuzzy(value, query, false)).toStrictEqual(expected);
  });
});

// Test case for the Insert mode bug
test("smartMicroFuzzy handles space correctly", () => {
  const result = smartMicroFuzzy("Insert mode", "insertmode", false);

  // The query "insertmode" should match "Insert mode" as a starts-with match
  // since "insertmode" exactly matches "Insert mode" with space removed
  expect(result.type).toBe("starts-with");
  expect(result.ranges).toEqual([
    { start: 0, end: 5 }, // "Insert"
    { start: 7, end: 10 }, // "mode"
  ]);
});

// Test case for multiple word queries
test("Multiple word queries should work correctly", () => {
  const insertResult = smartMicroFuzzy("Insert mode", "insert", false);
  const modeResult = smartMicroFuzzy("Insert mode", "mode", false);

  expect(insertResult.type).toBe("starts-with");
  expect(insertResult.ranges).toEqual([{ start: 0, end: 5 }]); // "Insert"

  expect(modeResult.type).toBe("includes");
  expect(modeResult.ranges).toEqual([{ start: 7, end: 10 }]); // "mode"
});

// Test case for emoji handling
test("smartMicroFuzzy handles emoji correctly", () => {
  const text = "📘Obsidian Publishの運営戦略";

  const obsidianResult = smartMicroFuzzy(text, "obsidian", false);
  const publishResult = smartMicroFuzzy(text, "publish", false);

  expect(obsidianResult.type).toBe("starts-with");
  // The emoji 📘 takes positions 0-1 (surrogate pair), so "Obsidian" is at positions 2-9
  expect(obsidianResult.ranges).toEqual([{ start: 2, end: 9 }]); // "Obsidian" after emoji

  expect(publishResult.type).toBe("includes");
  expect(publishResult.ranges).toEqual([{ start: 11, end: 17 }]); // "Publish" after space
});

test("smartMicroFuzzy handles emoji + text query correctly", () => {
  const result = smartMicroFuzzy(
    "📜2025-06-20 Claude CodeでDeepWikiのリモートMCPサーバーを使ってみる",
    "📜 claude",
    false,
  );
  expect(result.type).toBe("includes");
  expect(result.ranges).toEqual([
    { start: 13, end: 18 }, // "Claude" part only - emoji part handled separately
  ]);
});

test("smartMicroFuzzy prioritizes emoji+text prefix correctly", () => {
  const result = smartMicroFuzzy(
    "📜2025-06-20 Claude CodeでDeepWikiのリモートMCPサーバーを使ってみる",
    "📜2",
    false,
  );
  expect(result.type).toBe("starts-with");
  expect(result.ranges).toEqual([{ start: 0, end: 2 }]); // "📜2" at the beginning
  expect(result.score).toBeGreaterThan(0.05); // Confirmed working value
});

describe("Performance tests", () => {
  const generateTestData = (size: number): string[] => {
    // biome-ignore format: Keep arrays compact for readability
    const bases = [
      "file", "document", "note", "memo", "page", "article", "draft", "text",
      "📝memo", "📘book", "🔧config", "📊data", "🌟star", "💡idea", "📋list", "🎯target",
      "プロジェクト", "ドキュメント", "メモ", "ファイル", "設定", "データ", "リスト", "目標",
      "Café", "résumé", "naïve", "façade", "piñata", "señor", "cañon", "niño"
    ];
    // biome-ignore format: Keep arrays compact for readability
    const extensions = [".md", ".txt", ".json", ".yml", ".csv", ".log"];
    // biome-ignore format: Keep arrays compact for readability
    const prefixes = ["Draft", "Final", "Review", "Archive", "Backup", "Import", "Export"];
    // biome-ignore format: Keep arrays compact for readability
    const suffixes = ["v1", "v2", "backup", "old", "new", "temp", "final", "copy"];

    const result: string[] = [];
    for (let i = 0; i < size; i++) {
      const base = bases[i % bases.length];
      const ext = extensions[i % extensions.length];
      const prefix = i % 3 === 0 ? `${prefixes[i % prefixes.length]} ` : "";
      const suffix = i % 4 === 0 ? ` ${suffixes[i % suffixes.length]}` : "";
      result.push(`${prefix}${base}${suffix}${ext}`);
    }
    return result;
  };

  // Performance thresholds based on actual AnotherQuickSwitcherModal usage
  // Reference: AnotherQuickSwitcherModal.ts:469 debug log timing
  // Measured: small(0.6ms), medium(2.2-4.5ms), large(19-32ms)
  const PERFORMANCE_THRESHOLDS = {
    microFuzzy: {
      small: 3, // 100 vault: measured 0.56ms → 3ms threshold
      medium: 5, // 1000 vault: measured 2.22ms → 5ms threshold
      large: 25, // 10000 vault: measured 19.04ms → 25ms threshold
    },
    smartMicroFuzzy: {
      small: 3, // 100 vault: measured 0.59ms → 3ms threshold
      medium: 8, // 1000 vault: measured 4.53ms → 8ms threshold
      large: 40, // 10000 vault: measured 32.04ms → 40ms threshold
    },
  };

  const measurePerformance = (fn: () => void, iterations = 1): number => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    return end - start;
  };

  describe.each([
    { name: "small", size: 100, iterations: 10 },
    { name: "medium", size: 1000, iterations: 10 },
    { name: "large", size: 10000, iterations: 10 },
  ])("$name dataset ($size items)", ({ name, size, iterations }) => {
    const testData = generateTestData(size);

    test(`microFuzzy performance should be under ${PERFORMANCE_THRESHOLDS.microFuzzy[name as keyof typeof PERFORMANCE_THRESHOLDS.microFuzzy]}ms`, () => {
      // Simulate real usage: single query against all data (like typing in search)
      const query = "test"; // Representative query
      const executionTime = measurePerformance(() => {
        for (const data of testData) {
          microFuzzy(data, query);
        }
      }, iterations);

      const threshold =
        PERFORMANCE_THRESHOLDS.microFuzzy[
          name as keyof typeof PERFORMANCE_THRESHOLDS.microFuzzy
        ];
      expect(executionTime).toBeLessThan(threshold);
    });

    test(`smartMicroFuzzy performance should be under ${PERFORMANCE_THRESHOLDS.smartMicroFuzzy[name as keyof typeof PERFORMANCE_THRESHOLDS.smartMicroFuzzy]}ms`, () => {
      // Simulate real usage: single query against all data (like typing in search)
      const query = "test"; // Representative query
      const executionTime = measurePerformance(() => {
        for (const data of testData) {
          smartMicroFuzzy(data, query, false);
        }
      }, iterations);

      const threshold =
        PERFORMANCE_THRESHOLDS.smartMicroFuzzy[
          name as keyof typeof PERFORMANCE_THRESHOLDS.smartMicroFuzzy
        ];
      expect(executionTime).toBeLessThan(threshold);
    });
  });

  test("Score consistency - results should be deterministic", () => {
    const testCases = [
      { text: "abcde", query: "ace" },
      { text: "📝memo", query: "mem" },
      { text: "Insert mode", query: "insertmode" },
      { text: "プロジェクト", query: "プロ" },
      { text: "Café résumé", query: "cafe" },
    ];

    for (const { text, query } of testCases) {
      const results1 = [1, 2, 3].map(() => microFuzzy(text, query));
      const results2 = [1, 2, 3].map(() => smartMicroFuzzy(text, query, false));

      expect(results1[0]).toEqual(results1[1]);
      expect(results1[1]).toEqual(results1[2]);
      expect(results2[0]).toEqual(results2[1]);
      expect(results2[1]).toEqual(results2[2]);
    }
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

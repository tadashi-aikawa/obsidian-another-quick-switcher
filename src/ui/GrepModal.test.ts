import { describe, expect, test } from "@jest/globals";
import { mergeAndFilterResults } from "../utils/grep-utils";
import type { MatchResult } from "../utils/ripgrep";

describe("GrepModal AND search with multiple ripgrep execution", () => {
  describe("mergeAndFilterResults", () => {
    test("should return empty array for empty input", () => {
      expect(mergeAndFilterResults([])).toEqual([]);
    });

    test("should return original results for single query", () => {
      const results: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/path/to/file.md" },
            lines: { text: "hello world test" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "hello" }, start: 0, end: 5 }],
          },
        },
      ];

      expect(mergeAndFilterResults([results])).toEqual(results);
    });

    test("should merge results with AND logic", () => {
      const results1: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/path/to/file.md" },
            lines: { text: "hello world test" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "hello" }, start: 0, end: 5 }],
          },
        },
        {
          type: "match",
          data: {
            path: { text: "/path/to/other.md" },
            lines: { text: "hello there" },
            line_number: 2,
            absolute_offset: 10,
            submatches: [{ match: { text: "hello" }, start: 0, end: 5 }],
          },
        },
      ];

      const results2: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/path/to/file.md" },
            lines: { text: "hello world test" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "world" }, start: 6, end: 11 }],
          },
        },
      ];

      const merged = mergeAndFilterResults([results1, results2]);

      expect(merged).toHaveLength(1);
      expect(merged[0].data.path.text).toBe("/path/to/file.md");
      expect(merged[0].data.line_number).toBe(1);
      expect(merged[0].data.submatches).toHaveLength(2);
      expect(merged[0].data.submatches[0].match.text).toBe("hello");
      expect(merged[0].data.submatches[1].match.text).toBe("world");
    });

    test("should handle three queries with AND logic", () => {
      const results1: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/test.md" },
            lines: { text: "apple banana cherry" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "apple" }, start: 0, end: 5 }],
          },
        },
      ];

      const results2: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/test.md" },
            lines: { text: "apple banana cherry" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "banana" }, start: 6, end: 12 }],
          },
        },
      ];

      const results3: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/test.md" },
            lines: { text: "apple banana cherry" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "cherry" }, start: 13, end: 19 }],
          },
        },
      ];

      const merged = mergeAndFilterResults([results1, results2, results3]);

      expect(merged).toHaveLength(1);
      expect(merged[0].data.submatches).toHaveLength(3);
      expect(merged[0].data.submatches.map((s) => s.match.text)).toEqual([
        "apple",
        "banana",
        "cherry",
      ]);
    });

    test("should filter out results that don't match all queries", () => {
      const results1: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/file1.md" },
            lines: { text: "hello world" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "hello" }, start: 0, end: 5 }],
          },
        },
        {
          type: "match",
          data: {
            path: { text: "/file2.md" },
            lines: { text: "hello there" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "hello" }, start: 0, end: 5 }],
          },
        },
      ];

      const results2: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/file1.md" },
            lines: { text: "hello world" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "world" }, start: 6, end: 11 }],
          },
        },
        // file2.md does not have "world", so it should be filtered out
      ];

      const merged = mergeAndFilterResults([results1, results2]);

      expect(merged).toHaveLength(1);
      expect(merged[0].data.path.text).toBe("/file1.md");
    });

    test("should handle overlapping matches correctly", () => {
      // Simulate the issue: "hogeaaa|fugaaaa" with queries "fuga hoge"
      const results1: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/test.md" },
            lines: { text: '"hogeaaa|fugaaaa"' },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "fuga" }, start: 9, end: 13 }], // "fuga" in "fugaaaa"
          },
        },
      ];

      const results2: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/test.md" },
            lines: { text: '"hogeaaa|fugaaaa"' },
            line_number: 1,
            absolute_offset: 0,
            submatches: [{ match: { text: "hoge" }, start: 1, end: 5 }], // "hoge" in "hogeaaa"
          },
        },
      ];

      const merged = mergeAndFilterResults([results1, results2]);

      expect(merged).toHaveLength(1);
      expect(merged[0].data.submatches).toHaveLength(2);
      // Verify both submatches are preserved
      expect(merged[0].data.submatches[0].match.text).toBe("fuga");
      expect(merged[0].data.submatches[1].match.text).toBe("hoge");
      // Verify positions are correct
      expect(merged[0].data.submatches[0].start).toBe(9);
      expect(merged[0].data.submatches[0].end).toBe(13);
      expect(merged[0].data.submatches[1].start).toBe(1);
      expect(merged[0].data.submatches[1].end).toBe(5);
    });

    test("should handle duplicate/overlapping matches from same query", () => {
      // Simulate the issue: "Claude" appears twice and both are matched
      const results1: MatchResult[] = [
        {
          type: "match",
          data: {
            path: { text: "/test.md" },
            lines: { text: "[[Claude|Claude]]" },
            line_number: 1,
            absolute_offset: 0,
            submatches: [
              { match: { text: "Claude" }, start: 2, end: 8 }, // First Claude
              { match: { text: "Claude" }, start: 9, end: 15 }, // Second Claude
            ],
          },
        },
      ];

      const merged = mergeAndFilterResults([results1]);

      expect(merged).toHaveLength(1);
      expect(merged[0].data.submatches).toHaveLength(2);
      // Both Claude matches should be preserved
      expect(merged[0].data.submatches[0].match.text).toBe("Claude");
      expect(merged[0].data.submatches[1].match.text).toBe("Claude");
      expect(merged[0].data.submatches[0].start).toBe(2);
      expect(merged[0].data.submatches[0].end).toBe(8);
      expect(merged[0].data.submatches[1].start).toBe(9);
      expect(merged[0].data.submatches[1].end).toBe(15);
    });
  });
});

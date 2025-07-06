import { describe, expect, test } from "@jest/globals";
import {
  byteToCharPosition,
  convertSubmatchesToCharPositions,
  mergeOverlappingSubmatches,
} from "./grep-utils";

describe("grep-utils", () => {
  describe("mergeOverlappingSubmatches", () => {
    test("should return original when no overlapping", () => {
      const submatches = [
        { match: { text: "hello" }, start: 0, end: 5 },
        { match: { text: "world" }, start: 10, end: 15 },
      ];

      const result = mergeOverlappingSubmatches(submatches);

      expect(result).toHaveLength(2);
      expect(result[0].match.text).toBe("hello");
      expect(result[1].match.text).toBe("world");
    });

    test("should merge overlapping submatches", () => {
      const originalText = "[[Claude|Claude]]";
      const submatches = [
        { match: { text: "Claude" }, start: 2, end: 8 }, // First Claude
        { match: { text: "Claude" }, start: 9, end: 15 }, // Second Claude (overlapping with |)
      ];

      const result = mergeOverlappingSubmatches(submatches, originalText);

      expect(result).toHaveLength(2); // Should remain separate as they don't actually overlap
      expect(result[0].match.text).toBe("Claude");
      expect(result[0].start).toBe(2);
      expect(result[0].end).toBe(8);
      expect(result[1].match.text).toBe("Claude");
      expect(result[1].start).toBe(9);
      expect(result[1].end).toBe(15);
    });

    test("should NOT merge adjacent different matches", () => {
      const originalText = "ClaudeCode";
      const submatches = [
        { match: { text: "Claude" }, start: 0, end: 6 },
        { match: { text: "Code" }, start: 6, end: 10 }, // Adjacent but different - should NOT merge
      ];

      const result = mergeOverlappingSubmatches(submatches, originalText);

      expect(result).toHaveLength(2); // Should remain separate
      expect(result[0].match.text).toBe("Claude");
      expect(result[1].match.text).toBe("Code");
    });

    test("should remove exact duplicates only", () => {
      const originalText = "Claude Claude";
      const submatches = [
        { match: { text: "Claude" }, start: 0, end: 6 }, // First Claude
        { match: { text: "Claude" }, start: 0, end: 6 }, // Duplicate of first Claude
        { match: { text: "Claude" }, start: 7, end: 13 }, // Second Claude (different position)
      ];

      const result = mergeOverlappingSubmatches(submatches, originalText);

      expect(result).toHaveLength(2); // Remove duplicate, keep both unique positions
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(6);
      expect(result[1].start).toBe(7);
      expect(result[1].end).toBe(13);
    });

    test("should keep actual overlapping ranges separate (not same start/end)", () => {
      const originalText = "overlapping text";
      const submatches = [
        { match: { text: "overlap" }, start: 0, end: 7 },
        { match: { text: "lapping" }, start: 4, end: 11 }, // Overlaps with first but different range
      ];

      const result = mergeOverlappingSubmatches(submatches, originalText);

      expect(result).toHaveLength(2); // Keep both since they have different start/end
      expect(result[0].match.text).toBe("overlap");
      expect(result[1].match.text).toBe("lapping");
    });

    test("should handle invalid ranges gracefully", () => {
      // When ripgrep returns invalid indices due to encoding issues
      const originalText = "Short text with Claude";
      const submatches = [
        { match: { text: "Claude" }, start: 16, end: 22 }, // Valid
        { match: { text: "Claude" }, start: 225, end: 231 }, // Invalid - beyond text length
        { match: { text: "Claude" }, start: 231, end: 237 }, // Invalid - beyond text length
      ];

      const result = mergeOverlappingSubmatches(submatches, originalText);

      // Should filter out invalid ranges and keep only valid ones
      expect(result).toHaveLength(1);
      expect(result[0].match.text).toBe("Claude");
      expect(result[0].start).toBe(16);
      expect(result[0].end).toBe(22);
    });

    test("should keep adjacent different matches separate", () => {
      // Adjacent different matches should remain separate
      const submatches = [
        { match: { text: "Claude" }, start: 0, end: 6 },
        { match: { text: "Code" }, start: 6, end: 10 }, // Adjacent but different
      ];

      const result = mergeOverlappingSubmatches(submatches);

      expect(result).toHaveLength(2); // Keep separate
      expect(result[0].match.text).toBe("Claude");
      expect(result[1].match.text).toBe("Code");
    });
  });

  describe("byteToCharPosition", () => {
    test("should handle ASCII text correctly", () => {
      const text = "Hello World";
      expect(byteToCharPosition(text, 0)).toBe(0);
      expect(byteToCharPosition(text, 5)).toBe(5);
      expect(byteToCharPosition(text, 6)).toBe(6);
    });

    test("should convert UTF-8 byte positions to character positions", () => {
      const text = "あ[[Claude Code]]い";
      // 'あ' = 3 bytes (UTF-8), 1 character (JavaScript)
      // '[' = 1 byte, 1 character
      // '[' = 1 byte, 1 character
      // 'C' starts at byte 5, char 3
      expect(byteToCharPosition(text, 0)).toBe(0); // 'あ' start
      expect(byteToCharPosition(text, 3)).toBe(1); // '[' start
      expect(byteToCharPosition(text, 5)).toBe(3); // 'C' start
      expect(byteToCharPosition(text, 11)).toBe(9); // 'C' in "Code" start
    });

    test("should handle emoji surrogate pairs correctly", () => {
      const text = "📜abcdClaude Code";
      // '📜' = 4 bytes (UTF-8), 2 characters (JavaScript - surrogate pair)
      // 'a' starts at byte 4, char 2
      // 'C' starts at byte 8, char 6
      expect(byteToCharPosition(text, 0)).toBe(0); // '📜' start
      expect(byteToCharPosition(text, 4)).toBe(2); // 'a' start
      expect(byteToCharPosition(text, 8)).toBe(6); // 'C' start
      expect(byteToCharPosition(text, 14)).toBe(12); // ' ' after "Claude"

      // Verify the slice works correctly
      expect(text.slice(6, 12)).toBe("Claude");
    });
  });

  describe("convertSubmatchesToCharPositions", () => {
    test("should convert ripgrep byte positions to JavaScript char positions", () => {
      const text = "あ[[Claude Code]]い";
      const byteSubmatches = [
        { match: { text: "Claude" }, start: 5, end: 11 }, // Byte positions from ripgrep
      ];

      const result = convertSubmatchesToCharPositions(byteSubmatches, text);

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(3); // Character position of 'C'
      expect(result[0].end).toBe(9); // Character position after 'e' in "Claude"
      expect(result[0].match.text).toBe("Claude");

      // Verify the slice works correctly
      expect(text.slice(result[0].start, result[0].end)).toBe("Claude");
    });

    test("should handle emoji in ripgrep conversion", () => {
      const text = "📜abcdClaude Code";
      const byteSubmatches = [
        { match: { text: "Claude" }, start: 8, end: 14 }, // Byte positions from ripgrep
      ];

      const result = convertSubmatchesToCharPositions(byteSubmatches, text);

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(6); // Character position of 'C'
      expect(result[0].end).toBe(12); // Character position after 'e' in "Claude"
      expect(result[0].match.text).toBe("Claude");

      // Verify the slice works correctly
      expect(text.slice(result[0].start, result[0].end)).toBe("Claude");
    });
  });
});

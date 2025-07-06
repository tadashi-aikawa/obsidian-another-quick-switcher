import type { MatchResult } from "./ripgrep";

/**
 * Convert UTF-8 byte position to JavaScript string character position
 * Handles Unicode code points correctly (including emoji surrogate pairs)
 */
export function byteToCharPosition(text: string, bytePos: number): number {
  const textBytes = Buffer.from(text, "utf8");
  if (bytePos >= textBytes.length) return text.length;

  // Use Unicode code points for accurate counting
  const codePoints = [...text];
  let currentBytePos = 0;
  let jsCharPos = 0; // JavaScript UTF-16 character position

  for (let i = 0; i < codePoints.length; i++) {
    const codePoint = codePoints[i];
    const codePointBytes = Buffer.from(codePoint, "utf8").length;

    if (currentBytePos + codePointBytes > bytePos) {
      // This byte position is in the middle of a code point
      // Return the start of this code point
      break;
    }

    currentBytePos += codePointBytes;

    // In JavaScript, emoji (and other high code points) take 2 UTF-16 code units
    jsCharPos += codePoint.length;

    if (currentBytePos >= bytePos) {
      break;
    }
  }

  return jsCharPos;
}

/**
 * Convert ripgrep submatches from byte positions to character positions
 */
export function convertSubmatchesToCharPositions(
  submatches: MatchResult["data"]["submatches"],
  text: string,
): MatchResult["data"]["submatches"] {
  return submatches.map((submatch) => ({
    ...submatch,
    start: byteToCharPosition(text, submatch.start),
    end: byteToCharPosition(text, submatch.end),
  }));
}

/**
 * Remove duplicate submatches (same start/end positions) to prevent duplicate highlighting
 * Does NOT merge adjacent different matches like "Claude" + "opilot"
 */
export function mergeOverlappingSubmatches(
  submatches: MatchResult["data"]["submatches"],
  originalText?: string,
): MatchResult["data"]["submatches"] {
  if (submatches.length <= 1) return submatches;

  // Sort by start position and filter out invalid ranges
  const sorted = [...submatches]
    .filter((submatch) => {
      // Skip invalid ranges
      if (!originalText) return true;
      return (
        submatch.start >= 0 &&
        submatch.end <= originalText.length &&
        submatch.start < submatch.end
      );
    })
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) return [];

  const deduplicated: MatchResult["data"]["submatches"] = [];

  for (const current of sorted) {
    // Check if we already have a match with the same range
    const isDuplicate = deduplicated.some(
      (existing) =>
        existing.start === current.start && existing.end === current.end,
    );

    if (!isDuplicate) {
      deduplicated.push(current);
    }
  }

  return deduplicated;
}

/**
 * Merge multiple ripgrep results with AND logic.
 * Only returns results that appear in all search results for the same file and line.
 */
export function mergeAndFilterResults(
  allResults: MatchResult[][],
): MatchResult[] {
  if (allResults.length === 0) return [];
  if (allResults.length === 1) return allResults[0];

  // Create a map: "filepath:linenumber" -> MatchResult[]
  const resultsByLocation = new Map<string, MatchResult[]>();

  // Collect all results by location
  for (let i = 0; i < allResults.length; i++) {
    const results = allResults[i];
    for (const result of results) {
      const key = `${result.data.path.text}:${result.data.line_number}`;
      if (!resultsByLocation.has(key)) {
        resultsByLocation.set(key, []);
      }
      resultsByLocation.get(key)!.push(result);
    }
  }

  // Filter: only keep locations that have results from ALL queries
  const mergedResults: MatchResult[] = [];
  for (const [key, locationResults] of resultsByLocation) {
    if (locationResults.length === allResults.length) {
      // This location has results from all queries
      // Merge submatches from all results
      const firstResult = locationResults[0];
      const mergedSubmatches = locationResults.flatMap(
        (r) => r.data.submatches,
      );

      mergedResults.push({
        ...firstResult,
        data: {
          ...firstResult.data,
          submatches: mergedSubmatches,
        },
      });
    }
  }

  return mergedResults;
}

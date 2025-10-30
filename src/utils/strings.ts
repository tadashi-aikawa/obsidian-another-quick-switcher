import diacriticsMap from "./diacritics-map";

type Range = { start: number; end: number };

const regEmoji = new RegExp(
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: <explanation>
  /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|[\uFE0E-\uFE0F]/,
  "g",
);

export function excludeSpace(text: string): string {
  return text.replace(/ /g, "");
}

export function excludeEmoji(text: string): string {
  return text.replace(regEmoji, "");
}

export function normalizeAccentsDiacritics(text: string): string {
  // https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
  // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
  return text.replace(/[^\u0000-\u007E]/g, (x) => diacriticsMap[x] ?? x);
}

function normalize(str: string, isNormalizeAccentsDiacritics: boolean): string {
  const t = str.toLowerCase();
  return isNormalizeAccentsDiacritics ? normalizeAccentsDiacritics(t) : t;
}

// Refer https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^=!:${}()|[\]\/\\]/g, "\\$&");
}

export function includes(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  return normalize(text, isNormalizeAccentsDiacritics).includes(
    normalize(query, isNormalizeAccentsDiacritics),
  );
}

function normalizeChar(
  char: string,
  isNormalizeAccentsDiacritics: boolean,
): string {
  const lowerChar = char.toLowerCase();
  if (!isNormalizeAccentsDiacritics) {
    return lowerChar;
  }

  const code = lowerChar.charCodeAt(0);
  if (code <= 0x007e) {
    return lowerChar;
  }

  return diacriticsMap[lowerChar] ?? lowerChar;
}

function buildNormalizationMap(
  text: string,
  isNormalizeAccentsDiacritics: boolean,
  normalizedLength: number,
): number[] {
  const map = new Array<number>(normalizedLength);
  let cursor = 0;

  for (let i = 0; i < text.length; i++) {
    const normalizedChar = normalizeChar(text[i], isNormalizeAccentsDiacritics);
    for (let j = 0; j < normalizedChar.length; j++) {
      map[cursor++] = i;
    }
  }

  return map;
}

export function includesWithRange(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): { start: number; end: number } | null {
  const normalizedText = normalize(text, isNormalizeAccentsDiacritics);
  const normalizedQuery = normalize(query, isNormalizeAccentsDiacritics);

  if (normalizedQuery.length === 0) {
    return { start: 0, end: -1 };
  }

  const startIndex = normalizedText.indexOf(normalizedQuery);
  if (startIndex === -1) {
    return null;
  }

  const map = buildNormalizationMap(
    text,
    isNormalizeAccentsDiacritics,
    normalizedText.length,
  );
  const endIndex = startIndex + normalizedQuery.length - 1;
  return {
    start: map[startIndex],
    end: map[endIndex],
  };
}

export function capitalIncludes(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  if (!hasCapitalLetter(query)) {
    return includes(text, query, isNormalizeAccentsDiacritics);
  }

  return isNormalizeAccentsDiacritics
    ? normalizeAccentsDiacritics(text).includes(
        normalizeAccentsDiacritics(query),
      )
    : text.includes(query);
}

export function smartIncludes(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  return excludeSpace(normalize(text, isNormalizeAccentsDiacritics)).includes(
    excludeSpace(normalize(query, isNormalizeAccentsDiacritics)),
  );
}

export function smartStartsWith(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  return excludeSpace(
    excludeEmoji(normalize(text, isNormalizeAccentsDiacritics)),
  ).startsWith(excludeSpace(normalize(query, isNormalizeAccentsDiacritics)));
}

export function smartEquals(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  return (
    excludeSpace(
      excludeEmoji(normalize(text, isNormalizeAccentsDiacritics)),
    ) === normalize(query, isNormalizeAccentsDiacritics)
  );
}

export function excludeFormat(text: string): string {
  return text
    .replace(/\[\[[^\]]+\|(.*?)]]/g, "$1")
    .replace(/\[\[([^\]]+)]]/g, "$1")
    .replace(/\[([^\]]+)]\(https?[^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/<[^>]+>([^<]+)<\/[^>]+>/g, "$1");
}

export function smartCommaSplit(text: string): string[] {
  return text.split(",").filter((x) => x);
}

export function smartLineBreakSplit(text: string): string[] {
  return text.split("\n").filter((x) => x);
}

export function smartWhitespaceSplit(text: string): string[] {
  const strs = [];
  let str = "";
  let hasQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    switch (ch) {
      case "\\":
        // Handle escaped characters
        if (nextCh === '"') {
          str += '"';
          i++; // Skip the next character (the escaped quote)
        } else {
          str += ch;
        }
        break;
      case '"':
        hasQuote = !hasQuote;
        break;
      case " ":
        if (hasQuote) {
          str += ch;
        } else {
          strs.push(str);
          str = "";
        }
        break;
      default:
        str += ch;
    }
  }

  strs.push(str);

  return strs.filter((x) => x);
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function hasCapitalLetter(str: string) {
  return str.toLowerCase() !== str;
}

export type FuzzyResult =
  | { type: "starts-with"; score: number; ranges?: Range[] }
  | { type: "includes"; score: number; ranges?: Range[] }
  | { type: "fuzzy"; score: number; ranges?: Range[] }
  | { type: "none"; score: number; ranges?: Range[] };

/**
 * Performs fuzzy matching on strings with emoji normalization.
 *
 * **Performance-optimized implementation**: This function prioritizes speed over code
 * readability, using low-level constructs like indexed loops, `indexOf` instead of
 * `includes`, and mutable state to minimize allocations and function calls.
 *
 * **Important**: This function operates on emoji-removed text for performance.
 * Position ranges in the result refer to positions in the emoji-removed string,
 * not the original string with emojis.
 *
 * For example:
 * - `microFuzzy("📝memo", "memo")` returns ranges based on "memo" (emoji removed)
 * - `microFuzzy("📝memo", "📝")` treats "📝memo" as "memo" and won't match "📝"
 *
 * Use `smartMicroFuzzy` if you need accurate positions in the original string
 * with proper emoji handling.
 *
 * @param value - The string to search in
 * @param query - The search query
 * @returns FuzzyResult with ranges based on emoji-removed coordinates
 */
export function microFuzzy(value: string, query: string): FuzzyResult {
  if (value.startsWith(query)) {
    return {
      type: "starts-with",
      score: 2 ** query.length / value.length,
      ranges: [{ start: 0, end: query.length - 1 }],
    };
  }
  const emojiLessValue = excludeEmoji(value);
  if (emojiLessValue.startsWith(query)) {
    return {
      type: "starts-with",
      score: 2 ** query.length / value.length,
      ranges: [{ start: 0, end: query.length - 1 }],
    };
  }

  const includesIndex = value.indexOf(query);
  if (includesIndex !== -1) {
    return {
      type: "includes",
      score: 2 ** query.length / value.length,
      ranges: [{ start: includesIndex, end: includesIndex + query.length - 1 }],
    };
  }

  let i = 0;
  let scoreSeed = 0;
  let combo = 0;
  const ranges: Range[] = [];
  let rangeStart = -1;

  for (let j = 0; j < emojiLessValue.length; j++) {
    if (emojiLessValue[j] === query[i]) {
      if (combo === 0) {
        rangeStart = j;
      }
      combo++;
      i++;
    } else {
      if (combo > 0) {
        scoreSeed += 2 ** combo;
        ranges.push({ start: rangeStart, end: rangeStart + combo - 1 });
        combo = 0;
      }
    }
    if (i === query.length) {
      if (combo > 0) {
        scoreSeed += 2 ** combo;
        ranges.push({ start: rangeStart, end: rangeStart + combo - 1 });
      }
      return {
        type: "fuzzy",
        score: scoreSeed / value.length,
        ranges: ranges,
      };
    }
  }

  return { type: "none", score: 0 };
}

/**
 * Performs advanced fuzzy matching with accurate position mapping.
 *
 * **Performance-optimized implementation**: Like `microFuzzy`, this function uses
 * low-level optimizations including mutable state, indexed loops, and side effects
 * within callbacks to achieve maximum performance for large-scale search operations.
 *
 * Unlike `microFuzzy`, this function returns position ranges that correspond
 * to the original string with emojis and spaces intact. It handles:
 * - Emoji positioning with proper UTF-16 surrogate pair consideration
 * - Space normalization with position mapping back to original coordinates
 * - Mixed emoji+text queries with appropriate scoring
 *
 * For example:
 * - `smartMicroFuzzy("📝memo", "memo", false)` returns ranges [2, 5] (after emoji)
 * - `smartMicroFuzzy("📝memo", "📝", false)` returns ranges [0, 1] (emoji position)
 * - `smartMicroFuzzy("Insert mode", "insertmode", false)` handles space removal
 *
 * Use this function when you need accurate positions for UI highlighting.
 * Use `microFuzzy` for performance-critical search operations.
 *
 * @param text - The string to search in
 * @param query - The search query
 * @param isNormalizeAccentsDiacritics - Whether to normalize accents/diacritics
 * @returns FuzzyResult with ranges based on original string coordinates
 */
export function smartMicroFuzzy(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): FuzzyResult {
  const normalizedText = normalize(text, isNormalizeAccentsDiacritics);
  const spaceRemovedText = excludeSpace(normalizedText);
  const emojiRemovedSpaceRemovedText = excludeEmoji(spaceRemovedText);
  const spaceRemovedQuery = excludeSpace(
    normalize(query, isNormalizeAccentsDiacritics),
  );
  const emojiRemovedSpaceRemovedQuery = excludeEmoji(spaceRemovedQuery);

  // Special case: if query became empty after emoji removal, check if original text starts with the query
  if (emojiRemovedSpaceRemovedQuery === "" && spaceRemovedQuery !== "") {
    // This is an emoji-only query
    if (spaceRemovedText.startsWith(spaceRemovedQuery)) {
      // Calculate the character length (not byte length) of the emoji query
      const emojiCharLength = Array.from(spaceRemovedQuery).length;
      return {
        type: "starts-with",
        score: 0.25,
        ranges: [{ start: 0, end: emojiCharLength }],
      };
    }
    if (spaceRemovedText.includes(spaceRemovedQuery)) {
      const index = spaceRemovedText.indexOf(spaceRemovedQuery);
      const emojiCharLength = Array.from(spaceRemovedQuery).length;
      return {
        type: "includes",
        score: 0.5,
        ranges: [{ start: index, end: index + emojiCharLength }],
      };
    }
    return { type: "none", score: 0 };
  }

  // microFuzzy operates on the emoji-removed, space-removed text
  const result = microFuzzy(
    emojiRemovedSpaceRemovedText,
    emojiRemovedSpaceRemovedQuery,
  );

  // If no ranges, return as-is
  if (!result.ranges) {
    return result;
  }

  // Check if this query contains emoji and text, and if the original text starts with the full query
  if (
    spaceRemovedQuery !== emojiRemovedSpaceRemovedQuery &&
    spaceRemovedText.startsWith(spaceRemovedQuery)
  ) {
    // This is a mixed emoji+text query that matches at the start - boost the score
    const charLength = Array.from(spaceRemovedQuery).length;
    return {
      type: "starts-with",
      score: result.score * 2, // Boost score for exact prefix match with emoji
      ranges: [{ start: 0, end: charLength }],
    };
  }

  // Map positions from emoji-removed space-removed text back to original text
  const mappedRanges: Range[] = [];

  // Create position mapping: emojiRemovedSpaceRemovedText -> spaceRemovedText -> originalText
  // Use the same approach as excludeEmoji to build mapping
  const emojiToSpaceRemovedMap: number[] = [];
  let j = 0;
  spaceRemovedText.replace(regEmoji, (match, offset) => {
    // Skip the range covered by the emoji
    const startOffset = offset;
    const endOffset = offset + match.length;
    // Map all non-emoji characters before this emoji
    for (let i = j; i < startOffset; i++) {
      emojiToSpaceRemovedMap[emojiToSpaceRemovedMap.length] = i;
    }
    j = endOffset;
    return "";
  });

  // Map remaining characters after the last emoji
  for (let i = j; i < spaceRemovedText.length; i++) {
    emojiToSpaceRemovedMap[emojiToSpaceRemovedMap.length] = i;
  }

  const spaceRemovedToOriginalMap: number[] = [];
  for (let i = 0, j = 0; i < normalizedText.length; i++) {
    if (normalizedText[i] !== " ") {
      spaceRemovedToOriginalMap[j] = i;
      j++;
    }
  }

  for (const range of result.ranges) {
    // Map from emoji-removed position to space-removed position to original position
    const startInSpaceRemoved = emojiToSpaceRemovedMap[range.start];
    let endInSpaceRemoved: number | undefined;

    if (range.start === range.end) {
      // Zero-length range - point at the same position
      endInSpaceRemoved = startInSpaceRemoved;
    } else {
      endInSpaceRemoved = emojiToSpaceRemovedMap[range.end - 1];
    }

    if (startInSpaceRemoved === undefined || endInSpaceRemoved === undefined) {
      continue; // Skip if mapping failed
    }

    const startInOriginal = spaceRemovedToOriginalMap[startInSpaceRemoved];
    let endInOriginal: number | undefined;

    if (range.start === range.end) {
      // Zero-length range
      endInOriginal = startInOriginal;
    } else {
      endInOriginal = spaceRemovedToOriginalMap[endInSpaceRemoved] + 1;
    }

    if (startInOriginal === undefined || endInOriginal === undefined) {
      continue; // Skip if mapping failed
    }

    // Split ranges that span across spaces
    let currentStart = startInOriginal;
    for (let i = startInOriginal; i <= endInOriginal; i++) {
      if (normalizedText[i] === " ") {
        // Found a space, close current range and start new one after space
        if (i > currentStart) {
          mappedRanges.push({ start: currentStart, end: i - 1 });
        }
        // Skip spaces and find next non-space character
        while (i <= endInOriginal && normalizedText[i] === " ") {
          i++;
        }
        currentStart = i;
        i--; // Adjust for loop increment
      }
    }

    // Add final range if there's remaining content
    if (currentStart <= endInOriginal) {
      mappedRanges.push({ start: currentStart, end: endInOriginal });
    }
  }

  return {
    ...result,
    ranges: mappedRanges,
  };
}

export function trimLineByEllipsis(text: string, max: number): string {
  return text.length > max * 2
    ? `${text.slice(0, max)} ... ${text.slice(text.length - max)}`
    : text;
}

/**
 * Get the results of pattern matching with one type of pattern as a list of strings and positions.
 */
export function getSinglePatternMatchingLocations(
  text: string,
  pattern: RegExp,
): {
  text: string;
  range: Range;
}[] {
  return Array.from(text.matchAll(pattern)).map((x) => ({
    text: x[0],
    range: {
      start: x.index!,
      end: x.index! + x[0].length - 1,
    },
  }));
}

/**
 * Check if a string is a valid regular expression pattern
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch (e) {
    return false;
  }
}

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
    switch (ch) {
      case `"`:
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
  | { type: "starts-with"; score: number }
  | { type: "includes"; score: number }
  | { type: "fuzzy"; score: number }
  | { type: "none"; score: number };

export function microFuzzy(value: string, query: string): FuzzyResult {
  if (value.startsWith(query)) {
    return { type: "starts-with", score: 2 ** query.length / value.length };
  }
  const emojiLessValue = excludeEmoji(value);
  if (emojiLessValue.startsWith(query)) {
    return { type: "starts-with", score: 2 ** query.length / value.length };
  }

  if (value.includes(query)) {
    return { type: "includes", score: 2 ** query.length / value.length };
  }

  let i = 0;
  let scoreSeed = 0;
  let combo = 0;
  for (let j = 0; j < emojiLessValue.length; j++) {
    if (emojiLessValue[j] === query[i]) {
      combo++;
      i++;
    } else {
      if (combo > 0) {
        scoreSeed += 2 ** combo;
        combo = 0;
      }
    }
    if (i === query.length) {
      if (combo > 0) {
        scoreSeed += 2 ** combo;
      }
      return { type: "fuzzy", score: scoreSeed / value.length };
    }
  }

  return { type: "none", score: 0 };
}

export function smartMicroFuzzy(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean,
): FuzzyResult {
  return microFuzzy(
    excludeSpace(normalize(text, isNormalizeAccentsDiacritics)),
    excludeSpace(normalize(query, isNormalizeAccentsDiacritics)),
  );
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

import diacriticsMap from "./diacritics-map";

const regEmoji = new RegExp(
  /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|[\uFE0E-\uFE0F]/,
  "g"
);

export function excludeSpace(text: string): string {
  return text.replace(/ /g, "");
}

export function excludeEmoji(text: string): string {
  return text.replace(regEmoji, "");
}

export function normalizeAccentsDiacritics(text: string): string {
  // https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
  return text.replace(/[^\u0000-\u007E]/g, (x) => diacriticsMap[x] ?? x);
}

function normalize(str: string, isNormalizeAccentsDiacritics: boolean): string {
  const t = str.toLowerCase();
  return isNormalizeAccentsDiacritics ? normalizeAccentsDiacritics(t) : t;
}

export function smartIncludes(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  return excludeSpace(normalize(text, isNormalizeAccentsDiacritics)).includes(
    excludeSpace(normalize(query, isNormalizeAccentsDiacritics))
  );
}

export function smartStartsWith(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  return excludeSpace(
    excludeEmoji(normalize(text, isNormalizeAccentsDiacritics))
  ).startsWith(excludeSpace(normalize(query, isNormalizeAccentsDiacritics)));
}

export function smartEquals(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  return (
    excludeSpace(
      excludeEmoji(normalize(text, isNormalizeAccentsDiacritics))
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
      case ` `:
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
  isNormalizeAccentsDiacritics: boolean
): FuzzyResult {
  return microFuzzy(
    excludeSpace(normalize(text, isNormalizeAccentsDiacritics)),
    excludeSpace(normalize(query, isNormalizeAccentsDiacritics))
  );
}

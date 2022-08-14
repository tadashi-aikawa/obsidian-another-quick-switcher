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
    normalize(query, isNormalizeAccentsDiacritics)
  );
}

export function smartStartsWith(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  return excludeSpace(
    excludeEmoji(normalize(text, isNormalizeAccentsDiacritics))
  ).startsWith(normalize(query, isNormalizeAccentsDiacritics));
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

export function smartLineBreakSplit(text: string): string[] {
  return text
    .split("\n")
    .filter((x) => x)
}
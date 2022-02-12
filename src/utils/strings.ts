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

export function smartIncludes(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  let t = text.toLowerCase();
  if (isNormalizeAccentsDiacritics) {
    t = normalizeAccentsDiacritics(t);
  }

  let q = query.toLowerCase();
  if (isNormalizeAccentsDiacritics) {
    q = normalizeAccentsDiacritics(q);
  }

  return excludeSpace(t).includes(q);
}

export function smartStartsWith(
  text: string,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  let t = text.toLowerCase();
  if (isNormalizeAccentsDiacritics) {
    t = normalizeAccentsDiacritics(t);
  }

  let q = query.toLowerCase();
  if (isNormalizeAccentsDiacritics) {
    q = normalizeAccentsDiacritics(q);
  }

  return excludeSpace(excludeEmoji(t)).startsWith(q);
}

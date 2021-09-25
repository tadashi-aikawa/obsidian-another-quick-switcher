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

export function smartIncludes(text: string, query: string): boolean {
  return excludeSpace(text.toLowerCase()).includes(query.toLowerCase());
}

export function smartStartsWith(text: string, query: string): boolean {
  return excludeSpace(excludeEmoji(text.toLowerCase())).startsWith(
    query.toLowerCase()
  );
}

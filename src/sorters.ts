import { SuggestionItem } from "./matcher";

function compare<T, U extends number | string>(
  a: T,
  b: T,
  toOrdered: (t: T) => U,
  order: "asc" | "desc" = "asc"
): -1 | 0 | 1 {
  const oA = toOrdered(a);
  const oB = toOrdered(b);
  if (oA === oB) {
    return 0;
  }

  switch (order) {
    case "asc":
      if (oA > oB) {
        return 1;
      }
      if (oB > oA) {
        return -1;
      }
      return 0;
    case "desc":
      if (oA < oB) {
        return 1;
      }
      if (oB < oA) {
        return -1;
      }
      return 0;
  }
}

export function priorityToPerfectWord(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x: SuggestionItem) =>
      x.matchResults.filter((x) => x.type === "word-perfect").length,
    "desc"
  );
}

export function priorityToPrefixName(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => x.matchResults.filter((x) => x.type === "prefix-name").length,
    "desc"
  );
}

export function priorityToName(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) =>
      x.matchResults.filter(
        (x) => x.type === "name" || x.type === "prefix-name"
      ).length,
    "desc"
  );
}

export function priorityToLength(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) =>
      x.matchResults[0].alias
        ? x.matchResults[0].alias.length
        : x.file.name.length,
    "asc"
  );
}

export function priorityToLastOpened(
  a: SuggestionItem,
  b: SuggestionItem,
  lastOpenFileIndexByPath: { [path: string]: number }
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => lastOpenFileIndexByPath[x.file.path] ?? 999999,
    "asc"
  );
}

export function priorityToLastModified(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(a, b, (x) => x.file.stat.mtime, "desc");
}

import { SuggestionItem } from "./matcher";

export function normalSort(
  items: SuggestionItem[],
  lastOpenFileIndexByPath: { [path: string]: number }
): SuggestionItem[] {
  return items.sort((a, b) => {
    let result: 0 | -1 | 1;

    result = priorityToPerfectWord(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToPrefixName(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToName(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToLength(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastOpened(a, b, lastOpenFileIndexByPath);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastModified(a, b);
    if (result !== 0) {
      return result;
    }

    return 0;
  });
}

export function recentSort(
  items: SuggestionItem[],
  lastOpenFileIndexByPath: { [path: string]: number }
): SuggestionItem[] {
  return items.sort((a, b) => {
    let result: 0 | -1 | 1;

    result = priorityToLastOpened(a, b, lastOpenFileIndexByPath);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastModified(a, b);
    if (result !== 0) {
      return result;
    }

    return 0;
  });
}

export function fileNameRecentSort(
  items: SuggestionItem[],
  lastOpenFileIndexByPath: { [path: string]: number }
): SuggestionItem[] {
  return items.sort((a, b) => {
    let result: 0 | -1 | 1;

    result = priorityToPerfectWord(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToName(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastOpened(a, b, lastOpenFileIndexByPath);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastModified(a, b);
    if (result !== 0) {
      return result;
    }

    return 0;
  });
}

export function starRecentSort(
  items: SuggestionItem[],
  lastOpenFileIndexByPath: { [path: string]: number }
): SuggestionItem[] {
  return items.sort((a, b) => {
    let result: 0 | -1 | 1;

    result = priorityToStar(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastOpened(a, b, lastOpenFileIndexByPath);
    if (result !== 0) {
      return result;
    }

    result = priorityToLastModified(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToPerfectWord(a, b);
    if (result !== 0) {
      return result;
    }

    result = priorityToName(a, b);
    if (result !== 0) {
      return result;
    }

    return 0;
  });
}

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

function priorityToPerfectWord(
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

function priorityToPrefixName(
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

function priorityToName(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
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

function priorityToLength(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
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

function priorityToLastOpened(
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

function priorityToLastModified(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(a, b, (x) => x.file.stat.mtime, "desc");
}

function priorityToStar(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
  return compare(a, b, (x) => Number(x.starred), "desc");
}

import { SuggestionItem } from "./matcher";

export const sortPriorityList = [
  "Header match",
  "Last modified",
  "Last opened",
  "Length",
  "Link match",
  "Name match",
  "Perfect word match",
  "Prefix name match",
  "Star",
  "Tag match",
] as const;
export type SortPriority = typeof sortPriorityList[number];

function getComparator(
  priority: SortPriority
): (
  a: SuggestionItem,
  b: SuggestionItem,
  lastOpenFileIndexByPath: { [path: string]: number }
) => 0 | -1 | 1 {
  switch (priority) {
    case "Header match":
      return priorityToHeader;
    case "Last modified":
      return priorityToLastModified;
    case "Last opened":
      return priorityToLastOpened;
    case "Length":
      return priorityToLength;
    case "Link match":
      return priorityToLink;
    case "Name match":
      return priorityToName;
    case "Perfect word match":
      return priorityToPerfectWord;
    case "Prefix name match":
      return priorityToPrefixName;
    case "Star":
      return priorityToStar;
    case "Tag match":
      return priorityToTag;
    default:
      throw Error(`Unexpected priority: ${priority}`);
  }
}

export function sort(
  items: SuggestionItem[],
  priorities: SortPriority[],
  lastOpenFileIndexByPath: { [path: string]: number }
): SuggestionItem[] {
  return items.sort((a, b) => {
    let result: 0 | -1 | 1;

    for (const priority of priorities) {
      result = getComparator(priority)(a, b, lastOpenFileIndexByPath);
      if (result !== 0) {
        return result;
      }
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
    (x) =>
      x.matchResults.filter((x) =>
        ["prefix-name", "word-perfect"].includes(x.type)
      ).length,
    "desc"
  );
}

function priorityToName(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) =>
      x.matchResults.filter((x) =>
        ["name", "prefix-name", "word-perfect"].includes(x.type)
      ).length,
    "desc"
  );
}

function priorityToTag(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => x.matchResults.filter((x) => x.type === "tag").length,
    "desc"
  );
}

function priorityToHeader(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => x.matchResults.filter((x) => x.type === "header").length,
    "desc"
  );
}

function priorityToLink(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => x.matchResults.filter((x) => x.type === "link").length,
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

import { SuggestionItem } from "./matcher";
import { intersection } from "./utils/collection-helper";

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
  "Alphabetical",
  "Alphabetical reverse",
] as const;
export type SortPriority = typeof sortPriorityList[number] | `#${string}`;
export function regardAsSortPriority(x: string) {
  return (
    sortPriorityList.includes(x as any) ||
    x.split(",").every((y) => y.startsWith("#"))
  );
}

export function filterNoQueryPriorities(
  priorities: SortPriority[]
): SortPriority[] {
  return priorities.filter(
    (x) =>
      [
        "Last opened",
        "Last modified",
        "Star",
        "Alphabetical",
        "Alphabetical reverse",
      ].includes(x) || x.startsWith("#")
  );
}

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
    case "Alphabetical":
      return priorityToAlphabetical;
    case "Alphabetical reverse":
      return priorityToAlphabeticalReverse;
    default:
      if (priority.startsWith("#")) {
        const tags = priority.split(",");
        return (a: SuggestionItem, b: SuggestionItem) =>
          priorityToTags(a, b, tags);
      }
      // XXX: xox
      throw new ExhaustiveError(priority as never);
  }
}

export function sort(
  items: SuggestionItem[],
  priorities: SortPriority[],
  lastOpenFileIndexByPath: { [path: string]: number }
): SuggestionItem[] {
  const comparators = priorities.map(getComparator);

  return items.sort((a, b) => {
    let result: 0 | -1 | 1;

    for (const comparator of comparators) {
      result = comparator(a, b, lastOpenFileIndexByPath);
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
    (x) => x.matchResults.filter((x) => x.type === "prefix-name").length,
    "desc"
  );
}

function priorityToName(a: SuggestionItem, b: SuggestionItem): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => x.matchResults.filter((x) => x.type === "name").length,
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

function priorityToAlphabetical(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => (x.matchResults[0]?.alias ? x.matchResults[0].alias : x.file.name),
    "asc"
  );
}

function priorityToAlphabeticalReverse(
  a: SuggestionItem,
  b: SuggestionItem
): 0 | -1 | 1 {
  return compare(
    a,
    b,
    (x) => (x.matchResults[0]?.alias ? x.matchResults[0].alias : x.file.name),
    "desc"
  );
}

function priorityToTags(
  a: SuggestionItem,
  b: SuggestionItem,
  tags: string[]
): 0 | -1 | 1 {
  return compare(a, b, (x) => intersection([tags, x.tags]).length, "desc");
}

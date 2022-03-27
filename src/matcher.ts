import { TFile } from "obsidian";
import { smartIncludes, smartStartsWith } from "./utils/strings";
import { minBy } from "./utils/collection-helper";

type MatchType = "not found" | "name" | "prefix-name" | "directory" | "tag";

export interface SuggestionItem {
  file: TFile;
  tags: string[];
  aliases: string[];
  matchResults: MatchQueryResult[];
  phantom: boolean;
}

interface MatchQueryResult {
  type: MatchType;
  alias?: string;
  hitWord?: string;
  meta?: string[];
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): MatchQueryResult {
  // tag
  if (query.startsWith("#")) {
    const tags = item.tags.filter((tag) =>
      smartIncludes(tag.slice(1), query.slice(1), isNormalizeAccentsDiacritics)
    );
    return {
      type: tags.length > 0 ? "tag" : "not found",
      meta: tags,
    };
  }

  const qs = query.split("/");
  const file = qs.pop()!;
  const includeDir = qs.every((dir) =>
    smartIncludes(item.file.parent.path, dir, isNormalizeAccentsDiacritics)
  );
  if (!includeDir) {
    return { type: "not found" };
  }

  if (smartStartsWith(item.file.name, file, isNormalizeAccentsDiacritics)) {
    return { type: "prefix-name", meta: [item.file.name] };
  }
  const prefixNameMatchedAliases = item.aliases.filter((x) =>
    smartStartsWith(x, file, isNormalizeAccentsDiacritics)
  );
  if (prefixNameMatchedAliases.length > 0) {
    return {
      type: "prefix-name",
      meta: prefixNameMatchedAliases,
      alias: minBy(prefixNameMatchedAliases, (x) => x.length),
    };
  }

  if (smartIncludes(item.file.name, file, isNormalizeAccentsDiacritics)) {
    return { type: "name", meta: [item.file.name] };
  }
  const nameMatchedAliases = item.aliases.filter((x) =>
    smartIncludes(x, file, isNormalizeAccentsDiacritics)
  );
  if (nameMatchedAliases.length > 0) {
    return {
      type: "name",
      meta: nameMatchedAliases,
      alias: minBy(nameMatchedAliases, (x) => x.length),
    };
  }

  if (smartIncludes(item.file.path, file, isNormalizeAccentsDiacritics)) {
    return { type: "directory", meta: [item.file.path] };
  }

  const tags = item.tags.filter((tag) =>
    smartIncludes(tag.slice(1), query, isNormalizeAccentsDiacritics)
  );
  if (tags.length > 0) {
    return {
      type: "tag",
      meta: tags,
    };
  }

  return { type: "not found" };
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  isNormalizeAccentsDiacritics: boolean
): MatchQueryResult[] {
  return queries.map((q) => matchQuery(item, q, isNormalizeAccentsDiacritics));
}

export function stampMatchResults(
  item: SuggestionItem,
  queries: string[],
  isNormalizeAccentsDiacritics: boolean
): SuggestionItem {
  return {
    ...item,
    matchResults: matchQueryAll(item, queries, isNormalizeAccentsDiacritics),
  };
}

import { TFile } from "obsidian";
import { smartEquals, smartIncludes, smartMicroFuzzy } from "./utils/strings";
import { minBy } from "./utils/collection-helper";
import { isPresent } from "./utils/types";

type MatchType =
  | "not found"
  | "name"
  | "prefix-name"
  | "fuzzy-name"
  | "word-perfect"
  | "directory"
  | "header"
  | "link"
  | "property"
  | "tag";

export interface SuggestionItem {
  file: TFile;
  tags: string[];
  aliases: string[];
  headers: string[];
  links: string[];
  frontMatter?: { [key: string]: string | number | string[] | number[] };
  matchResults: MatchQueryResult[];
  phantom: boolean;
  starred: boolean;
  tokens: string[];
  order?: number;
}

interface MatchQueryResult {
  type: MatchType;
  alias?: string;
  query: string;
  meta?: string[];
  score?: number;
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  options: {
    searchByTags: boolean;
    searchByHeaders: boolean;
    searchByLinks: boolean;
    keysOfPropertyToSearch: string[];
    isNormalizeAccentsDiacritics: boolean;
    fuzzyTarget: boolean;
    minFuzzyScore: number;
  }
): MatchQueryResult[] {
  const {
    searchByTags,
    searchByHeaders,
    searchByLinks,
    keysOfPropertyToSearch,
    isNormalizeAccentsDiacritics,
  } = options;

  // tag
  if (searchByTags && query.startsWith("#")) {
    const tags = item.tags.filter((tag) =>
      smartIncludes(tag.slice(1), query.slice(1), isNormalizeAccentsDiacritics)
    );
    return [
      {
        type: tags.length > 0 ? "tag" : "not found",
        meta: tags,
        query,
      },
    ];
  }

  const qs = query.split("/");
  const file = qs.pop()!;
  const dirs = qs;
  const includeDir = dirs.every((dir) =>
    smartIncludes(item.file.parent?.path!, dir, isNormalizeAccentsDiacritics)
  );
  if (!includeDir) {
    return [{ type: "not found", query }];
  }
  if (file.length === 0) {
    return [{ type: "directory", meta: [item.file.path], query }];
  }

  let results: MatchQueryResult[] = [];

  if (
    item.tokens.some((t) => smartEquals(t, file, isNormalizeAccentsDiacritics))
  ) {
    results.push({ type: "word-perfect", meta: [item.file.name], query });
  }

  // noinspection FallThroughInSwitchStatementJS
  const fuzzyResult = smartMicroFuzzy(
    item.file.extension === "md" ? item.file.basename : item.file.name, // Should calculate the score without .md
    query,
    isNormalizeAccentsDiacritics
  );
  switch (fuzzyResult.type) {
    case "starts-with":
      results.push({ type: "prefix-name", meta: [item.file.name], query });
    case "includes":
      results.push({ type: "name", meta: [item.file.name], query });
    case "fuzzy":
      if (options.fuzzyTarget) {
        if (fuzzyResult.score > options.minFuzzyScore) {
          results.push({
            type: "fuzzy-name",
            meta: [item.file.name],
            query,
            score: fuzzyResult.score,
          });
        }
      }
  }

  const prefixNameMatchedAliases: string[] = [];
  const nameMatchedAliases: string[] = [];
  const fuzzyNameMatchedAliases: { value: string; score: number }[] = [];
  for (let al of item.aliases) {
    const r = smartMicroFuzzy(al, file, isNormalizeAccentsDiacritics);
    // noinspection FallThroughInSwitchStatementJS
    switch (r.type) {
      case "starts-with":
        prefixNameMatchedAliases.push(al);
      case "includes":
        nameMatchedAliases.push(al);
      case "fuzzy":
        if (options.fuzzyTarget) {
          if (r.score > options.minFuzzyScore) {
            fuzzyNameMatchedAliases.push({
              value: al,
              score: r.score,
            });
          }
        }
    }
  }

  if (prefixNameMatchedAliases.length > 0) {
    results.push({
      type: "prefix-name",
      meta: prefixNameMatchedAliases,
      alias: minBy(prefixNameMatchedAliases, (x) => x.length),
      query,
    });
  }
  if (nameMatchedAliases.length > 0) {
    results.push({
      type: "name",
      meta: nameMatchedAliases,
      alias: minBy(nameMatchedAliases, (x) => x.length),
      query,
    });
  }
  if (options.fuzzyTarget && fuzzyNameMatchedAliases.length > 0) {
    const m = minBy(fuzzyNameMatchedAliases, (x) => x.score);
    results.push({
      type: "fuzzy-name",
      meta: fuzzyNameMatchedAliases.map((x) => x.value),
      alias: m.value,
      score: m.score,
      query,
    });
  }

  if (
    smartIncludes(item.file.parent?.path!, query, isNormalizeAccentsDiacritics)
  ) {
    results.push({ type: "directory", meta: [item.file.path], query });
  }

  if (searchByHeaders) {
    const headers = item.headers.filter((header) =>
      smartIncludes(header, query, isNormalizeAccentsDiacritics)
    );
    if (headers.length > 0) {
      results.push({
        type: "header",
        meta: headers,
        query,
      });
    }
  }

  if (searchByLinks) {
    const links = item.links.filter((link) =>
      smartIncludes(link, query, isNormalizeAccentsDiacritics)
    );
    if (links.length > 0) {
      results.push({
        type: "link",
        meta: links,
        query,
      });
    }
  }

  if (searchByTags) {
    const tags = item.tags.filter((tag) =>
      smartIncludes(tag.slice(1), query, isNormalizeAccentsDiacritics)
    );
    if (tags.length > 0) {
      results.push({
        type: "tag",
        meta: tags,
        query,
      });
    }
  }

  if (keysOfPropertyToSearch.length > 0) {
    const values = keysOfPropertyToSearch
      .map((x) => item.frontMatter?.[x]?.toString())
      .filter((x) => x && smartIncludes(x, query, isNormalizeAccentsDiacritics))
      .filter(isPresent);
    if (values.length > 0) {
      results.push({
        type: "property",
        meta: values,
        query,
      });
    }
  }

  return results.length === 0 ? [{ type: "not found", query }] : results;
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  options: {
    searchByTags: boolean;
    searchByHeaders: boolean;
    searchByLinks: boolean;
    keysOfPropertyToSearch: string[];
    isNormalizeAccentsDiacritics: boolean;
    fuzzyTarget: boolean;
    minFuzzyScore: number;
  }
): MatchQueryResult[] {
  return queries.flatMap((q) => {
    const [query, negative] = q.startsWith("-")
      ? [q.slice(1), true]
      : [q, false];

    const matched = matchQuery(item, query, options);
    if (matched[0]?.type === "not found") {
      return negative ? [] : matched;
    } else {
      return negative ? [{ type: "not found", query }] : matched;
    }
  });
}

export function stampMatchResults(
  item: SuggestionItem,
  queries: string[],
  options: {
    searchByTags: boolean;
    searchByHeaders: boolean;
    searchByLinks: boolean;
    keysOfPropertyToSearch: string[];
    isNormalizeAccentsDiacritics: boolean;
    fuzzyTarget: boolean;
    minFuzzyScore: number;
  }
): SuggestionItem {
  return {
    ...item,
    matchResults: matchQueryAll(item, queries, options),
  };
}

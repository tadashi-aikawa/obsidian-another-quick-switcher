import type { TFile } from "obsidian";
import { minBy, uniqFlatMap } from "./utils/collection-helper";
import {
  includesWithRange,
  smartEquals,
  smartIncludes,
  smartMicroFuzzy,
} from "./utils/strings";
import type { FrontmatterProperty } from "./utils/types";

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
  frontMatter?: {
    [key: string]: FrontmatterProperty;
  };
  matchResults: MatchQueryResult[];
  phantom: boolean;
  starred: boolean;
  tokens: string[];
  order?: number;
}

export interface MatchQueryResult {
  type: MatchType;
  alias?: string;
  query: string;
  meta?: string[];
  score?: number;
  // File name match ranges for highlighting purposes (only used for name/prefix-name/fuzzy-name matches)
  ranges?: { start: number; end: number }[];
  // All alias ranges for highlighting purposes (only used for alias matches)
  allAliasRanges?: {
    alias: string;
    ranges: { start: number; end: number }[];
  }[];
  // Front matter property match ranges for highlighting purposes (only used for property matches)
  // { key: [range for value1, range for value2, ...] }
  frontMatterRanges?: {
    [key: string]: Array<{ start: number; end: number } | null>;
  };
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
  },
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
      smartIncludes(tag.slice(1), query.slice(1), isNormalizeAccentsDiacritics),
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
    !item.file.parent
      ? false
      : smartIncludes(item.file.parent.path, dir, isNormalizeAccentsDiacritics),
  );
  if (!includeDir) {
    return [{ type: "not found", query }];
  }
  if (file.length === 0) {
    return [{ type: "directory", meta: [item.file.path], query }];
  }

  const results: MatchQueryResult[] = [];

  if (
    item.tokens.some((t) => smartEquals(t, file, isNormalizeAccentsDiacritics))
  ) {
    results.push({ type: "word-perfect", meta: [item.file.name], query });
  }

  const fuzzyResult = smartMicroFuzzy(
    item.file.extension === "md" ? item.file.basename : item.file.name, // Should calculate the score without .md
    query,
    isNormalizeAccentsDiacritics,
  );
  switch (fuzzyResult.type) {
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentionally fall through
    case "starts-with":
      results.push({
        type: "prefix-name",
        meta: [item.file.name],
        query,
        ranges: fuzzyResult.ranges,
      });
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentionally fall through
    case "includes":
      results.push({
        type: "name",
        meta: [item.file.name],
        query,
        ranges: fuzzyResult.ranges,
      });
    case "fuzzy":
      if (options.fuzzyTarget) {
        if (fuzzyResult.score > options.minFuzzyScore) {
          results.push({
            type: "fuzzy-name",
            meta: [item.file.name],
            query,
            score: fuzzyResult.score,
            ranges: fuzzyResult.ranges,
          });
        }
      }
  }

  const prefixNameMatchedAliases: {
    value: string;
    ranges?: { start: number; end: number }[];
  }[] = [];
  const nameMatchedAliases: {
    value: string;
    ranges?: { start: number; end: number }[];
  }[] = [];
  const fuzzyNameMatchedAliases: {
    value: string;
    score: number;
    ranges?: { start: number; end: number }[];
  }[] = [];
  for (const al of item.aliases) {
    const r = smartMicroFuzzy(al, file, isNormalizeAccentsDiacritics);
    // noinspection FallThroughInSwitchStatementJS
    switch (r.type) {
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentionally fall through
      case "starts-with":
        prefixNameMatchedAliases.push({
          value: al,
          ranges: r.ranges,
        });
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentionally fall through
      case "includes":
        nameMatchedAliases.push({
          value: al,
          ranges: r.ranges,
        });
      case "fuzzy":
        if (options.fuzzyTarget) {
          if (r.score > options.minFuzzyScore) {
            fuzzyNameMatchedAliases.push({
              value: al,
              score: r.score,
              ranges: r.ranges,
            });
          }
        }
    }
  }

  if (prefixNameMatchedAliases.length > 0) {
    const bestMatch = minBy(prefixNameMatchedAliases, (x) => x.value.length);
    results.push({
      type: "prefix-name",
      meta: prefixNameMatchedAliases.map((x) => x.value),
      alias: bestMatch.value,
      query,
      ranges: undefined,
      allAliasRanges: prefixNameMatchedAliases.map((x) => ({
        alias: x.value,
        ranges: x.ranges || [],
      })),
    });
  }
  if (nameMatchedAliases.length > 0) {
    const bestMatch = minBy(nameMatchedAliases, (x) => x.value.length);
    results.push({
      type: "name",
      meta: nameMatchedAliases.map((x) => x.value),
      alias: bestMatch.value,
      query,
      ranges: undefined,
      allAliasRanges: nameMatchedAliases.map((x) => ({
        alias: x.value,
        ranges: x.ranges || [],
      })),
    });
  }
  if (options.fuzzyTarget && fuzzyNameMatchedAliases.length > 0) {
    const bestMatch = minBy(fuzzyNameMatchedAliases, (x) => x.score);
    results.push({
      type: "fuzzy-name",
      meta: fuzzyNameMatchedAliases.map((x) => x.value),
      alias: bestMatch.value,
      score: bestMatch.score,
      query,
      ranges: undefined,
      allAliasRanges: fuzzyNameMatchedAliases.map((x) => ({
        alias: x.value,
        ranges: x.ranges || [],
      })),
    });
  }

  if (
    item.file.parent &&
    smartIncludes(item.file.parent.path, query, isNormalizeAccentsDiacritics)
  ) {
    results.push({ type: "directory", meta: [item.file.path], query });
  }

  if (searchByHeaders) {
    const headers = item.headers.filter((header) =>
      smartIncludes(header, query, isNormalizeAccentsDiacritics),
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
      smartIncludes(link, query, isNormalizeAccentsDiacritics),
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
      smartIncludes(tag.slice(1), query, isNormalizeAccentsDiacritics),
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
    const frontMatterRanges: MatchQueryResult["frontMatterRanges"] = {};
    for (const key of keysOfPropertyToSearch) {
      const prop = item.frontMatter?.[key];
      if (!prop) {
        continue;
      }

      if (Array.isArray(prop)) {
        const ranges = prop.map((v) =>
          v == null
            ? null
            : includesWithRange(
                v.toString(),
                query,
                isNormalizeAccentsDiacritics,
              ),
        );
        if (ranges.length > 0 && ranges.some((x) => x !== null)) {
          frontMatterRanges[key] = ranges;
        }
      } else {
        const range = includesWithRange(
          prop.toString(),
          query,
          isNormalizeAccentsDiacritics,
        );
        if (range) {
          frontMatterRanges[key] = [range];
        }
      }
    }

    const keys = Object.keys(frontMatterRanges);
    if (keys.length > 0) {
      results.push({
        type: "property",
        meta: keys,
        frontMatterRanges,
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
    excludePrefix: string;
  },
): MatchQueryResult[] {
  return queries.flatMap((q) => {
    const [query, negative] =
      options.excludePrefix && q.startsWith(options.excludePrefix)
        ? [q.slice(options.excludePrefix.length), true]
        : [q, false];

    const matched = matchQuery(item, query, options);
    if (matched[0]?.type === "not found") {
      return negative ? [] : matched;
    }

    return negative ? [{ type: "not found", query }] : matched;
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
    excludePrefix: string;
  },
): SuggestionItem {
  return {
    ...item,
    matchResults: matchQueryAll(item, queries, options),
  };
}

export function getMatchedTitleAndAliases(item: SuggestionItem): {
  title?: string;
  aliases: string[];
} {
  const matchTitle = item.matchResults.find(
    (x) =>
      ["word-perfect", "prefix-name", "name", "fuzzy-name"].includes(x.type) &&
      !x.alias,
  );
  const displayedAliases = uniqFlatMap(
    item.matchResults.filter((res) => res.alias),
    (x) => x.meta ?? [],
  );
  return {
    title: matchTitle ? item.file.basename : undefined,
    aliases: displayedAliases,
  };
}

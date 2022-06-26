import { TFile } from "obsidian";
import { smartEquals, smartIncludes, smartStartsWith } from "./utils/strings";
import { minBy } from "./utils/collection-helper";

type MatchType =
  | "not found"
  | "name"
  | "prefix-name"
  | "word-perfect"
  | "directory"
  | "header"
  | "link"
  | "tag";

export interface SuggestionItem {
  file: TFile;
  tags: string[];
  aliases: string[];
  headers: string[];
  links: string[];
  matchResults: MatchQueryResult[];
  phantom: boolean;
  starred: boolean;
  tokens: string[];
  order?: number;
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
  searchByTags: boolean,
  searchByHeaders: boolean,
  searchByLinks: boolean,
  isNormalizeAccentsDiacritics: boolean
): MatchQueryResult {
  // tag
  if (searchByTags && query.startsWith("#")) {
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

  if (
    item.tokens.some((t) => smartEquals(t, file, isNormalizeAccentsDiacritics))
  ) {
    return { type: "word-perfect", meta: [item.file.name] };
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

  if (searchByHeaders) {
    const headers = item.headers.filter((header) =>
      smartIncludes(header, query, isNormalizeAccentsDiacritics)
    );
    if (headers.length > 0) {
      return {
        type: "header",
        meta: headers,
      };
    }
  }

  if (searchByLinks) {
    const links = item.links.filter((link) =>
      smartIncludes(link, query, isNormalizeAccentsDiacritics)
    );
    if (links.length > 0) {
      return {
        type: "link",
        meta: links,
      };
    }
  }

  if (searchByTags) {
    const tags = item.tags.filter((tag) =>
      smartIncludes(tag.slice(1), query, isNormalizeAccentsDiacritics)
    );
    if (tags.length > 0) {
      return {
        type: "tag",
        meta: tags,
      };
    }
  }

  return { type: "not found" };
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  searchByTags: boolean,
  searchByHeaders: boolean,
  searchByLinks: boolean,
  isNormalizeAccentsDiacritics: boolean
): MatchQueryResult[] {
  return queries.map((q) =>
    matchQuery(
      item,
      q,
      searchByTags,
      searchByHeaders,
      searchByLinks,
      isNormalizeAccentsDiacritics
    )
  );
}

export function stampMatchResults(
  item: SuggestionItem,
  queries: string[],
  searchByTags: boolean,
  searchByHeaders: boolean,
  searchByLinks: boolean,
  isNormalizeAccentsDiacritics: boolean
): SuggestionItem {
  return {
    ...item,
    matchResults: matchQueryAll(
      item,
      queries,
      searchByTags,
      searchByHeaders,
      searchByLinks,
      isNormalizeAccentsDiacritics
    ),
  };
}

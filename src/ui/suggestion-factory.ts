import { isExcalidraw } from "src/utils/path";
import { isPresent } from "src/utils/types";
import { type SuggestionItem, getMatchedTitleAndAliases } from "../matcher";
import { count, omitBy, uniq, uniqFlatMap } from "../utils/collection-helper";
import { round } from "../utils/math";
import { ALIAS, FOLDER, FRONT_MATTER, HEADER, LINK, SCORE, TAG } from "./icons";

interface Elements {
  itemDiv: HTMLDivElement;
  metaDiv?: HTMLDivElement;
  descriptionDiv?: HTMLDivElement;
}

interface Options {
  showFrontMatter: boolean;
  excludeFrontMatterKeys: string[];
  showDirectory: boolean;
  showDirectoryAtNewLine: boolean;
  showFullPathOfDirectory: boolean;
  displayAliasAsTitleOnKeywordMatched: boolean;
  displayAliaseAsTitle: boolean;
  hideGutterIcons: boolean;
  showFuzzyMatchScore: boolean;
  displayDescriptionBelowTitle: boolean;
}

/**
 * Merges overlapping or adjacent ranges into consolidated ranges.
 */
function mergeRanges(
  ranges: { start: number; end: number }[],
): { start: number; end: number }[] {
  if (ranges.length === 0) return [];

  // Sort ranges by start position
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if ranges overlap or are adjacent
    if (next.start <= current.end + 1) {
      // Merge ranges
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
      };
    } else {
      // No overlap, push current and move to next
      merged.push(current);
      current = next;
    }
  }

  // Push the last range
  merged.push(current);
  return merged;
}

/**
 * Creates text content with highlighted portions based on given ranges.
 * Returns DocumentFragment containing text nodes and highlighted spans.
 */
function createHighlightedText(
  text: string,
  ranges?: { start: number; end: number }[],
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (!ranges || ranges.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Merge overlapping ranges to avoid duplicate highlighting
  const mergedRanges = mergeRanges(ranges);

  let lastEnd = -1;

  for (const range of mergedRanges) {
    // Add text before this range
    if (range.start > lastEnd + 1) {
      const beforeText = text.slice(lastEnd + 1, range.start);
      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }
    }

    // Add highlighted text
    const highlightedText = text.slice(range.start, range.end + 1);
    if (highlightedText) {
      const highlightSpan = createSpan({
        cls: "another-quick-switcher__hit_word",
        text: highlightedText,
      });
      fragment.appendChild(highlightSpan);
    }

    lastEnd = range.end;
  }

  // Add remaining text after last range
  if (lastEnd + 1 < text.length) {
    const remainingText = text.slice(lastEnd + 1);
    if (remainingText) {
      fragment.appendChild(document.createTextNode(remainingText));
    }
  }

  return fragment;
}

function createItemDiv(
  item: SuggestionItem,
  aliasesDisplayedAsTitle: string[],
  options: Options,
): Elements["itemDiv"] {
  const itemDiv = createDiv({
    cls: [
      "another-quick-switcher__item",
      item.phantom ? "another-quick-switcher__phantom_item" : "",
      item.starred ? "another-quick-switcher__starred_item" : "",
      options.hideGutterIcons ? "another-quick-switcher__gutter_hidden" : "",
    ].filter((x) => x),
    attr: {
      extension: item.file.extension,
    },
  });

  const entryDiv = createDiv({
    cls: "another-quick-switcher__item__entry",
  });

  const shouldShowAliasAsTitle =
    aliasesDisplayedAsTitle.length > 0 &&
    (options.displayAliaseAsTitle ||
      options.displayAliasAsTitleOnKeywordMatched);

  // Get title text and apply highlighting if match results exist
  const titleText = shouldShowAliasAsTitle
    ? aliasesDisplayedAsTitle.join(" / ")
    : item.file.basename;

  // Find relevant match results for title highlighting
  const titleMatchResults = item.matchResults.filter(
    (result) =>
      result.type === "name" ||
      result.type === "prefix-name" ||
      result.type === "fuzzy-name",
  );

  const titleDiv = createDiv({
    cls: [
      "another-quick-switcher__item__title",
      "another-quick-switcher__custom__item__title",
    ],
  });

  // Apply highlighting using DocumentFragment
  // Collect all ranges from all match results
  const allRanges: { start: number; end: number }[] = [];
  for (const result of titleMatchResults) {
    if (result.ranges) {
      allRanges.push(...result.ranges);
    }
  }

  const highlightedContent = createHighlightedText(
    titleText,
    allRanges.length > 0 ? allRanges : undefined,
  );
  titleDiv.appendChild(highlightedContent);
  entryDiv.appendChild(titleDiv);

  const isExcalidrawFile = isExcalidraw(item.file);
  if (item.file.extension !== "md" || isExcalidrawFile) {
    const extDiv = createDiv({
      cls: "another-quick-switcher__item__extension",
      text: isExcalidrawFile ? "excalidraw" : item.file.extension,
    });
    titleDiv.appendChild(extDiv);
  }

  if (item.order! < 9) {
    const hotKeyGuide = createSpan({
      cls: "another-quick-switcher__item__hot-key-guide",
      text: `${item.order! + 1}`,
    });
    entryDiv.appendChild(hotKeyGuide);
  }

  if (options.showDirectory) {
    const directoryDiv = createDiv({
      cls: "another-quick-switcher__item__directory",
    });
    directoryDiv.insertAdjacentHTML("beforeend", FOLDER);
    const text = options.showFullPathOfDirectory
      ? item.file.parent?.path
      : item.file.parent?.name;
    directoryDiv.appendText(` ${text}`);
    entryDiv.appendChild(directoryDiv);

    if (options.showDirectoryAtNewLine) {
      itemDiv.appendChild(entryDiv);
      itemDiv.appendChild(directoryDiv);
      return itemDiv;
    }
  }

  itemDiv.appendChild(entryDiv);

  return itemDiv;
}

function createMetaDiv(args: {
  frontMatter: {
    [key: string]: string | number | string[] | number[] | boolean | null;
  };
  score: number;
  options: Options;
}): Elements["metaDiv"] {
  const { frontMatter, options } = args;

  const metaDiv = createDiv({
    cls: "another-quick-switcher__item__metas",
  });

  if (options.displayDescriptionBelowTitle && frontMatter.description) {
    const descriptionDiv = createDiv({
      cls: "another-quick-switcher__item__meta",
    });
    const descriptionSpan = createSpan({
      cls: "another-quick-switcher__item__meta__description",
      text: String(frontMatter.description),
    });
    descriptionDiv.appendChild(descriptionSpan);
    metaDiv.appendChild(descriptionDiv);
  }

  if (options.showFuzzyMatchScore && args.score > 0) {
    const scoreDiv = createDiv({
      cls: "another-quick-switcher__item__meta",
    });
    const scoreSpan = createSpan({
      cls: "another-quick-switcher__item__meta__score",
    });
    scoreSpan.insertAdjacentHTML("beforeend", SCORE);
    scoreSpan.appendText(String(args.score));
    scoreDiv.appendChild(scoreSpan);
    metaDiv.appendChild(scoreDiv);
  }

  if (options.showFrontMatter && Object.keys(frontMatter).length > 0) {
    const frontMattersDiv = createDiv({
      cls: "another-quick-switcher__item__meta",
    });

    for (const [key, value] of Object.entries(frontMatter)) {
      if (key === "description" && options.displayDescriptionBelowTitle) {
        continue;
      }

      const frontMatterDiv = createDiv({
        cls: "another-quick-switcher__item__meta__front_matter",
        title: `${key}: ${value}`,
      });
      frontMatterDiv.insertAdjacentHTML("beforeend", FRONT_MATTER);
      frontMatterDiv.createSpan({
        cls: "another-quick-switcher__item__meta__front_matter__key",
        title: key,
        text: key,
      });

      for (const v of [value].flat().filter(isPresent)) {
        frontMatterDiv.createSpan({
          cls: "another-quick-switcher__item__meta__front_matter__value",
          title: v.toString(),
          text: v.toString(),
        });
      }

      frontMattersDiv.appendChild(frontMatterDiv);
    }
    metaDiv.appendChild(frontMattersDiv);
  }

  return metaDiv;
}

function createDescriptionDiv(args: {
  item: SuggestionItem;
  aliases: string[];
  tags: string[];
  countByLink: { [link: string]: number };
  countByHeader: { [header: string]: number };
  linkResultsNum: number;
  headerResultsNum: number;
  options: Options;
}): Elements["descriptionDiv"] {
  const {
    item,
    aliases,
    tags,
    countByLink,
    countByHeader,
    linkResultsNum,
    headerResultsNum,
    options,
  } = args;

  const descriptionDiv = createDiv({
    cls: "another-quick-switcher__item__descriptions",
  });

  if (aliases.length > 0) {
    const aliasDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });

    const displayAliases = options.displayAliasAsTitleOnKeywordMatched
      ? [item.file.basename]
      : aliases;
    for (const x of displayAliases) {
      const aliasSpan = createSpan({
        cls: "another-quick-switcher__item__description__alias",
      });
      aliasSpan.insertAdjacentHTML("beforeend", ALIAS);
      aliasSpan.appendText(x);
      aliasDiv.appendChild(aliasSpan);
    }
    descriptionDiv.appendChild(aliasDiv);
  }

  if (tags.length > 0) {
    const tagsDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });
    for (const x of tags) {
      const tagsSpan = createSpan({
        cls: "another-quick-switcher__item__description__tag",
      });
      tagsSpan.insertAdjacentHTML("beforeend", TAG);
      tagsSpan.appendText(x.replace("#", ""));
      tagsDiv.appendChild(tagsSpan);
    }
    descriptionDiv.appendChild(tagsDiv);
  }

  if (Object.keys(countByLink).length > 0) {
    const linksDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });

    const linkAndCount = Object.entries(countByLink)
      .map(([link, n]) => ({ link, n }))
      .sort((a, b) => b.n - a.n);
    for (const { link, n } of linkAndCount) {
      const linkSpan = createSpan({
        cls: [
          "another-quick-switcher__item__description__link",
          n !== linkResultsNum
            ? "another-quick-switcher__item__description__link__dimmed"
            : "",
        ],
      });
      linkSpan.insertAdjacentHTML("beforeend", LINK);
      linkSpan.appendChild(
        createSpan({ text: link, attr: { style: "padding-left: 3px" } }),
      );
      linksDiv.appendChild(linkSpan);
    }

    descriptionDiv.appendChild(linksDiv);
  }

  if (Object.keys(countByHeader).length > 0) {
    const headersDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });

    const headerAndCount = Object.entries(countByHeader)
      .map(([header, n]) => ({ header, n }))
      .sort((a, b) => b.n - a.n);
    for (const { header, n } of headerAndCount) {
      const headersSpan = createSpan({
        cls: [
          "another-quick-switcher__item__description__header",
          n !== headerResultsNum
            ? "another-quick-switcher__item__description__header__dimmed"
            : "",
        ],
      });
      headersSpan.insertAdjacentHTML("beforeend", HEADER);
      headersSpan.appendChild(
        createSpan({ text: header, attr: { style: "padding-left: 3px" } }),
      );
      headersDiv.appendChild(headersSpan);
    }
    descriptionDiv.appendChild(headersDiv);
  }

  return descriptionDiv;
}

export function createElements(
  item: SuggestionItem,
  options: Options,
): Elements {
  const { title, aliases } = getMatchedTitleAndAliases(item);
  const matchedAliasesOnly = title ? [] : aliases;

  const itemDiv = createItemDiv(
    item,
    options.displayAliaseAsTitle ? item.aliases : matchedAliasesOnly,
    options,
  );

  // meta
  const frontMatter = omitBy(
    item.frontMatter ?? {},
    (key, value) =>
      options.excludeFrontMatterKeys.includes(key) || value == null,
  );
  const maxScore = round(
    Math.max(...item.matchResults.map((a) => a.score ?? 0)),
    6,
  );

  const metaDiv =
    Object.keys(frontMatter).length > 0 || maxScore > 0
      ? createMetaDiv({
          frontMatter,
          score: maxScore,
          options,
        })
      : undefined;

  // description (not description property)
  const tags = uniqFlatMap(
    item.matchResults.filter((res) => res.type === "tag"),
    (x) => x.meta ?? [],
  );
  const linkResults = item.matchResults.filter((res) => res.type === "link");
  const linkResultsNum = linkResults.length;
  const countByLink = count(linkResults.flatMap((xs) => uniq(xs.meta ?? [])));
  const headerResults = item.matchResults.filter(
    (res) => res.type === "header",
  );
  const headerResultsNum = headerResults.length;
  const countByHeader = count(
    headerResults.flatMap((xs) => uniq(xs.meta ?? [])),
  );

  const descriptionDiv =
    aliases.length !== 0 ||
    tags.length !== 0 ||
    Object.keys(countByLink).length !== 0 ||
    Object.keys(countByHeader).length !== 0
      ? createDescriptionDiv({
          item,
          aliases: matchedAliasesOnly,
          tags,
          countByLink,
          countByHeader,
          linkResultsNum,
          headerResultsNum,
          options,
        })
      : undefined;

  return {
    itemDiv,
    metaDiv: metaDiv,
    descriptionDiv,
  };
}

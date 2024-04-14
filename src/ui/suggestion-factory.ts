import { SuggestionItem } from "../matcher";
import { count, omitBy, uniq, uniqFlatMap } from "../utils/collection-helper";
import { ALIAS, FOLDER, FRONT_MATTER, HEADER, LINK, SCORE, TAG } from "./icons";
import { round } from "../utils/math";
import { isExcalidraw } from "src/utils/path";

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
  showAliasesOnTop: boolean;
  hideGutterIcons: boolean;
  showFuzzyMatchScore: boolean;
}

function createItemDiv(
  item: SuggestionItem,
  aliases: string[],
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

  const titleDiv = createDiv({
    cls: "another-quick-switcher__item__title",
    text:
      options.showAliasesOnTop && aliases.length > 0
        ? aliases.join(" / ")
        : item.file.basename,
  });
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
  frontMatter: { [key: string]: string | number | string[] | number[] };
  score: number;
  options: Options;
}): Elements["metaDiv"] {
  const { frontMatter, options } = args;

  const metaDiv = createDiv({
    cls: "another-quick-switcher__item__metas",
  });

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
    Object.entries(frontMatter).forEach(([key, value]) => {
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
      [value].flat().forEach((v) => {
        frontMatterDiv.createSpan({
          cls: "another-quick-switcher__item__meta__front_matter__value",
          title: v.toString(),
          text: v.toString(),
        });
      });

      frontMattersDiv.appendChild(frontMatterDiv);
    });
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

    const displayAliases = options.showAliasesOnTop
      ? [item.file.basename]
      : aliases;
    displayAliases.forEach((x) => {
      const aliasSpan = createSpan({
        cls: "another-quick-switcher__item__description__alias",
      });
      aliasSpan.insertAdjacentHTML("beforeend", ALIAS);
      aliasSpan.appendText(x);
      aliasDiv.appendChild(aliasSpan);
    });
    descriptionDiv.appendChild(aliasDiv);
  }

  if (tags.length > 0) {
    const tagsDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });
    tags.forEach((x) => {
      const tagsSpan = createSpan({
        cls: "another-quick-switcher__item__description__tag",
      });
      tagsSpan.insertAdjacentHTML("beforeend", TAG);
      tagsSpan.appendText(x.replace("#", ""));
      tagsDiv.appendChild(tagsSpan);
    });
    descriptionDiv.appendChild(tagsDiv);
  }

  if (Object.keys(countByLink).length > 0) {
    const linksDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });

    Object.entries(countByLink)
      .map(([link, n]) => ({ link, n }))
      .sort((a, b) => b.n - a.n)
      .forEach(({ link, n }) => {
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
      });
    descriptionDiv.appendChild(linksDiv);
  }

  if (Object.keys(countByHeader).length > 0) {
    const headersDiv = createDiv({
      cls: "another-quick-switcher__item__description",
    });

    Object.entries(countByHeader)
      .map(([header, n]) => ({ header, n }))
      .sort((a, b) => b.n - a.n)
      .forEach(({ header, n }) => {
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
      });
    descriptionDiv.appendChild(headersDiv);
  }

  return descriptionDiv;
}

export function createElements(
  item: SuggestionItem,
  options: Options,
): Elements {
  const aliases = uniqFlatMap(
    item.matchResults.filter((res) => res.alias),
    (x) => x.meta ?? [],
  );
  const itemDiv = createItemDiv(item, aliases, options);

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

  // description
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
          aliases,
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

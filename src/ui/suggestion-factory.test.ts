import { describe, expect, test } from "@jest/globals";
import type { MatchQueryResult, SuggestionItem } from "../matcher";
import { createSuggestionItem as createItem } from "../test-helpers/suggestion-item";
import { createAliasIcon, createFileIcon } from "./icons";
import { createElements, filterFrontMatter } from "./suggestion-factory";
import {
  findAllByClass,
  findByClass,
  installObsidianDomStubs,
  type StubElement,
  serializeIcon,
  serializeStubElement,
  svgNodesOf,
} from "./test-helpers/obsidian-dom-stub";

installObsidianDomStubs();

// ---- fixtures ----

const defaultOptions = {
  showFrontMatter: false,
  excludeFrontMatterKeys: [],
  includeFrontMatterKeys: [],
  showDirectory: false,
  showDirectoryAtNewLine: false,
  showFullPathOfDirectory: false,
  displayAliasAsTitleOnKeywordMatched: false,
  displayAliaseAsTitle: false,
  hideGutterIcons: false,
  showFuzzyMatchScore: false,
  displayDescriptionBelowTitle: false,
  selected: false,
  relativeUpdatedPeriodSource: "none",
  relativeUpdatedPeriodPropertyKey: undefined,
} as const;

function options(
  overrides?: Partial<Record<keyof typeof defaultOptions, any>>,
): any {
  return { ...defaultOptions, ...overrides };
}

function elementsOf(item: SuggestionItem, opt = options()) {
  const { itemDiv, metaDiv, descriptionDiv } = createElements(item, opt);
  return {
    itemDiv: itemDiv as unknown as StubElement,
    metaDiv: metaDiv as unknown as StubElement | undefined,
    descriptionDiv: descriptionDiv as unknown as StubElement | undefined,
  };
}

const titleOf = (itemDiv: StubElement) =>
  findByClass(itemDiv, "another-quick-switcher__item__title")!;
const hitWordsOf = (el: StubElement) =>
  findAllByClass(el, "another-quick-switcher__hit_word").map(
    (x) => x.textContent,
  );

// ---- tests ----

describe("filterFrontMatter", () => {
  const frontMatter = {
    status: "done",
    category: "note",
    secret: "hidden",
  };

  test("includeとexcludeが空なら全キーを残す", () => {
    expect(filterFrontMatter(frontMatter, [], [])).toEqual(frontMatter);
  });

  test("includeが空ならexcludeのキーだけを除外する", () => {
    expect(filterFrontMatter(frontMatter, [], ["secret"])).toEqual({
      status: "done",
      category: "note",
    });
  });

  test("excludeが空ならincludeのキーだけを残す", () => {
    expect(filterFrontMatter(frontMatter, ["status"], [])).toEqual({
      status: "done",
    });
  });

  test("includeと重ならないexcludeを指定するとincludeのキーだけを残す", () => {
    expect(
      filterFrontMatter(frontMatter, ["status", "category"], ["secret"]),
    ).toEqual({ status: "done", category: "note" });
  });

  test("includeとexcludeに同じキーがある場合はexcludeを優先する", () => {
    expect(
      filterFrontMatter(frontMatter, ["status", "category"], ["status"]),
    ).toEqual({ category: "note" });
  });

  test("includeに存在しないキーを指定してもエラーにならない", () => {
    expect(filterFrontMatter(frontMatter, ["missing"], [])).toEqual({});
  });

  test("nullとundefinedはincludeに指定されていても除外する", () => {
    expect(
      filterFrontMatter(
        { status: "done", nullable: null, undefinable: undefined },
        ["status", "nullable", "undefinable"],
        [],
      ),
    ).toEqual({ status: "done" });
  });
});

describe("createElements: itemDiv", () => {
  test("マッチなしのmdファイルはタイトルにbasenameが表示され、meta/descriptionは作られない", () => {
    const { itemDiv, metaDiv, descriptionDiv } = elementsOf(createItem({}));

    expect(titleOf(itemDiv).textContent).toBe("Diary");
    expect(itemDiv.attrs.extension).toBe("md");
    expect(metaDiv).toBeUndefined();
    expect(descriptionDiv).toBeUndefined();
  });

  test("selected/phantom/starred/hideGutterIconsのclassが付与される", () => {
    const { itemDiv } = elementsOf(
      createItem({ phantom: true, starred: true }),
      options({ selected: true, hideGutterIcons: true }),
    );

    expect(itemDiv.hasClass("another-quick-switcher__item__selected")).toBe(
      true,
    );
    expect(itemDiv.hasClass("another-quick-switcher__phantom_item")).toBe(true);
    expect(itemDiv.hasClass("another-quick-switcher__starred_item")).toBe(true);
    expect(itemDiv.hasClass("another-quick-switcher__gutter_hidden")).toBe(
      true,
    );
  });

  test("orderが9未満ならホットキーガイド(order+1)が表示される", () => {
    const { itemDiv } = elementsOf(createItem({ order: 0 }));
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__hot-key-guide")
        ?.textContent,
    ).toBe("1");

    const { itemDiv: item10th } = elementsOf(createItem({ order: 9 }));
    expect(
      findByClass(item10th, "another-quick-switcher__item__hot-key-guide"),
    ).toBeNull();
  });

  test("md以外の拡張子は拡張子ラベルが表示される", () => {
    const { itemDiv } = elementsOf(createItem({ path: "Images/photo.png" }));
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__extension")
        ?.textContent,
    ).toBe("png");
  });

  test("Excalidrawファイルはmd拡張子でもexcalidrawラベルが表示される", () => {
    const { itemDiv } = elementsOf(
      createItem({ path: "Drawings/sketch.excalidraw.md" }),
    );
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__extension")
        ?.textContent,
    ).toBe("excalidraw");
  });

  test("showDirectoryでディレクトリ名が表示され、showFullPathOfDirectoryでフルパスになる", () => {
    const item = createItem({ path: "Notes/Sub/Diary.md" });

    const { itemDiv } = elementsOf(item, options({ showDirectory: true }));
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__directory")
        ?.textContent,
    ).toBe(" Sub");

    const { itemDiv: fullPathDiv } = elementsOf(
      item,
      options({ showDirectory: true, showFullPathOfDirectory: true }),
    );
    expect(
      findByClass(fullPathDiv, "another-quick-switcher__item__directory")
        ?.textContent,
    ).toBe(" Notes/Sub");
  });

  test("showDirectoryAtNewLineでディレクトリはentry内からitemDiv直下へ移動する", () => {
    const { itemDiv } = elementsOf(
      createItem({}),
      options({ showDirectory: true, showDirectoryAtNewLine: true }),
    );

    const entryDiv = findByClass(
      itemDiv,
      "another-quick-switcher__item__entry",
    )!;
    // 実DOMのappendChildは移動なので、entry内には残らない
    expect(
      findByClass(entryDiv, "another-quick-switcher__item__directory"),
    ).toBeNull();
    const directoryDiv = findByClass(
      itemDiv,
      "another-quick-switcher__item__directory",
    )!;
    expect(directoryDiv.parent).toBe(itemDiv);
  });
});

describe("createElements: タイトルのハイライト", () => {
  test("マッチ範囲がハイライトspanになり、範囲外は通常テキストになる", () => {
    const { itemDiv } = elementsOf(
      createItem({
        matchResults: [
          {
            type: "name",
            query: "di",
            score: 10,
            ranges: [
              { start: 0, end: 1 },
              { start: 3, end: 4 },
            ],
          },
        ],
      }),
    );

    const titleDiv = titleOf(itemDiv);
    expect(hitWordsOf(titleDiv)).toEqual(["Di", "ry"]);
    expect(titleDiv.textContent).toBe("Diary");
  });

  test("重複・隣接するマッチ範囲はマージしてハイライトされる", () => {
    const { itemDiv } = elementsOf(
      createItem({
        matchResults: [
          {
            type: "name",
            query: "d",
            score: 1,
            ranges: [{ start: 0, end: 1 }],
          },
          {
            type: "name",
            query: "a",
            score: 1,
            ranges: [{ start: 2, end: 3 }],
          },
        ],
      }),
    );

    // {0,1}と{2,3}は隣接のため{0,3}にマージされる
    expect(hitWordsOf(titleOf(itemDiv))).toEqual(["Diar"]);
  });
});

describe("createElements: エイリアス表示", () => {
  // エイリアスマッチはtypeではなくaliasフィールドの有無で表現される
  const aliasMatchResult: MatchQueryResult = {
    type: "name",
    alias: "nikki",
    query: "nik",
    meta: ["nikki"],
    score: 5,
    allAliasRanges: [{ alias: "nikki", ranges: [{ start: 0, end: 2 }] }],
  };

  test("タイトル不一致+displayAliasAsTitleOnKeywordMatchedでエイリアスがタイトルとして表示される", () => {
    const { itemDiv, descriptionDiv } = elementsOf(
      createItem({
        aliases: ["nikki", "journal"],
        matchResults: [aliasMatchResult],
      }),
      options({ displayAliasAsTitleOnKeywordMatched: true }),
    );

    const titleDiv = titleOf(itemDiv);
    // マッチしたエイリアスのみがタイトルに表示され、マッチ範囲がハイライトされる
    expect(titleDiv.textContent).toBe("nikki");
    expect(hitWordsOf(titleDiv)).toEqual(["nik"]);
    // エイリアス表示のアイコンが付く
    expect(svgNodesOf(titleDiv).map(serializeStubElement)).toContain(
      serializeIcon(createAliasIcon()),
    );

    // description側にはファイル名がFILEアイコン付きで表示される
    const aliasSpan = findByClass(
      descriptionDiv!,
      "another-quick-switcher__item__description__alias",
    )!;
    expect(aliasSpan.textContent).toBe("Diary");
    expect(svgNodesOf(aliasSpan).map(serializeStubElement)).toContain(
      serializeIcon(createFileIcon()),
    );
  });

  test("displayAliaseAsTitleで全エイリアスが ' | ' 区切りでタイトル表示され、オフセット付きでハイライトされる", () => {
    const { itemDiv } = elementsOf(
      createItem({
        aliases: ["journal", "nikki"],
        matchResults: [aliasMatchResult],
      }),
      options({ displayAliaseAsTitle: true }),
    );

    const titleDiv = titleOf(itemDiv);
    expect(titleDiv.textContent).toBe("journal | nikki");
    // "journal | " の10文字分オフセットした位置がハイライトされる
    expect(hitWordsOf(titleDiv)).toEqual(["nik"]);
  });

  test("タイトルがマッチした場合はエイリアスがタイトルではなくdescriptionに表示される", () => {
    const { itemDiv, descriptionDiv } = elementsOf(
      createItem({
        aliases: ["nikki"],
        matchResults: [
          { type: "name", query: "diary", score: 10, ranges: [] },
          aliasMatchResult,
        ],
      }),
      options({ displayAliasAsTitleOnKeywordMatched: true }),
    );

    expect(titleOf(itemDiv).textContent).toBe("Diary");

    const aliasSpan = findByClass(
      descriptionDiv!,
      "another-quick-switcher__item__description__alias",
    )!;
    expect(aliasSpan.textContent).toBe("nikki");
    expect(hitWordsOf(aliasSpan)).toEqual(["nik"]);
  });
});

describe("createElements: metaDiv", () => {
  test("showFuzzyMatchScoreで最大スコアが小数6桁に丸めて表示される", () => {
    const { metaDiv } = elementsOf(
      createItem({
        matchResults: [
          { type: "fuzzy-name", query: "d", score: 12.3456789, ranges: [] },
          { type: "fuzzy-name", query: "i", score: 1, ranges: [] },
        ],
      }),
      options({ showFuzzyMatchScore: true }),
    );

    expect(
      findByClass(metaDiv!, "another-quick-switcher__item__meta__score")
        ?.textContent,
    ).toBe("12.345679");
  });

  test("showFrontMatterでプロパティが表示され、excludeFrontMatterKeysは除外される", () => {
    const { metaDiv } = elementsOf(
      createItem({
        frontMatter: {
          status: "done",
          tags: ["a", "b"],
          secret: "hidden",
        },
      }),
      options({ showFrontMatter: true, excludeFrontMatterKeys: ["secret"] }),
    );

    const keys = findAllByClass(
      metaDiv!,
      "another-quick-switcher__item__meta__front_matter__key",
    ).map((x) => x.textContent);
    expect(keys).toEqual(["status", "tags"]);

    // 配列値は値ごとにspanが作られる
    const values = findAllByClass(
      metaDiv!,
      "another-quick-switcher__item__meta__front_matter__value",
    ).map((x) => x.textContent);
    expect(values).toEqual(["done", "a", "b"]);
  });

  test("showFrontMatterでincludeFrontMatterKeysのプロパティだけが表示される", () => {
    const { metaDiv } = elementsOf(
      createItem({
        frontMatter: {
          status: "done",
          tags: ["a", "b"],
          secret: "hidden",
        },
      }),
      options({ showFrontMatter: true, includeFrontMatterKeys: ["status"] }),
    );

    const keys = findAllByClass(
      metaDiv!,
      "another-quick-switcher__item__meta__front_matter__key",
    ).map((x) => x.textContent);
    expect(keys).toEqual(["status"]);

    const values = findAllByClass(
      metaDiv!,
      "another-quick-switcher__item__meta__front_matter__value",
    ).map((x) => x.textContent);
    expect(values).toEqual(["done"]);
  });

  test("displayDescriptionBelowTitleでdescriptionプロパティがハイライト付きで表示され、プロパティ一覧からは除外される", () => {
    const { metaDiv } = elementsOf(
      createItem({
        frontMatter: { description: "hello world" },
        matchResults: [
          {
            type: "property",
            query: "he",
            score: 1,
            frontMatterRanges: { description: [{ start: 0, end: 1 }] },
          },
        ],
      }),
      options({
        showFrontMatter: true,
        displayDescriptionBelowTitle: true,
      }),
    );

    const descriptionSpan = findByClass(
      metaDiv!,
      "another-quick-switcher__item__meta__description",
    )!;
    expect(descriptionSpan.textContent).toBe("hello world");
    expect(hitWordsOf(descriptionSpan)).toEqual(["he"]);

    // プロパティ一覧には重複表示されない
    expect(
      findAllByClass(
        metaDiv!,
        "another-quick-switcher__item__meta__front_matter__key",
      ),
    ).toHaveLength(0);
  });

  test("フロントマターがなくスコアも0ならmetaDivは作られない", () => {
    const { metaDiv } = elementsOf(
      createItem({
        matchResults: [{ type: "name", query: "d", score: 0, ranges: [] }],
      }),
    );
    expect(metaDiv).toBeUndefined();
  });
});

describe("createElements: descriptionDiv", () => {
  test("タグマッチは#を除いたタグ名が表示される", () => {
    const { descriptionDiv } = elementsOf(
      createItem({
        matchResults: [{ type: "tag", query: "#hobby", meta: ["#hobby"] }],
      }),
    );

    const tagSpans = findAllByClass(
      descriptionDiv!,
      "another-quick-switcher__item__description__tag",
    );
    expect(tagSpans.map((x) => x.textContent)).toEqual(["hobby"]);
  });

  test("リンクマッチは出現数の多い順に表示され、全クエリに含まれないものはdimmedになる", () => {
    const { descriptionDiv } = elementsOf(
      createItem({
        matchResults: [
          { type: "link", query: "a", meta: ["Note A"] },
          { type: "link", query: "b", meta: ["Note A", "Note B"] },
        ],
      }),
    );

    const linkSpans = findAllByClass(
      descriptionDiv!,
      "another-quick-switcher__item__description__link",
    );
    expect(linkSpans.map((x) => x.textContent)).toEqual(["Note A", "Note B"]);
    // Note Aは2クエリ両方に含まれるためdimmedされない
    expect(
      linkSpans[0].hasClass(
        "another-quick-switcher__item__description__link__dimmed",
      ),
    ).toBe(false);
    // Note Bは片方のクエリにしか含まれないためdimmedされる
    expect(
      linkSpans[1].hasClass(
        "another-quick-switcher__item__description__link__dimmed",
      ),
    ).toBe(true);
  });

  test("ヘッダーマッチも出現数の多い順に表示される", () => {
    const { descriptionDiv } = elementsOf(
      createItem({
        matchResults: [
          { type: "header", query: "a", meta: ["H1"] },
          { type: "header", query: "b", meta: ["H1", "H2"] },
        ],
      }),
    );

    const headerSpans = findAllByClass(
      descriptionDiv!,
      "another-quick-switcher__item__description__header",
    );
    expect(headerSpans.map((x) => x.textContent)).toEqual(["H1", "H2"]);
  });
});

describe("createElements: 相対更新期間", () => {
  const hourMs = 60 * 60 * 1000;

  test("source: modifiedでmtimeからの経過時間が表示される", () => {
    const { itemDiv } = elementsOf(
      createItem({ stat: { mtime: Date.now() - 2 * hourMs, ctime: 1 } }),
      options({ relativeUpdatedPeriodSource: "modified" }),
    );

    const span = findByClass(
      itemDiv,
      "another-quick-switcher__item__relative-age",
    )!;
    expect(span.textContent).toBe("2h");
    expect(
      span.hasClass("another-quick-switcher__item__relative-age--hour"),
    ).toBe(true);
  });

  test("source: noneでは表示されない", () => {
    const { itemDiv } = elementsOf(
      createItem({ stat: { mtime: Date.now(), ctime: 1 } }),
      options({ relativeUpdatedPeriodSource: "none" }),
    );
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__relative-age"),
    ).toBeNull();
  });

  test("phantomファイルには表示されない", () => {
    const { itemDiv } = elementsOf(
      createItem({ phantom: true, stat: { mtime: Date.now(), ctime: 1 } }),
      options({ relativeUpdatedPeriodSource: "modified" }),
    );
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__relative-age"),
    ).toBeNull();
  });

  test("source: propertyでフロントマターの日付文字列から計算される(momentなしはDate.parseフォールバック)", () => {
    const { itemDiv } = elementsOf(
      createItem({ frontMatter: { updated: "2020-01-01" } }),
      options({
        relativeUpdatedPeriodSource: "property",
        relativeUpdatedPeriodPropertyKey: "updated",
      }),
    );

    const span = findByClass(
      itemDiv,
      "another-quick-switcher__item__relative-age",
    )!;
    expect(
      span.hasClass("another-quick-switcher__item__relative-age--year"),
    ).toBe(true);
  });

  test("source: propertyでキー未指定・値なしは表示されない", () => {
    const { itemDiv } = elementsOf(
      createItem({ frontMatter: { updated: "2020-01-01" } }),
      options({
        relativeUpdatedPeriodSource: "property",
        relativeUpdatedPeriodPropertyKey: undefined,
      }),
    );
    expect(
      findByClass(itemDiv, "another-quick-switcher__item__relative-age"),
    ).toBeNull();

    const { itemDiv: noValueDiv } = elementsOf(
      createItem({ frontMatter: {} }),
      options({
        relativeUpdatedPeriodSource: "property",
        relativeUpdatedPeriodPropertyKey: "updated",
      }),
    );
    expect(
      findByClass(noValueDiv, "another-quick-switcher__item__relative-age"),
    ).toBeNull();
  });
});

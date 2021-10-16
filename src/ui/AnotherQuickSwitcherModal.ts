import {
  App,
  CachedMetadata,
  parseFrontMatterAliases,
  SuggestModal,
  TFile,
} from "obsidian";
import { sorter } from "../utils/collection-helper";
import { ALIAS, FOLDER } from "./icons";
import { smartIncludes, smartStartsWith } from "../utils/strings";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";

export type Mode = "normal" | "recent" | "backlink";

interface SuggestionItem {
  file: TFile;
  cache?: CachedMetadata;
  matchType?: "name" | "prefix-name" | "directory" | "alias";
  phantom: boolean;
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  matcher: (item: SuggestionItem, query: string) => boolean
): boolean {
  const qs = query.split("/");
  const file = qs.pop();
  return (
    qs.every((dir) => smartIncludes(item.file.parent.path, dir)) &&
    matcher(item, file)
  );
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  matcher: (item: SuggestionItem, query: string) => boolean
): boolean {
  return queries.every((q) => matchQuery(item, q, matcher));
}

function stampMatchType(
  item: SuggestionItem,
  queries: string[]
): SuggestionItem {
  if (
    matchQueryAll(item, queries, (item, query) =>
      smartStartsWith(item.file.name, query)
    )
  ) {
    return { ...item, matchType: "prefix-name" };
  }

  if (
    matchQueryAll(item, queries, (item, query) =>
      smartIncludes(item.file.name, query)
    )
  ) {
    return { ...item, matchType: "name" };
  }

  if (
    matchQueryAll(item, queries, (item, query) =>
      smartIncludes(item.file.path, query)
    )
  ) {
    return { ...item, matchType: "directory" };
  }

  if (
    matchQueryAll(item, queries, (item, query) =>
      (parseFrontMatterAliases(item.cache?.frontmatter) ?? []).some((al) =>
        smartIncludes(al, query)
      )
    )
  ) {
    return { ...item, matchType: "alias" };
  }

  return item;
}

function toPrefixIconHTML(item: SuggestionItem): string {
  switch (item.matchType) {
    case "alias":
      return `<span class="another-quick-switcher__item__icon">${ALIAS}</span>`;
    case "directory":
      return `<span class="another-quick-switcher__item__icon">${FOLDER}</span>`;
  }
  return "";
}

export class AnotherQuickSwitcherModal extends SuggestModal<SuggestionItem> {
  originItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  mode: Mode;
  settings: Settings;

  constructor(app: App, public initialMode: Mode, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    this.setInstructions([
      { command: "[↑↓]", purpose: "navigate" },
      { command: "[↵]", purpose: "open" },
      { command: "[ctrl/cmd ↵]", purpose: "open in new pane" },
      { command: "[alt ↵]", purpose: "insert to editor" },
      { command: "[esc]", purpose: "dismiss" },
    ]);
    this.scope.register(
      ["Mod"],
      "Enter",
      // This is an unsafe code..!! However, it might be a public interface because lishid commented it as a better way on PR :)
      // https://github.com/obsidianmd/obsidian-releases/pull/520#issuecomment-944846642
      () => (this as any).chooser.useSelectedItem({ metaKey: true })
    );
    this.scope.register(
      ["Alt"],
      "Enter",
      // This is an unsafe code..!! However, it might be a public interface because lishid commented it as a better way on PR :)
      // https://github.com/obsidianmd/obsidian-releases/pull/520#issuecomment-944846642
      () => (this as any).chooser.useSelectedItem({ altKey: true })
    );

    const phantomItems: SuggestionItem[] = this.appHelper
      .searchPhantomFiles()
      .map((x) => ({
        file: x,
        phantom: true,
      }));

    const activeFilePath = app.workspace.getActiveFile()?.path;
    const markdownItems = app.vault
      .getMarkdownFiles()
      .filter((x) => x.path !== activeFilePath)
      .map((x) => ({
        file: x,
        cache: app.metadataCache.getFileCache(x),
        phantom: false,
      }));

    this.originItems = [...markdownItems, ...phantomItems];
    this.ignoredItems = this.ignoreItems(initialMode);
  }

  ignoreItems(mode: Mode): SuggestionItem[] {
    const ignoreItems = (pattern: string): SuggestionItem[] =>
      pattern
        ? this.originItems.filter(
            (x) => !x.file.path.match(new RegExp(pattern))
          )
        : this.originItems;

    switch (mode) {
      case "normal":
        return ignoreItems(this.settings.ignoreNormalPathPattern);
      case "recent":
        return ignoreItems(this.settings.ignoreRecentPathPattern);
      case "backlink":
        return ignoreItems(this.settings.ignoreBackLinkPathPattern);
    }
  }

  getSuggestions(query: string): SuggestionItem[] {
    let lastOpenFileIndexByPath: { [path: string]: number } = {};
    this.app.workspace.getLastOpenFiles().forEach((v, i) => {
      lastOpenFileIndexByPath[v] = i;
    });

    let searchQuery = query;
    const changeMode = (mode: Mode, slice: number = 0) => {
      if (this.mode !== mode) {
        this.ignoredItems = this.ignoreItems(mode);
      }
      this.mode = mode;
      searchQuery = query.slice(slice);
    };
    // noinspection IfStatementWithTooManyBranchesJS
    if (query.startsWith(":n ")) {
      changeMode("normal", 3);
    } else if (query.startsWith(":r ")) {
      changeMode("recent", 3);
    } else if (query.startsWith(":b ")) {
      changeMode("backlink", 3);
    } else {
      changeMode(this.initialMode);
    }

    const qs = searchQuery.split(" ").filter((x) => x);

    if (this.mode === "backlink") {
      // ✨ If I can use MetadataCache.getBacklinksForFile, I would like to use it instead of original createBacklinksMap :)
      const backlinksMap = this.appHelper.createBacklinksMap();

      const activeFilePath = this.app.workspace.getActiveFile()?.path;
      return this.ignoredItems
        .filter((x) => backlinksMap[activeFilePath].has(x.file.path))
        .map((x) => stampMatchType(x, qs))
        .filter((x) => x.matchType);
    }

    if (!query) {
      return this.ignoredItems
        .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535))
        .slice(0, 10);
    }

    let suggestions = this.ignoredItems
      .map((x) => stampMatchType(x, qs))
      .filter((x) => x.matchType)
      .sort(sorter((x) => x.file.stat.mtime, "desc"))
      .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535));

    if (this.mode === "normal") {
      suggestions = suggestions
        .sort(sorter((x) => (x.matchType === "directory" ? 1 : 0)))
        .sort(
          sorter(
            (x) =>
              x.matchType === "prefix-name" ? 1000 - x.file.name.length : 0,
            "desc"
          )
        );
    }

    return suggestions.slice(0, 10);
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const suggestionItemHtml = `
<div class="another-quick-switcher__item ${
      item.phantom ? "another-quick-switcher__phantom_item" : ""
    }">
  <div class="another-quick-switcher__item__file">${item.file.basename}</div>
  <div class="another-quick-switcher__item__directory">${FOLDER} ${
      item.file.parent.name
    }</div>
</div>
`.trim();

    el.insertAdjacentHTML(
      "beforeend",
      `${toPrefixIconHTML(item)}${suggestionItemHtml}`
    );
  }

  async onChooseSuggestion(
    item: SuggestionItem,
    evt: MouseEvent | KeyboardEvent
  ): Promise<void> {
    let fileToOpened = item.file;
    if (evt.altKey) {
      this.appHelper.insertLinkToActiveFileBy(fileToOpened);
      return;
    }

    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }

    const offset =
      this.mode === "backlink"
        ? this.appHelper.findFirstLinkOffset(
            item.file,
            this.app.workspace.getActiveFile()
          )
        : undefined;

    this.appHelper.openMarkdownFile(
      fileToOpened,
      evt.ctrlKey || evt.metaKey,
      offset
    );
  }
}

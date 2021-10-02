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
import { openFile, searchPhantomFiles } from "../app-helper";

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
  ignoreBackLinkPathPattern: RegExp | null;
  items: SuggestionItem[];

  constructor(app: App, public mode: Mode, settings: Settings) {
    super(app);

    this.ignoreBackLinkPathPattern = settings.ignoreBackLinkPathPattern
      ? new RegExp(settings.ignoreBackLinkPathPattern)
      : null;

    this.setInstructions([
      { command: "Mode: ", purpose: mode },
      { command: "[↑↓]", purpose: "navigate" },
      { command: "[↵]", purpose: "open" },
      { command: "[ctrl ↵]", purpose: "open in new pane" },
      { command: "[esc]", purpose: "dismiss" },
    ]);
    this.scope.register(
      ["Ctrl"],
      "Enter",
      // XXX: This is unsafe code..!! 😂
      (this.scope as any).keys.find(
        (x: any) => !x.modifiers && x.key === "Enter"
      ).func
    );

    const phantomItems: SuggestionItem[] = searchPhantomFiles(app).map((x) => ({
      file: x,
      phantom: true,
    }));

    const markdownItems = app.vault
      .getMarkdownFiles()
      .filter((x) => x.path !== app.workspace.getActiveFile()?.path)
      .map((x) => ({
        file: x,
        cache: app.metadataCache.getFileCache(x),
        phantom: false,
      }));

    this.items = [...markdownItems, ...phantomItems];
  }

  getSuggestions(query: string): SuggestionItem[] {
    let lastOpenFileIndexByPath: { [path: string]: number } = {};
    this.app.workspace.getLastOpenFiles().forEach((v, i) => {
      lastOpenFileIndexByPath[v] = i;
    });

    let searchMode = this.mode;
    let searchQuery = query;
    if (searchMode === "recent" && query.startsWith("/")) {
      searchMode = "normal";
      searchQuery = query.slice(1);
    }
    const qs = searchQuery.split(" ").filter((x) => x);

    if (this.mode === "backlink") {
      // XXX: This is unsafe implementation, so there are risks it is not working someday
      const backlinksMap = (this.app.metadataCache as any).getBacklinksForFile(
        this.app.workspace.getActiveFile()
      )?.data;

      return this.items
        .filter((x) => backlinksMap[x.file.path])
        .filter(
          (x) =>
            !this.ignoreBackLinkPathPattern ||
            !x.file.path.match(this.ignoreBackLinkPathPattern)
        )
        .map((x) => stampMatchType(x, qs))
        .filter((x) => x.matchType);
    }

    if (!query) {
      return this.items
        .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535))
        .slice(0, 10);
    }

    let suggestions = this.items
      .map((x) => stampMatchType(x, qs))
      .filter((x) => x.matchType)
      .sort(sorter((x) => x.file.stat.mtime, "desc"))
      .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535));

    if (searchMode === "normal") {
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
    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }

    openFile(this.app, fileToOpened, evt.ctrlKey);
  }
}

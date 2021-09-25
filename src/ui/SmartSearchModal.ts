import {
  App,
  CachedMetadata,
  parseFrontMatterAliases,
  SuggestModal,
  TFile,
} from "obsidian";
import { keyBy, sorter } from "../utils/collection-helper";
import { ALIAS, FOLDER } from "./icons";
import { smartIncludes, smartStartsWith } from "../utils/strings";

export type Mode = "normal" | "recent";

interface SuggestionItem {
  file: TFile;
  cache?: CachedMetadata;
  matchType?: "name" | "prefix-name" | "directory" | "alias";
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
      (parseFrontMatterAliases(item.cache.frontmatter) ?? []).some((al) =>
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

export class SmartSearchModal extends SuggestModal<SuggestionItem> {
  constructor(app: App, public mode: Mode) {
    super(app);
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
  }

  getSuggestions(query: string): SuggestionItem[] {
    if (!query) {
      const fileByPath = keyBy(this.getItems(), (x) => x.file.path);
      return this.app.workspace
        .getLastOpenFiles()
        .map((x) => fileByPath[x])
        .filter((x) => x);
    }

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

    let items = this.getItems()
      .map((x) => stampMatchType(x, qs))
      .filter((x) => x.matchType)
      .sort(sorter((x) => x.file.stat.mtime, "desc"))
      .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535));

    if (searchMode === "normal") {
      items = items
        .sort(sorter((x) => (x.matchType === "directory" ? 1 : 0)))
        .sort(
          sorter(
            (x) =>
              x.matchType === "prefix-name" ? 1000 - x.file.name.length : 0,
            "desc"
          )
        );
    }

    return items.slice(0, 10);
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const suggestionItemHtml = `
<div class="another-quick-switcher__item">
  <div class="another-quick-switcher__item__file">${item.file.basename}</div>
  <div class="another-quick-switcher__item__directory">${FOLDER} ${item.file.parent.name}</div>
</div>
`.trim();

    el.insertAdjacentHTML(
      "beforeend",
      `${toPrefixIconHTML(item)}${suggestionItemHtml}`
    );
  }

  getItems(): SuggestionItem[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((x) => x.path !== this.app.workspace.getActiveFile()?.path)
      .map((x) => ({
        file: x,
        cache: this.app.metadataCache.getFileCache(x),
      }));
  }

  onChooseSuggestion(
    item: SuggestionItem,
    evt: MouseEvent | KeyboardEvent
  ): any {
    this.openFile(item.file, evt.ctrlKey);
  }

  openFile(file: TFile, newLeaf: boolean) {
    const leaf = this.app.workspace.getLeaf(newLeaf);

    leaf.openFile(file).then(() => {
      this.app.workspace.setActiveLeaf(leaf, true, newLeaf);
    });
  }
}

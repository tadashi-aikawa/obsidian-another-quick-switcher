import {
  App,
  CachedMetadata,
  FuzzyMatch,
  FuzzySuggestModal,
  parseFrontMatterAliases,
  TFile,
} from "obsidian";
import { sorter } from "../collection-helper";
import { ALIAS, FOLDER } from "./icons";

interface SuggestionItem {
  file: TFile;
  cache?: CachedMetadata;
  matchType?: "name" | "prefix-name" | "directory" | "alias";
}

const regEmoji = new RegExp(
  /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/,
  "g"
);
function excludeEmoji(text: string): string {
  return text.replace(regEmoji, "");
}
function excludeSpace(text: string): string {
  return text.replace(/ /g, "");
}

function smartIncludes(text: string, query: string): boolean {
  return excludeSpace(text.toLowerCase()).includes(query.toLowerCase());
}

function smartStartsWith(text: string, query: string): boolean {
  return excludeSpace(excludeEmoji(text.toLowerCase())).startsWith(
    query.toLowerCase()
  );
}

function stampMatchType(
  item: SuggestionItem,
  queries: string[]
): SuggestionItem {
  if (queries.every((q) => smartStartsWith(item.file.name, q))) {
    return { ...item, matchType: "prefix-name" };
  }

  if (queries.every((q) => smartIncludes(item.file.name, q))) {
    return { ...item, matchType: "name" };
  }

  if (queries.every((q) => smartIncludes(item.file.path, q))) {
    return { ...item, matchType: "directory" };
  }

  if (
    queries.every((q) =>
      (parseFrontMatterAliases(item.cache.frontmatter) ?? []).some((al) =>
        smartIncludes(al, q)
      )
    )
  ) {
    return { ...item, matchType: "alias" };
  }

  return item;
}

function toPrefixIconHTML(item: FuzzyMatch<SuggestionItem>): string {
  switch (item.item.matchType) {
    case "alias":
      return `<span class="another-quick-switcher__item__icon">${ALIAS}</span>`;
    case "directory":
      return `<span class="another-quick-switcher__item__icon">${FOLDER}</span>`;
  }
  return "";
}

export class SmartSearchModal extends FuzzySuggestModal<SuggestionItem> {
  constructor(app: App) {
    super(app);
    this.scope.register(
      ["Ctrl"],
      "Enter",
      // XXX: This is unsafe code..!! 😂
      (this.scope as any).keys.find(
        (x: any) => !x.modifiers && x.key === "Enter"
      ).func
    );
  }

  getSuggestions(query: string): FuzzyMatch<SuggestionItem>[] {
    const recentMode = query.startsWith("/");
    const qs = (recentMode ? query.slice(1) : query)
      .split(" ")
      .filter((x) => x);

    let items = this.getItems()
      .map((x) => stampMatchType(x, qs))
      .filter((x) => x.matchType)
      .map((x) => ({
        item: x,
        match: {
          score: x.file.stat.mtime,
          matches: [],
        },
      }))
      .sort(sorter((x) => x.item.file.stat.mtime, "desc"));

    if (!recentMode) {
      items = items
        .sort(sorter((x) => (x.item.matchType === "directory" ? 1 : 0)))
        .sort(
          sorter(
            (x) =>
              x.item.matchType === "prefix-name"
                ? 1000 - x.item.file.name.length
                : 0,
            "desc"
          )
        );
    }

    return items.slice(0, 10);
  }

  renderSuggestion(item: FuzzyMatch<SuggestionItem>, el: HTMLElement) {
    const suggestionItemHtml = `
<div class="another-quick-switcher__item">
  <div class="another-quick-switcher__item__file">${item.item.file.basename}</div>
  <div class="another-quick-switcher__item__directory">${FOLDER} ${item.item.file.parent.name}</div>
</div>
`.trim();

    el.insertAdjacentHTML(
      "beforeend",
      `${toPrefixIconHTML(item)}${suggestionItemHtml}`
    );
  }

  getItemText(item: SuggestionItem): string {
    return `${item.file.basename}`;
  }

  getItems(): SuggestionItem[] {
    return this.app.vault.getMarkdownFiles().map((x) => ({
      file: x,
      cache: this.app.metadataCache.getFileCache(x),
    }));
  }

  onChooseItem(item: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
    // For Ctrl + Click, not Ctrl + Enter (TODO...)
    this.openFile(item.file, evt.ctrlKey);
  }

  openFile(file: TFile, newLeaf: boolean) {
    const leaf = this.app.workspace.getLeaf(newLeaf);

    leaf.openFile(file).then(() => {
      this.app.workspace.setActiveLeaf(leaf, true, newLeaf);
    });
  }
}

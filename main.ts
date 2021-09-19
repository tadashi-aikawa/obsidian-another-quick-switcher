import {
  CachedMetadata,
  FuzzyMatch,
  FuzzySuggestModal,
  parseFrontMatterAliases,
  Plugin,
  TFile,
} from "obsidian";
import { sorter } from "./collection-helper";

export default class FuzzySearch extends Plugin {
  async onload() {
    console.log("loading plugin");

    this.addCommand({
      id: "search",
      name: "Search",
      hotkeys: [{ modifiers: ["Ctrl"], key: "p" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          this.showList();
        }
        return true;
      },
    });
  }

  showList() {
    const modal = new FuzzySearchModal(this.app);
    modal.open();
  }
}

interface SuggestionItem {
  file: TFile;
  cache?: CachedMetadata;
}

function lowerInclude(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

function matchAll(item: SuggestionItem, queries: string[]): boolean {
  return queries.every(
    (q) =>
      lowerInclude(item.file.path, q) ||
      (parseFrontMatterAliases(item.cache.frontmatter) ?? []).some((al) =>
        lowerInclude(al, q)
      )
  );
}

class FuzzySearchModal extends FuzzySuggestModal<SuggestionItem> {
  getSuggestions(query: string): FuzzyMatch<SuggestionItem>[] {
    const qs = query.split(" ").filter((x) => x);
    return this.getItems()
      .filter((x) => matchAll(x, qs))
      .map((x) => ({
        item: x,
        match: {
          score: x.file.stat.mtime,
          matches: [],
        },
      }))
      .sort(sorter((x) => x.item.file.stat.mtime, "desc"));
  }

  getItemText(item: SuggestionItem): string {
    return `${item.file.path}`;
  }

  getItems(): SuggestionItem[] {
    return this.app.vault.getMarkdownFiles().map((x) => ({
      file: x,
      cache: this.app.metadataCache.getFileCache(x),
    }));
  }

  onChooseItem(item: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
    // For Ctrl + Click, not Ctrl + Enter (TODO...)
    const leaf = this.app.workspace.getLeaf(evt.ctrlKey);

    leaf.openFile(item.file).then(() => {
      this.app.workspace.setActiveLeaf(leaf, true, evt.ctrlKey);
    });
  }
}

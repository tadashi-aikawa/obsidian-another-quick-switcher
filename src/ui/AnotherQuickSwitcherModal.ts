import {
  App,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  SuggestModal,
} from "obsidian";
import { ignoreItems, sorter, uniq } from "../utils/collection-helper";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";
import { stampMatchResults, SuggestionItem } from "src/matcher";
import { createElements } from "./suggestion-factory";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

export type Mode = "normal" | "recent" | "backlink" | "filename-recent";

// This is an unsafe code..!! However, it might be a public interface because lishid commented it as a better way on PR :)
// https://github.com/obsidianmd/obsidian-releases/pull/520#issuecomment-944846642
interface UnsafeModalInterface {
  chooser: {
    selectedItem: number;
    setSelectedItem(item: number): void;
    useSelectedItem(ev: Partial<KeyboardEvent>): void;
  };
}

export class AnotherQuickSwitcherModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface
{
  originItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  mode: Mode;
  settings: Settings;
  searchQuery: string;

  chooser: UnsafeModalInterface["chooser"];

  constructor(app: App, public initialMode: Mode, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    this.setInstructions([
      {
        command: "[↑↓][ctrl/cmd n or p][ctrl/cmd j or k]",
        purpose: "navigate",
      },
      { command: "[↵]", purpose: "open" },
      { command: "[ctrl/cmd ↵]", purpose: "open in new pane" },
      { command: "[shift ↵]", purpose: "create" },
      { command: "[ctrl/cmd shift ↵]", purpose: "create in new pane" },
      { command: "[alt ↵]", purpose: "insert to editor" },
      { command: "[esc]", purpose: "dismiss" },
    ]);
    this.scope.register(["Mod"], "Enter", () =>
      this.chooser.useSelectedItem({ metaKey: true })
    );
    this.scope.register(["Alt"], "Enter", () =>
      this.chooser.useSelectedItem({ altKey: true })
    );
    this.scope.register(["Shift"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, false);
      }
    });
    this.scope.register(["Shift", "Mod"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, true);
      }
    });
    this.scope.register(["Mod"], "N", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
      );
    });
    this.scope.register(["Mod"], "P", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.scope.register(["Mod"], "J", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
      );
    });
    this.scope.register(["Mod"], "K", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    // Delete whole input line
    this.scope.register(["Mod"], "D", () => {
      this.inputEl.select();
      this.inputEl.setRangeText("");
      this.inputEl.dispatchEvent(new Event("input"));
    });

    const phantomItems = this.settings.showExistingFilesOnly
      ? []
      : this.appHelper.searchPhantomFiles().map((x) => ({
          file: x,
          aliases: [],
          tags: [],
          phantom: true,
          matchResults: [],
        }));

    const activeFilePath = app.workspace.getActiveFile()?.path;
    const markdownItems = app.vault
      .getMarkdownFiles()
      .filter(
        (x) => x.path !== activeFilePath && app.metadataCache.getFileCache(x)
      )
      .map((x) => {
        const cache = app.metadataCache.getFileCache(x)!; // already filtered
        return {
          file: x,
          aliases: parseFrontMatterAliases(cache.frontmatter) ?? [],
          tags: uniq([
            ...(cache.tags ?? []).map((x) => x.tag),
            ...(parseFrontMatterTags(cache.frontmatter) ?? []),
          ]),
          phantom: false,
          matchResults: [],
        };
      });

    this.originItems = [...markdownItems, ...phantomItems];
    this.ignoredItems = this.ignoreItems(initialMode);
  }

  async handleCreateNew(searchQuery: string, newLeaf: boolean) {
    const file = await this.appHelper.createMarkdown(this.searchQuery);
    if (!file) {
      // noinspection ObjectAllocationIgnored
      new Notice("This file already exists.");
      return;
    }

    this.appHelper.openMarkdownFile(file, newLeaf);
    this.close();
  }

  ignoreItems(mode: Mode): SuggestionItem[] {
    const _ignoreItems = (patterns: string): SuggestionItem[] =>
      ignoreItems(this.originItems, patterns, (x) => x.file.path);

    switch (mode) {
      case "normal":
        return _ignoreItems(this.settings.ignoreNormalPathPrefixPatterns);
      case "recent":
        return _ignoreItems(this.settings.ignoreRecentPathPrefixPatterns);
      case "filename-recent":
        return _ignoreItems(
          this.settings.ignoreFilenameRecentPathPrefixPatterns
        );
      case "backlink":
        return _ignoreItems(this.settings.ignoreBackLinkPathPrefixPatterns);
    }
  }

  getSuggestions(query: string): SuggestionItem[] {
    const start = performance.now();

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
    } else if (query.startsWith(":f ")) {
      changeMode("filename-recent", 3);
    } else if (query.startsWith(":b ")) {
      changeMode("backlink", 3);
    } else {
      changeMode(this.initialMode);
    }

    this.searchQuery = searchQuery;

    const qs = searchQuery.split(" ").filter((x) => x);

    if (this.mode === "backlink") {
      const activeFilePath = this.app.workspace.getActiveFile()?.path;
      if (!activeFilePath) {
        return [];
      }

      // ✨ If I can use MetadataCache.getBacklinksForFile, I would like to use it instead of original createBacklinksMap :)
      const backlinksMap = this.appHelper.createBacklinksMap();
      const items = this.ignoredItems
        .filter((x) => backlinksMap[activeFilePath]?.has(x.file.path))
        .map((x) =>
          stampMatchResults(x, qs, this.settings.normalizeAccentsAndDiacritics)
        )
        .filter((x) => x.matchResults.every((x) => x.type !== "not found"))
        .slice(0, this.settings.maxNumberOfSuggestions);
      this.showDebugLog(() =>
        buildLogMessage(`Get suggestions: ${query}`, performance.now() - start)
      );
      return items;
    }

    const lastModifiedSorter = sorter(
      (x: SuggestionItem) => x.file.stat.mtime,
      "desc"
    );
    const lastOpenedSorter = sorter(
      (x: SuggestionItem) => lastOpenFileIndexByPath[x.file.path] ?? 65535
    );
    const nameSorter = sorter(
      (x: SuggestionItem) =>
        x.matchResults.filter(
          (x) => x.type === "prefix-name" || x.type === "name"
        ).length,
      "desc"
    );
    const prefixLengthSorter = sorter((x: SuggestionItem) => {
      const firstPrefixMatch =
        x.matchResults[0].type === "prefix-name" ? x.matchResults[0] : null;
      if (firstPrefixMatch) {
        return (
          1000 -
          (firstPrefixMatch.alias
            ? firstPrefixMatch.alias.length
            : x.file.name.length)
        );
      }
      return 0;
    }, "desc");

    if (!query) {
      return this.ignoredItems
        .sort(lastModifiedSorter)
        .sort(lastOpenedSorter)
        .slice(0, this.settings.maxNumberOfSuggestions);
    }

    const matchedSuggestions = this.ignoredItems
      .map((x) =>
        stampMatchResults(x, qs, this.settings.normalizeAccentsAndDiacritics)
      )
      .filter((x) => x.matchResults.every((x) => x.type !== "not found"));

    let suggestions = matchedSuggestions
      .sort(lastModifiedSorter)
      .sort(lastOpenedSorter);
    switch (this.mode) {
      case "filename-recent":
        suggestions = suggestions.sort(nameSorter);
        break;
      case "normal":
        suggestions = suggestions.sort(prefixLengthSorter).sort(nameSorter);
        break;
    }
    const items = suggestions.slice(0, this.settings.maxNumberOfSuggestions);

    this.showDebugLog(() =>
      buildLogMessage(`Get suggestions: ${query}`, performance.now() - start)
    );
    return items;
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const { itemDiv, descriptionDiv } = createElements(item, {
      showDirectory: this.settings.showDirectory,
      showAliasesOnTop: this.settings.showAliasesOnTop,
    });

    el.appendChild(itemDiv);
    if (descriptionDiv) {
      el.appendChild(descriptionDiv);
    }
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
            this.app.workspace.getActiveFile()! // never undefined
          )
        : undefined;

    this.appHelper.openMarkdownFile(
      fileToOpened,
      evt.ctrlKey || evt.metaKey,
      offset
    );
  }

  private showDebugLog(toMessage: () => string) {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(toMessage());
    }
  }
}

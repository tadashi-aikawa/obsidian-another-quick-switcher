import {
  App,
  debounce,
  Debouncer,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  SuggestModal,
} from "obsidian";
import { ignoreItems, keyBy, uniq } from "../utils/collection-helper";
import { Settings } from "../settings";
import { AppHelper, LeafType } from "../app-helper";
import { stampMatchResults, SuggestionItem } from "src/matcher";
import { createElements } from "./suggestion-factory";
import {
  fileNameRecentSort,
  recommendedRecentSort,
  normalSort,
  recentSort,
  starRecentSort,
} from "../sorters";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { excludeFormat } from "../utils/strings";
import { MOD, quickResultSelectionModifier } from "src/keys";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

export type Mode =
  | "normal"
  | "recent"
  | "backlink"
  | "filename-recent"
  | "recommended-recent"
  | "star-recent";

export class AnotherQuickSwitcherModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
  originItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  mode: Mode;
  settings: Settings;
  searchQuery: string;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void]
  >;

  constructor(app: App, public initialMode: Mode, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    this.setHotKeys();

    const phantomItems = this.settings.showExistingFilesOnly
      ? []
      : this.appHelper.searchPhantomFiles().map((x) => ({
          file: x,
          aliases: [],
          tags: [],
          headers: [],
          links: [],
          phantom: true,
          starred: false,
          matchResults: [],
          tokens: x.basename.split(" "),
        }));

    const starredPathMap = keyBy(
      this.appHelper.getStarredFilePaths(),
      (x) => x
    );
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
          headers: (cache.headings ?? []).map((x) => excludeFormat(x.heading)),
          links: uniq(cache.links?.map((x) => x.displayText ?? "") ?? []), //FIXME:
          phantom: false,
          starred: x.path in starredPathMap,
          matchResults: [],
          tokens: x.basename.split(" "),
        };
      });

    this.originItems = [...markdownItems, ...phantomItems];
    this.ignoredItems = this.ignoreItems(initialMode);

    this.debounceGetSuggestions = debounce(
      (query: string, cb: (items: SuggestionItem[]) => void) => {
        cb(this._getSuggestions(query));
      },
      this.settings.searchDelayMilliSeconds,
      true
    );
  }

  async handleCreateNew(searchQuery: string, leafType: LeafType) {
    const file = await this.appHelper.createMarkdown(this.searchQuery);
    if (!file) {
      // noinspection ObjectAllocationIgnored
      new Notice("This file already exists.");
      return;
    }

    this.appHelper.openMarkdownFile(file, { leaf: leafType });
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
      case "recommended-recent":
        return _ignoreItems(
          this.settings.ignoreFilenameRecentPathPrefixPatterns
        );
      case "star-recent":
        // do nothing
        return this.originItems;
      case "backlink":
        return _ignoreItems(this.settings.ignoreBackLinkPathPrefixPatterns);
    }
  }

  getSuggestions(query: string): SuggestionItem[] | Promise<SuggestionItem[]> {
    if (!query) {
      return this._getSuggestions(query);
    }

    return new Promise((resolve) => {
      this.debounceGetSuggestions(query, (items) => {
        resolve(items);
      });
    });
  }

  _getSuggestions(query: string): SuggestionItem[] {
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
    } else if (query.startsWith(":s ")) {
      changeMode("star-recent", 3);
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
          stampMatchResults(
            x,
            qs,
            false,
            false,
            false,
            this.settings.normalizeAccentsAndDiacritics
          )
        )
        .filter((x) => x.matchResults.every((x) => x.type !== "not found"))
        .slice(0, this.settings.maxNumberOfSuggestions);
      this.showDebugLog(() =>
        buildLogMessage(`Get suggestions: ${query}`, performance.now() - start)
      );
      return items.map((x, order) => ({ ...x, order }));
    }

    if (!query.trim()) {
      switch (this.mode) {
        case "star-recent":
          return starRecentSort(this.ignoredItems, lastOpenFileIndexByPath)
            .slice(0, this.settings.maxNumberOfSuggestions)
            .map((x, order) => ({ ...x, order }));
        default:
          return recentSort(this.ignoredItems, lastOpenFileIndexByPath)
            .slice(0, this.settings.maxNumberOfSuggestions)
            .map((x, order) => ({ ...x, order }));
      }
    }

    const matchedSuggestions = this.ignoredItems
      .map((x) =>
        stampMatchResults(
          x,
          qs,
          true,
          this.settings.searchFromHeaders,
          this.settings.searchByLinks,
          this.settings.normalizeAccentsAndDiacritics
        )
      )
      .filter((x) => x.matchResults.every((x) => x.type !== "not found"));

    let items: SuggestionItem[] = [];
    switch (this.mode) {
      case "normal":
        items = normalSort(matchedSuggestions, lastOpenFileIndexByPath);
        break;
      case "recent":
        items = recentSort(matchedSuggestions, lastOpenFileIndexByPath);
        break;
      case "filename-recent":
        items = fileNameRecentSort(matchedSuggestions, lastOpenFileIndexByPath);
        break;
      case "recommended-recent":
        items = recommendedRecentSort(
          matchedSuggestions,
          lastOpenFileIndexByPath
        );
        break;
      case "star-recent":
        items = starRecentSort(matchedSuggestions, lastOpenFileIndexByPath);
        break;
    }

    this.showDebugLog(() =>
      buildLogMessage(`Get suggestions: ${query}`, performance.now() - start)
    );

    return items
      .slice(0, this.settings.maxNumberOfSuggestions)
      .map((x, order) => ({ ...x, order }));
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const { itemDiv, descriptionDiv } = createElements(item, {
      showDirectory: this.settings.showDirectory,
      showFullPathOfDirectory: this.settings.showFullPathOfDirectory,
      showAliasesOnTop: this.settings.showAliasesOnTop,
      hideGutterIcons: this.settings.hideGutterIcons,
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
    if (evt.altKey && !evt.metaKey) {
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
        : 0;

    this.appHelper.openMarkdownFile(fileToOpened, {
      leaf:
        evt.metaKey && (evt as KeyboardEvent).key === "o"
          ? "popout"
          : evt.metaKey && evt.altKey
          ? "popup"
          : evt.metaKey
          ? "new"
          : "same",
      offset,
    });
  }

  private showDebugLog(toMessage: () => string) {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(toMessage());
    }
  }

  private setHotKeys() {
    const openNthMod = quickResultSelectionModifier(
      this.settings.userAltInsteadOfModForQuickResultSelection
    );

    this.setInstructions([
      {
        command: `[↑↓][${MOD} n or p][${MOD} j or k]`,
        purpose: "navigate",
      },
      { command: `[${openNthMod} 1~9]`, purpose: "open Nth" },
      { command: `[${MOD} d]`, purpose: "clear input" },
      { command: "[tab]", purpose: "replace input" },
      { command: "[↵]", purpose: "open" },
      { command: `[${MOD} ↵]`, purpose: "open in new pane" },
      { command: `[${MOD} o]`, purpose: "open in new window" },
      { command: `[${MOD} alt ↵]`, purpose: "open in popup" },
      { command: "[shift ↵]", purpose: "create" },
      { command: `[${MOD} shift ↵]`, purpose: "create in new pane" },
      { command: `[${MOD} shift o]`, purpose: "create in new window" },
      { command: `[${MOD} shift alt ↵]`, purpose: "create in popup" },
      { command: "[alt ↵]", purpose: "insert to editor" },
      { command: "[esc]", purpose: "dismiss" },
    ]);

    this.scope.register(["Mod"], "Enter", () =>
      this.chooser.useSelectedItem({ metaKey: true })
    );
    this.scope.register(["Alt"], "Enter", () =>
      this.chooser.useSelectedItem({ altKey: true })
    );
    this.scope.register(["Mod"], "o", () =>
      this.chooser.useSelectedItem({ metaKey: true, key: "o" })
    );
    this.scope.register(["Mod", "Alt"], "Enter", () =>
      this.chooser.useSelectedItem({ metaKey: true, altKey: true })
    );

    const modifierKey = this.settings.userAltInsteadOfModForQuickResultSelection
      ? "Alt"
      : "Mod";
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => {
      this.scope.register([modifierKey], String(n), () => {
        this.chooser.setSelectedItem(n - 1, true);
        this.chooser.useSelectedItem({});
      });
    });

    this.scope.register(["Shift"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, "same");
      }
    });
    this.scope.register(["Shift", "Mod"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, "new");
      }
    });
    this.scope.register(["Shift", "Mod"], "o", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, "popout");
      }
    });
    this.scope.register(["Shift", "Mod", "Alt"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, "popup");
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

    this.scope.register([], "Tab", (evt) => {
      evt.preventDefault();

      if (this.chooser.values) {
        this.inputEl.value =
          this.chooser.values[this.chooser.selectedItem].file.basename;
        // Necessary to rerender suggestions
        this.inputEl.dispatchEvent(new Event("input"));
      }
    });
    this.scope.register(["Mod"], "D", () => {
      this.inputEl.value = "";
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    });
  }
}

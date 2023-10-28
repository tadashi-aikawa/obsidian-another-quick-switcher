import {
  App,
  debounce,
  Debouncer,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  Platform,
  SuggestModal,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import {
  excludeItems,
  includeItems,
  keyBy,
  omitBy,
  sorter,
  uniq,
} from "../utils/collection-helper";
import {
  createDefaultBacklinkSearchCommand,
  createDefaultLinkSearchCommand,
  Hotkeys,
  SearchCommand,
  Settings,
} from "../settings";
import {
  AppHelper,
  LeafType,
  CaptureState,
  isFrontMatterLinkCache,
  FrontMatterLinkCache,
} from "../app-helper";
import { stampMatchResults, SuggestionItem } from "src/matcher";
import { createElements } from "./suggestion-factory";
import { filterNoQueryPriorities, sort } from "../sorters";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import {
  capitalizeFirstLetter,
  excludeFormat,
  smartWhitespaceSplit,
} from "../utils/strings";
import { createInstructions, quickResultSelectionModifier } from "src/keys";
import { FILTER, HEADER, LINK, SEARCH, TAG } from "./icons";
import { ExhaustiveError } from "../errors";
import { setFloatingModal } from "./modal";
import { Logger } from "../utils/logger";

interface CustomSearchHistory {
  originFile: TFile | null;
  command: SearchCommand;
  inputQuery: string;
}

export class AnotherQuickSwitcherModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
  logger: Logger;
  originItems: SuggestionItem[];
  phantomItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  settings: Settings;
  initialInputQuery: string;
  searchQuery: string;
  originFile: TFile | null;
  navigationHistories: CustomSearchHistory[];
  currentNavigationHistoryIndex: number;
  stackHistory: boolean;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void],
    void
  >;

  command: SearchCommand;
  initialCommand: SearchCommand;

  initialLeaf: WorkspaceLeaf | null;
  stateToRestore?: CaptureState;

  navigationHistoryEl?: HTMLDivElement;
  searchCommandEl?: HTMLDivElement;
  defaultInputEl?: HTMLDivElement;
  countInputEl?: HTMLDivElement;
  floating: boolean;
  opened: boolean;
  willSilentClose: boolean = false;
  historyRestoreStatus: "initial" | "doing" | "done" = "initial";

  private markClosed: () => void;
  isClosed: Promise<void> = new Promise((resolve) => {
    this.markClosed = resolve;
  });
  navQueue: Promise<void>;

  constructor(args: {
    app: App;
    settings: Settings;
    command: SearchCommand;
    originFile: TFile | null;
    inputQuery: string;
    navigationHistories: CustomSearchHistory[];
    currentNavigationHistoryIndex: number;
    stackHistory: boolean;
    initialLeaf: WorkspaceLeaf | null;
    initialState?: CaptureState;
    navQueue?: Promise<void>;
  }) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = args.settings;
    this.logger = Logger.of(this.settings);
    this.initialCommand = args.command;
    this.command = args.command;
    this.originFile = args.originFile;
    this.floating = args.command.floating;
    this.initialInputQuery = args.inputQuery;
    this.navigationHistories = args.navigationHistories;
    this.currentNavigationHistoryIndex = args.currentNavigationHistoryIndex;
    this.stackHistory = args.stackHistory;
    this.initialLeaf = args.initialLeaf;
    this.stateToRestore = args.initialState;
    this.navQueue = args.navQueue ?? Promise.resolve();

    this.limit = this.settings.maxNumberOfSuggestions;
    this.setHotkeys();

    this.phantomItems = this.settings.showExistingFilesOnly
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

    this.indexingItems();

    this.debounceGetSuggestions = debounce(
      (query: string, cb: (items: SuggestionItem[]) => void) => {
        cb(this._getSuggestions(query));
      },
      this.settings.searchDelayMilliSeconds,
      true
    );
  }

  close() {
    if (Platform.isMobile) {
      // https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/207
      this.onClose();
    }
    super.close();
  }

  safeClose(): Promise<void> {
    this.close();
    return this.isClosed;
  }

  silentClose() {
    this.willSilentClose = true;
    this.close();
  }

  onOpen() {
    super.onOpen();

    if (this.command.floating) {
      this.enableFloating();
    }

    this.inputEl.value = this.initialInputQuery;
    // Necessary to rerender suggestions
    this.inputEl.dispatchEvent(new Event("input"));

    if (this.stackHistory) {
      this.navigationHistories.push({
        inputQuery: this.inputEl.value,
        command: { ...this.command },
        originFile: this.originFile,
      });
    }

    this.opened = true;
  }

  onClose() {
    super.onClose();
    if (this.willSilentClose) {
      return;
    }
    if (this.stateToRestore) {
      this.navigate(() => this.stateToRestore!.restore());
    }
    this.navigate(this.markClosed);
  }

  enableFloating() {
    this.floating = true;
    if (!Platform.isMobile) {
      setFloatingModal(this.appHelper);
    }
  }

  indexingItems() {
    const starredPathMap = keyBy(
      this.appHelper.getStarredFilePaths(),
      (x) => x
    );
    const originFilePath = this.originFile?.path;

    let start = performance.now();
    const fileItems = app.vault
      .getFiles()
      .filter(
        (x) => x.path !== originFilePath && app.metadataCache.getFileCache(x)
      )
      .map((x) => {
        const cache = app.metadataCache.getFileCache(x)!; // already filtered
        return {
          file: x,
          aliases: parseFrontMatterAliases(cache.frontmatter) ?? [],
          tags: this.command.searchBy.tag
            ? uniq([
                ...(cache.tags ?? []).map((x) => x.tag),
                ...(parseFrontMatterTags(cache.frontmatter) ?? []),
              ])
            : [],
          headers: this.command.searchBy.header
            ? (cache.headings ?? []).map((x) => excludeFormat(x.heading))
            : [],
          links: this.command.searchBy.link
            ? uniq(
                [
                  ...(cache.links ?? []),
                  ...(((cache as any)
                    .frontmatterLinks as FrontMatterLinkCache[]) ?? []),
                ].map((x) => x.displayText ?? "")
              )
            : [],
          frontMatter:
            this.command.showFrontMatter && cache.frontmatter
              ? omitBy(cache.frontmatter, (key, _) => key === "position")
              : undefined,
          phantom: false,
          starred: x.path in starredPathMap,
          matchResults: [],
          tokens: x.basename.split(" "),
        };
      });
    this.logger.showDebugLog(`Indexing file items: `, start);

    this.originItems = [...fileItems, ...this.phantomItems];

    start = performance.now();
    this.ignoredItems = this.prefilterItems(this.command);
    this.logger.showDebugLog(`Prefilter items: `, start);
  }

  prefilterItems(command: SearchCommand): SuggestionItem[] {
    const filterItems = (
      includePatterns: string[],
      excludePatterns: string[]
    ): SuggestionItem[] => {
      let items = this.originItems;
      if (command.targetExtensions.length > 0) {
        items = items.filter((x) =>
          command.targetExtensions.includes(x.file.extension)
        );
      }

      switch (command.searchTarget) {
        case "file":
          break;
        case "backlink":
          const backlinksMap = this.appHelper.createBacklinksMap();
          items = items.filter((x) =>
            backlinksMap[this.originFile?.path ?? ""]?.has(x.file.path)
          );
          break;
        case "link":
          const originFileLinkMap = this.originFile
            ? this.appHelper.createLinksMap(this.originFile)
            : {};

          items = items
            .filter((x) => originFileLinkMap[x.file.path])
            .sort(
              sorter((x) => {
                const c = originFileLinkMap[x.file.path];
                return isFrontMatterLinkCache(c) ? -1 : c.position.start.offset;
              })
            );
          break;
        case "2-hop-link":
          const backlinksMap2 = this.appHelper.createBacklinksMap();
          const originFileLinkMap2 = this.originFile
            ? this.appHelper.createLinksMap(this.originFile)
            : {};
          const linkPaths = items
            .filter((x) => originFileLinkMap2[x.file.path])
            .map((x) => x.file.path);
          const backlinkPaths = linkPaths.flatMap((x) =>
            Array.from(backlinksMap2[x])
          );

          const filteredPaths = uniq([...linkPaths, ...backlinkPaths]);
          items = items
            .filter((x) => filteredPaths.includes(x.file.path))
            .sort(
              sorter((x) => {
                const c = originFileLinkMap2[x.file.path];
                return !c || isFrontMatterLinkCache(c)
                  ? 65535
                  : c.position.start.offset;
              })
            );
          break;
      }
      if (includePatterns.length > 0) {
        items = includeItems(items, includePatterns, (x) => x.file.path);
      }
      if (excludePatterns.length > 0) {
        items = excludeItems(items, excludePatterns, (x) => x.file.path);
      }
      return items;
    };

    return filterItems(
      command.includePrefixPathPatterns.map((p) =>
        p.replace(/<current_dir>/g, this.appHelper.getCurrentDirPath())
      ),
      command.excludePrefixPathPatterns.map((p) =>
        p.replace(/<current_dir>/g, this.appHelper.getCurrentDirPath())
      )
    );
  }

  getSuggestions(query: string): SuggestionItem[] | Promise<SuggestionItem[]> {
    if (!query || query === this.command.defaultInput || !this.opened) {
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

    const commandByPrefix = this.settings.searchCommands
      .filter((x) => x.commandPrefix)
      .find((x) => query.startsWith(x.commandPrefix));

    if (
      (commandByPrefix || this.initialCommand !== this.command) &&
      commandByPrefix !== this.command
    ) {
      this.command = commandByPrefix ?? this.initialCommand;
      this.indexingItems(); // slow?
    }
    this.searchQuery = query.startsWith(this.command.commandPrefix)
      ? query.replace(this.command.commandPrefix, "")
      : query;
    this.searchQuery = this.searchQuery.replace(
      /<cd>/g,
      this.appHelper.getCurrentDirPath()
    );
    if (this.command.defaultInput) {
      this.searchQuery = `${this.command.defaultInput}${this.searchQuery}`;
    }

    this.renderInputComponent();

    const qs = smartWhitespaceSplit(this.searchQuery);

    if (this.command.searchTarget === "backlink" && !this.originFile?.path) {
      return [];
    }

    const isQueryEmpty = !this.searchQuery.trim();

    const matchedSuggestions = isQueryEmpty
      ? this.ignoredItems
      : this.ignoredItems
          .map((x) =>
            stampMatchResults(x, qs, {
              isNormalizeAccentsDiacritics:
                this.settings.normalizeAccentsAndDiacritics,
              searchByHeaders: this.command.searchBy.header,
              searchByLinks: this.command.searchBy.link,
              searchByTags: this.command.searchBy.tag,
              fuzzyTarget: this.command.allowFuzzySearchForSearchTarget,
              minFuzzyScore: this.command.minFuzzyMatchScore,
            })
          )
          .filter((x) => x.matchResults.every((x) => x.type !== "not found"));

    const items = sort(
      matchedSuggestions,
      isQueryEmpty
        ? filterNoQueryPriorities(this.command.sortPriorities)
        : this.command.sortPriorities,
      lastOpenFileIndexByPath
    );

    this.logger.showDebugLog(
      `Get suggestions: ${this.searchQuery} (${this.command.name})`,
      start
    );

    this.countInputEl = createDiv({
      text: `${Math.min(items.length, this.limit)} / ${items.length}`,
      cls: "another-quick-switcher__status__count-input",
    });
    this.inputEl.before(this.countInputEl);

    return items.slice(0, this.limit).map((x, order) => ({ ...x, order }));
  }

  renderInputComponent() {
    this.navigationHistoryEl?.remove();
    this.searchCommandEl?.remove();
    this.defaultInputEl?.remove();
    this.countInputEl?.remove();

    this.navigationHistoryEl = createDiv({
      cls: "another-quick-switcher__custom-search__navigation-history-header",
    });
    const backHistoryLength = this.currentNavigationHistoryIndex;
    if (backHistoryLength > 0) {
      this.navigationHistoryEl.appendText(`${backHistoryLength} < `);
    }
    this.navigationHistoryEl.appendText(
      this.originFile ? this.originFile.basename : "No file"
    );
    const forwardHistoryLength =
      this.navigationHistories.length - this.currentNavigationHistoryIndex - 1;
    if (forwardHistoryLength > 0) {
      this.navigationHistoryEl.appendText(` > ${forwardHistoryLength}`);
    }
    this.inputEl.before(this.navigationHistoryEl);

    this.searchCommandEl = createDiv({
      cls: "another-quick-switcher__status__search-command",
    });
    this.searchCommandEl.insertAdjacentHTML("beforeend", SEARCH);

    this.searchCommandEl.createSpan({
      text: this.command.name,
      cls: "another-quick-switcher__status__search-command-name",
    });
    this.searchCommandEl.createSpan({
      cls: "another-quick-switcher__status__search-command-separator",
    });

    if (this.command.searchBy.tag) {
      this.searchCommandEl.insertAdjacentHTML("beforeend", TAG);
    }
    if (this.command.searchBy.header) {
      this.searchCommandEl.insertAdjacentHTML("beforeend", HEADER);
    }
    if (this.command.searchBy.link) {
      this.searchCommandEl.insertAdjacentHTML("beforeend", LINK);
    }

    // For the bugfix (can't scroll on the mobile)
    const promptInputContainer = this.modalEl.find(".prompt-input-container");
    if (promptInputContainer) {
      promptInputContainer.setAttr("style", "display: initial");
    }

    this.inputEl.before(this.searchCommandEl);

    if (this.command.defaultInput) {
      this.defaultInputEl = createDiv({
        text: this.searchQuery,
        cls: "another-quick-switcher__status__default-input",
      });
      this.defaultInputEl.insertAdjacentHTML("afterbegin", FILTER);
      this.resultContainerEl.before(this.defaultInputEl);
    }
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const { itemDiv, metaDiv, descriptionDiv } = createElements(item, {
      showFrontMatter: this.command.showFrontMatter,
      excludeFrontMatterKeys: this.command.excludeFrontMatterKeys,
      showDirectory: this.settings.showDirectory,
      showDirectoryAtNewLine: this.settings.showDirectoryAtNewLine,
      showFullPathOfDirectory: this.settings.showFullPathOfDirectory,
      showAliasesOnTop: this.settings.showAliasesOnTop,
      hideGutterIcons: this.settings.hideGutterIcons,
      showFuzzyMatchScore: this.settings.showFuzzyMatchScore,
    });

    if (metaDiv?.hasChildNodes()) {
      itemDiv.appendChild(metaDiv);
    }
    if (descriptionDiv?.hasChildNodes()) {
      itemDiv.appendChild(descriptionDiv);
    }
    el.appendChild(itemDiv);
  }

  onNoSuggestion() {
    super.onNoSuggestion();

    const div = createDiv({
      cls: "another-quick-switcher__command_buttons",
    });

    const createButton = createEl("button", {
      text: "Create",
      cls: "another-quick-switcher__command_button",
    });
    createButton.addEventListener("click", () =>
      this.handleCreateNewMarkdown(this.searchQuery, "same-tab")
    );
    div.appendChild(createButton);

    const searchInGoogleButton = createEl("button", {
      text: "Search in google",
      cls: "another-quick-switcher__command_button",
    });
    searchInGoogleButton.addEventListener("click", () => {
      activeWindow.open(`https://www.google.com/search?q=${this.searchQuery}`);
      this.close();
    });
    div.appendChild(searchInGoogleButton);

    this.resultContainerEl.appendChild(div);
  }

  navigate(cb: () => any) {
    this.navQueue = this.navQueue.then(cb);
  }

  async chooseCurrentSuggestion(
    leaf: LeafType,
    option: { keepOpen?: boolean } = {}
  ): Promise<TFile | null> {
    const item = this.chooser.values?.[this.chooser.selectedItem];
    if (!item) {
      return null;
    }

    let fileToOpened = item.file;
    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }

    let offset: number | undefined;
    switch (this.command.searchTarget) {
      case "file":
        if (item.matchResults[0]?.type === "header") {
          // If type is "header", meta[0] is not empty
          const firstHeader = item.matchResults[0].meta![0];
          offset =
            this.appHelper.findFirstHeaderOffset(item.file, firstHeader) ??
            undefined;
        }
        break;
      case "backlink":
        offset = this.appHelper.findFirstLinkOffset(
          item.file,
          this.originFile!
        );
        break;
      case "link":
        break;
      case "2-hop-link":
        break;
      default:
        throw new ExhaustiveError(this.command.searchTarget as never);
    }

    if (!option.keepOpen) {
      this.close();
      this.navigate(() => this.isClosed); // wait for close to finish before navigating
    } else if (leaf === "same-tab") {
      this.stateToRestore ??= this.appHelper.captureState(this.initialLeaf);
    }

    this.navigate(() =>
      this.appHelper.openFile(
        fileToOpened,
        { leaf, offset, inplace: option.keepOpen },
        this.stateToRestore
      )
    );
    return fileToOpened;
  }

  async onChooseSuggestion(
    item: SuggestionItem,
    evt: MouseEvent | KeyboardEvent
  ): Promise<any> {
    await this.chooseCurrentSuggestion("same-tab");
  }

  private showDebugLog(toMessage: () => string) {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(toMessage());
    }
  }

  async handleCreateNewMarkdown(
    searchQuery: string,
    leafType: LeafType
  ): Promise<boolean> {
    if (!searchQuery) {
      return true;
    }

    const file = await this.appHelper.createMarkdown(this.searchQuery);
    if (!file) {
      // noinspection ObjectAllocationIgnored
      new Notice("This file already exists.");
      return true;
    }

    this.close();
    this.navigate(() => this.isClosed);
    this.navigate(() => this.appHelper.openFile(file, { leaf: leafType }));
    return false;
  }

  private registerKeys(
    key: keyof Hotkeys["main"],
    handler: () => void | Promise<void>
  ) {
    this.settings.hotkeys.main[key]?.forEach((x) => {
      this.scope.register(x.modifiers, capitalizeFirstLetter(x.key), (evt) => {
        if (!evt.isComposing) {
          evt.preventDefault();
          handler();
          return false;
        }
      });
    });
  }

  private setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Enter")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    const openNthMod = quickResultSelectionModifier(
      this.settings.userAltInsteadOfModForQuickResultSelection
    );

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: `[↑]`, purpose: "up" },
        { command: `[↓]`, purpose: "down" },
        { command: `[${openNthMod} 1~9]`, purpose: "open Nth" },
        ...createInstructions(this.settings.hotkeys.main),
      ]);
    }

    this.registerKeys("up", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.registerKeys("down", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
      );
    });

    this.registerKeys("clear input", () => {
      this.inputEl.value = "";
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    });
    this.registerKeys("replace input", () => {
      if (this.chooser.values) {
        this.inputEl.value =
          this.chooser.values[this.chooser.selectedItem].file.basename;
        // Necessary to rerender suggestions
        this.inputEl.dispatchEvent(new Event("input"));
      }
    });

    this.registerKeys("open", async () => {
      await this.chooseCurrentSuggestion("same-tab");
    });
    this.registerKeys("open in new tab", async () => {
      await this.chooseCurrentSuggestion("new-tab");
    });
    this.registerKeys("open in new pane (horizontal)", async () => {
      await this.chooseCurrentSuggestion("new-pane-horizontal");
    });
    this.registerKeys("open in new pane (vertical)", async () => {
      await this.chooseCurrentSuggestion("new-pane-vertical");
    });
    this.registerKeys("open in new window", async () => {
      await this.chooseCurrentSuggestion("new-window");
    });
    this.registerKeys("open in popup", async () => {
      await this.chooseCurrentSuggestion("popup");
    });
    this.registerKeys("open in new tab in background", async () => {
      await this.chooseCurrentSuggestion("new-tab-background", {
        keepOpen: true,
      });
    });
    this.registerKeys("open all in new tabs", () => {
      this.close();
      if (this.chooser.values == null) {
        return;
      }

      this.chooser.values
        .slice()
        .reverse()
        .forEach((x) =>
          this.appHelper.openFile(x.file, {
            leaf: "new-tab-background",
          })
        );
    });

    this.registerKeys("preview", () => {
      if (!this.floating) {
        this.enableFloating();
      }
      this.chooseCurrentSuggestion("same-tab", {
        keepOpen: true,
      });
    });

    this.registerKeys("create", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "same-tab");
    });
    this.registerKeys("create in new tab", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "new-tab");
    });
    this.registerKeys("create in new window", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "new-window");
    });
    this.registerKeys("create in new popup", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "popup");
    });

    this.registerKeys("open in default app", () => {
      const file = this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!file) {
        return;
      }

      this.appHelper.openFileInDefaultApp(file);
      this.close();
    });
    this.registerKeys("show in system explorer", () => {
      const file = this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!file) {
        return;
      }

      this.appHelper.openInSystemExplorer(file);
      this.close();
    });
    this.registerKeys("open in google", () => {
      activeWindow.open(`https://www.google.com/search?q=${this.searchQuery}`);
      this.close();
    });
    this.registerKeys("open first URL", async () => {
      const fileToOpened =
        this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!fileToOpened) {
        return;
      }

      this.close();
      await this.isClosed;

      const urls = await this.appHelper.findExternalLinkUrls(fileToOpened);
      if (urls.length > 0) {
        activeWindow.open(urls[0]);
      } else {
        this.appHelper.openFile(fileToOpened, {
          leaf: "same-tab",
        });
      }
    });

    this.registerKeys("insert to editor", async () => {
      const file = this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!file) {
        return;
      }

      await this.safeClose();

      if (this.appHelper.isActiveLeafCanvas()) {
        this.appHelper.addFileToCanvas(file);
      } else {
        this.appHelper.insertLinkToActiveFileBy(
          file,
          this.chooser.values?.[this.chooser.selectedItem]?.phantom ?? false
        );
      }
    });

    this.registerKeys("insert to editor in background", async () => {
      const file = this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!file) {
        return;
      }

      this.historyRestoreStatus = "doing";
      if (this.stateToRestore) {
        await this.stateToRestore.restore();
        this.stateToRestore = undefined;
      }

      if (this.appHelper.isActiveLeafCanvas()) {
        this.appHelper.addFileToCanvas(file);
      } else {
        this.appHelper.insertLinkToActiveFileBy(
          file,
          this.chooser.values?.[this.chooser.selectedItem]?.phantom ?? false
        );
        this.appHelper.insertStringToActiveFile("\n");
      }
    });

    this.registerKeys("insert all to editor", async () => {
      await this.safeClose();

      let offsetX = 0;
      this.chooser.values?.forEach((x) => {
        if (this.appHelper.isActiveLeafCanvas()) {
          const cv = this.appHelper.addFileToCanvas(x.file, {
            x: offsetX,
            y: 0,
          });
          offsetX += cv.width + 30;
        } else {
          this.appHelper.insertLinkToActiveFileBy(x.file, x.phantom);
          this.appHelper.insertStringToActiveFile("\n");
        }
      });
    });

    const navigateLinks = (command: SearchCommand) => {
      const file = this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!file) {
        return;
      }

      this.silentClose();
      const modal = new AnotherQuickSwitcherModal({
        app: this.app,
        settings: this.settings,
        command: {
          ...command,
          floating: this.floating,
        },
        originFile: file,
        inputQuery: "",
        navigationHistories: [
          ...this.navigationHistories.slice(
            0,
            this.currentNavigationHistoryIndex
          ),
          {
            inputQuery: this.inputEl.value,
            command: { ...this.command },
            originFile: this.originFile,
          },
        ],
        currentNavigationHistoryIndex: this.currentNavigationHistoryIndex + 1,
        stackHistory: true,
        initialLeaf: this.initialLeaf,
        initialState: this.stateToRestore,
        navQueue: this.navQueue,
      });
      modal.open();
    };

    this.registerKeys("show links", () => {
      navigateLinks(createDefaultLinkSearchCommand());
    });

    this.registerKeys("show backlinks", () => {
      navigateLinks(createDefaultBacklinkSearchCommand());
    });

    this.registerKeys("show all results", () => {
      this.limit = Number.MAX_SAFE_INTEGER;
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    });

    const navigate = (index: number) => {
      const history = this.navigationHistories[index];
      if (!history) {
        return;
      }

      this.silentClose();
      const modal = new AnotherQuickSwitcherModal({
        app: this.app,
        settings: this.settings,
        command: {
          ...history.command,
          floating: this.floating,
        },
        originFile: history.originFile,
        inputQuery: history.inputQuery,
        navigationHistories: this.navigationHistories,
        currentNavigationHistoryIndex: index,
        stackHistory: false,
        initialState: this.stateToRestore,
        initialLeaf: this.initialLeaf,
        navQueue: this.navQueue,
      });
      modal.open();
    };

    this.registerKeys("navigate back", () => {
      navigate(this.currentNavigationHistoryIndex - 1);
    });

    this.registerKeys("navigate forward", () => {
      navigate(this.currentNavigationHistoryIndex + 1);
    });

    const modifierKey = this.settings.userAltInsteadOfModForQuickResultSelection
      ? "Alt"
      : "Mod";
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => {
      this.scope.register([modifierKey], String(n), (evt: KeyboardEvent) => {
        this.chooser.setSelectedItem(n - 1, evt);
        // noinspection JSIgnoredPromiseFromCall (This call back needs to return false, not Promise<false>)
        this.chooseCurrentSuggestion("same-tab");
        return false;
      });
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

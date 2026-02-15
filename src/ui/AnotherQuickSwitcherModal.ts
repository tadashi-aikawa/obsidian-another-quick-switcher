import {
  type App,
  type Debouncer,
  debounce,
  Notice,
  Platform,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";
import {
  createInstructions,
  normalizeKey,
  quickResultSelectionModifier,
} from "src/keys";
import {
  getMatchedTitleAndAliases,
  type SuggestionItem,
  stampMatchResults,
} from "src/matcher";
import {
  AppHelper,
  type CaptureState,
  type FrontMatterLinkCache,
  isFrontMatterLinkCache,
  type LeafHistorySnapshot,
  type LeafType,
} from "../app-helper";
import { showGrepDialog } from "../commands";
import { ExhaustiveError } from "../errors";
import {
  createDefaultBacklinkSearchCommand,
  createDefaultLinkSearchCommand,
  type Hotkeys,
  type SearchCommand,
  type Settings,
} from "../settings";
import {
  filterNoQueryPriorities,
  isPropertySortPriority,
  sort,
} from "../sorters";
import {
  excludeItems,
  includeItems,
  keyBy,
  omitBy,
  sorter,
  uniq,
} from "../utils/collection-helper";
import { Logger } from "../utils/logger";
import { toLeafType } from "../utils/mouse";
import {
  capitalizeFirstLetter,
  excludeFormat,
  smartWhitespaceSplit,
} from "../utils/strings";
import { AbstractSuggestionModal } from "./AbstractSuggestionModal";
import { FILTER, HEADER, LINK, PREVIEW, SEARCH, TAG } from "./icons";
import { setFloatingModal } from "./modal";
import { createElements } from "./suggestion-factory";

const globalInternalStorage: {
  query: string;
  queryHistories: string[];
} = {
  query: "",
  queryHistories: [],
};

interface CustomSearchHistory {
  originFile: TFile | null;
  command: SearchCommand;
  inputQuery: string;
}

export class AnotherQuickSwitcherModal extends AbstractSuggestionModal<SuggestionItem> {
  logger: Logger;
  originItems: SuggestionItem[];
  phantomItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  settings: Settings;
  initialInputQuery: string | null;
  searchQuery: string;
  originFile: TFile | null;
  navigationHistories: CustomSearchHistory[];
  currentNavigationHistoryIndex: number;
  stackHistory: boolean;
  queryHistoryIndex: number;
  queryHistoryBaseQuery: string | null;

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void],
    void
  >;

  command: SearchCommand;
  initialCommand: SearchCommand;

  initialLeaf: WorkspaceLeaf | null;
  stateToRestore?: CaptureState;
  historySnapshot: LeafHistorySnapshot | null;
  recentHistorySnapshot: string[] | null;
  recentHistoryBaseFilePath: string | null;
  usedPreview = false;
  skipRestoreOnClose = false;
  skipRecentHistoryRestoreOnClose = false;

  navigationHistoryEl?: HTMLDivElement;
  searchCommandEl?: HTMLDivElement;
  defaultInputEl?: HTMLDivElement;
  countInputEl?: HTMLDivElement;
  countWrapperEl?: HTMLDivElement;
  floating: boolean;
  opened: boolean;
  willSilentClose = false;
  historyRestoreStatus: "initial" | "doing" | "done" = "initial";

  private markClosed: () => void;
  isClosed: Promise<void> = new Promise((resolve) => {
    this.markClosed = resolve;
  });
  navQueue: Promise<void>;
  debouncePreview?: Debouncer<[], void>;
  debouncePreviewCancelListener?: () => void;
  autoPreviewConfigKey?: string;
  autoPreviewEnabled: boolean;
  previewIcon: Element | null;
  originalSetSelectedItem?: (selectedIndex: number, evt?: any) => void;

  lastOpenFileIndexByPath: { [path: string]: number } = {};

  // API mode properties
  private apiMode = false;
  private resolveApiPromise: ((files: TFile[] | null) => void) | null = null;

  toKey(item: SuggestionItem): string {
    return item.file.path;
  }

  constructor(args: {
    app: App;
    settings: Settings;
    command: SearchCommand;
    originFile: TFile | null;
    inputQuery: string | null;
    navigationHistories: CustomSearchHistory[];
    currentNavigationHistoryIndex: number;
    stackHistory: boolean;
    initialLeaf: WorkspaceLeaf | null;
    initialState?: CaptureState;
    selectedItemMap?: { [key: string]: SuggestionItem };
    historySnapshot?: LeafHistorySnapshot | null;
    recentHistorySnapshot?: string[] | null;
    recentHistoryBaseFilePath?: string | null;
    navQueue?: Promise<void>;
    // API mode (for external script integration)
    apiMode?: boolean;
    resolveApiPromise?: ((files: TFile[] | null) => void) | null;
  }) {
    super(args.app);
    this.modalEl.addClass("another-quick-switcher__modal-prompt");

    this.appHelper = new AppHelper(args.app);
    this.settings = args.settings;
    this.logger = Logger.of(this.settings);
    this.initialCommand = args.command;
    this.command = args.command;
    this.autoPreviewEnabled = args.command.autoPreview;
    this.originFile = args.originFile;
    this.floating = args.command.floating;
    this.initialInputQuery = args.inputQuery;
    this.navigationHistories = args.navigationHistories;
    this.currentNavigationHistoryIndex = args.currentNavigationHistoryIndex;
    this.stackHistory = args.stackHistory;
    this.initialLeaf = args.initialLeaf;
    this.stateToRestore = args.initialState;
    this.historySnapshot = args.historySnapshot
      ? (args.historySnapshot ?? null)
      : this.appHelper.createLeafHistorySnapshot(
          this.initialLeaf ?? this.appHelper.getActiveFileLeaf(),
        );
    this.recentHistorySnapshot = args.recentHistorySnapshot
      ? (args.recentHistorySnapshot ?? null)
      : this.appHelper.captureLastOpenFilesSnapshot();
    this.recentHistoryBaseFilePath = args.recentHistoryBaseFilePath
      ? (args.recentHistoryBaseFilePath ?? null)
      : (this.appHelper.getActiveFile()?.path ?? null);
    this.navQueue = args.navQueue ?? Promise.resolve();
    this.selectedItemMap = args.selectedItemMap ?? this.selectedItemMap;
    this.queryHistoryIndex = globalInternalStorage.queryHistories.length;
    this.queryHistoryBaseQuery = null;
    // API mode
    this.apiMode = args.apiMode ?? false;
    this.resolveApiPromise = args.resolveApiPromise ?? null;

    this.limit = this.settings.maxNumberOfSuggestions;
    this.lastOpenFileIndexByPath = this.appHelper.createRecentFilePathMap();
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
      true,
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

  /**
   * Opens the modal and returns a promise that resolves to the selected file(s).
   * This method is used by the API for external script integration.
   *
   * @returns A promise that resolves to:
   *          - `TFile[]` if file(s) are selected
   *          - `null` if the dialog is cancelled
   */
  openAndGetValue(): Promise<TFile[] | null> {
    this.apiMode = true;
    return new Promise((resolve) => {
      this.resolveApiPromise = async (files: TFile[] | null) => {
        await sleep(100); // wait for modal close termination
        resolve(files);
      };
      this.open();
    });
  }

  onOpen() {
    // WARN: Instead of super.onOpen()
    this.isOpen = true;
    this.inputEl.value = this.command.restoreLastInput
      ? (this.initialInputQuery ?? globalInternalStorage.query)
      : (this.initialInputQuery ?? "");
    this.inputEl.select();
    this.updateSuggestions();
    this.resetQueryHistoryNavigationBase();

    if (this.command.floating || this.autoPreviewEnabled) {
      this.enableFloating();
    }

    if (this.stackHistory) {
      this.navigationHistories.push({
        inputQuery: this.inputEl.value,
        command: { ...this.command },
        originFile: this.originFile,
      });
    }

    this.opened = true;
    this.setupAutoPreviewListeners();
    this.refreshAutoPreviewIcon();
    this.requestAutoPreview();
  }

  onClose() {
    const latestInput = this.inputEl.value;
    super.onClose();
    this.disableFloatingModalWheelScroll();
    this.debouncePreview?.cancel();
    if (this.debouncePreviewCancelListener) {
      this.inputEl.removeEventListener(
        "keydown",
        this.debouncePreviewCancelListener,
      );
    }
    if (this.willSilentClose) {
      return;
    }

    if (this.apiMode && this.resolveApiPromise) {
      this.resolveApiPromise(null);
      this.resolveApiPromise = null;
    }

    const hasSuggestions = (this.chooser.values?.length ?? 0) > 0;
    if (hasSuggestions) {
      this.recordCurrentQueryToHistory(latestInput);
    } else {
      this.resetQueryHistoryNavigationBase();
    }

    if (this.command.restoreLastInput) {
      globalInternalStorage.query = this.inputEl.value;
    }

    if (this.stateToRestore && !this.skipRestoreOnClose) {
      this.navigate(() => this.stateToRestore!.restore());
    }
    this.skipRestoreOnClose = false;
    if (this.usedPreview && !this.skipRecentHistoryRestoreOnClose) {
      this.navigate(() => {
        // Restore recent history after preview to avoid polluting recents.
        this.scheduleRecentHistoryRestore(this.recentHistorySnapshot);
      });
    }
    this.skipRecentHistoryRestoreOnClose = false;
    this.navigate(this.markClosed);
  }

  enableFloating() {
    this.floating = true;
    if (!Platform.isPhone) {
      setFloatingModal(this.appHelper);
      this.enableFloatingModalWheelScroll();
    }
  }

  private setupAutoPreviewListeners() {
    if (!this.originalSetSelectedItem) {
      this.originalSetSelectedItem = this.chooser.setSelectedItem.bind(
        this.chooser,
      );
      this.chooser.setSelectedItem = (selectedIndex: number, evt?: any) => {
        this.originalSetSelectedItem?.(selectedIndex, evt);
        this.requestAutoPreview();
      };
    }

    if (!this.debouncePreviewCancelListener) {
      this.debouncePreviewCancelListener = () => {
        this.debouncePreview?.cancel();
      };
      this.inputEl.addEventListener(
        "keydown",
        this.debouncePreviewCancelListener,
      );
    }
  }

  private refreshAutoPreviewDebouncer() {
    const configKey = `${this.autoPreviewEnabled}-${
      this.command.autoPreviewDelayMilliSeconds
    }`;
    if (!this.autoPreviewEnabled) {
      this.debouncePreview?.cancel();
      this.debouncePreview = undefined;
      this.autoPreviewConfigKey = configKey;
      return;
    }

    if (this.autoPreviewConfigKey !== configKey || !this.debouncePreview) {
      this.debouncePreview?.cancel();
      this.debouncePreview = debounce(
        () => this.preview(),
        this.command.autoPreviewDelayMilliSeconds,
        true,
      );
      this.autoPreviewConfigKey = configKey;
    }
  }

  private refreshAutoPreviewIcon() {
    this.previewIcon?.remove();
    this.previewIcon = null;
    if (this.autoPreviewEnabled && this.searchCommandEl) {
      this.previewIcon = createDiv({
        cls: "another-quick-switcher__status__auto-preview-icon",
      });
      this.previewIcon.insertAdjacentHTML("beforeend", PREVIEW);
      this.searchCommandEl.appendChild(this.previewIcon);
    }
  }

  private requestAutoPreview() {
    this.refreshAutoPreviewDebouncer();
    if (!this.autoPreviewEnabled) {
      return;
    }
    this.debouncePreview?.();
  }

  private async preview() {
    const item = this.getSelectedItem();
    if (!item || item.phantom) {
      return;
    }

    if (!this.floating) {
      this.enableFloating();
    }
    await this.chooseCurrentSuggestion("same-tab", {
      keepOpen: true,
    });
  }

  indexingItems() {
    const starredPathMap = keyBy(
      this.appHelper.getStarredFilePaths(),
      (x) => x,
    );
    const originFilePath = this.originFile?.path;
    const relativeUpdatedPeriodPropertyKey =
      this.command.relativeUpdatedPeriodPropertyKey.trim();
    const shouldLoadFrontMatter =
      this.command.showFrontMatter ||
      this.command.searchBy.property ||
      this.command.sortPriorities.some(isPropertySortPriority) ||
      (this.command.relativeUpdatedPeriodSource === "property" &&
        relativeUpdatedPeriodPropertyKey.length > 0);

    let start = performance.now();
    const fileItems: SuggestionItem[] = this.app.vault
      .getFiles()
      .filter(
        (x) =>
          (this.command.includeCurrentFile || x.path !== originFilePath) &&
          this.app.metadataCache.getFileCache(x),
      )
      .map((x) => {
        const cache = this.app.metadataCache.getFileCache(x)!; // already filtered
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
                ].map((x) => x.displayText ?? ""),
              )
            : [],
          frontMatter:
            shouldLoadFrontMatter && cache.frontmatter
              ? omitBy(cache.frontmatter, (key, _) => key === "position")
              : undefined,
          phantom: false,
          starred: x.path in starredPathMap,
          matchResults: [],
          tokens: x.basename.split(" "),
        };
      });
    this.logger.showDebugLog("Indexing file items: ", start);

    this.originItems = [...fileItems, ...this.phantomItems];

    start = performance.now();
    this.ignoredItems = this.prefilterItems(this.command);
    this.logger.showDebugLog("Prefilter items: ", start);
  }

  prefilterItems(command: SearchCommand): SuggestionItem[] {
    const filterItems = (
      includePatterns: string[],
      excludePatterns: string[],
    ): SuggestionItem[] => {
      let items = this.originItems;
      if (command.targetExtensions.length > 0) {
        items = items.filter((x) =>
          command.targetExtensions.includes(x.file.extension),
        );
      }

      switch (command.searchTarget) {
        case "file":
          break;
        case "opened file": {
          const paths = this.appHelper.getFilePathsInActiveWindow();
          items = items.filter((x) => paths.includes(x.file.path));
          break;
        }
        case "backlink": {
          const backlinksMap = this.appHelper.createBacklinksMap();
          items = items.filter((x) =>
            backlinksMap[this.originFile?.path ?? ""]?.has(x.file.path),
          );
          break;
        }
        case "link": {
          const originFileLinkMap = this.originFile
            ? this.appHelper.createLinksMap(this.originFile)
            : {};

          items = items
            .filter((x) => originFileLinkMap[x.file.path])
            .sort(
              sorter((x) => {
                const c = originFileLinkMap[x.file.path];
                return isFrontMatterLinkCache(c) ? -1 : c.position.start.offset;
              }),
            );
          break;
        }
        case "2-hop-link": {
          const backlinksMap2 = this.appHelper.createBacklinksMap();
          const originFileLinkMap2 = this.originFile
            ? this.appHelper.createLinksMap(this.originFile)
            : {};
          const linkPaths = items
            .filter((x) => originFileLinkMap2[x.file.path])
            .map((x) => x.file.path);
          const backlinkPaths = linkPaths.flatMap((x) =>
            Array.from(backlinksMap2[x]),
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
              }),
            );
          break;
        }
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
        p.replace(/<current_dir>/g, this.appHelper.getCurrentDirPath()),
      ),
      command.excludePrefixPathPatterns.map((p) =>
        p.replace(/<current_dir>/g, this.appHelper.getCurrentDirPath()),
      ),
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

    const commandByPrefix = this.settings.searchCommands
      .filter((x) => x.commandPrefix)
      .find((x) => query.startsWith(x.commandPrefix));

    if (
      (commandByPrefix || this.initialCommand !== this.command) &&
      commandByPrefix !== this.command
    ) {
      this.command = commandByPrefix ?? this.initialCommand;
      this.autoPreviewEnabled = this.command.autoPreview;
      this.indexingItems(); // slow?
      this.refreshAutoPreviewDebouncer();
      this.refreshAutoPreviewIcon();
    }
    this.searchQuery = query.startsWith(this.command.commandPrefix)
      ? query.replace(this.command.commandPrefix, "")
      : query;
    if (this.command.defaultInput) {
      this.searchQuery = `${this.command.defaultInput}${this.searchQuery}`;
    }
    this.searchQuery = this.searchQuery.replace(
      /<cd>/g,
      this.appHelper.getCurrentDirPath(),
    );

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
              keysOfPropertyToSearch: this.command.searchBy.property
                ? this.command.keysOfPropertyToSearch
                : [],
              fuzzyTarget: this.command.allowFuzzySearchForSearchTarget,
              minFuzzyScore: this.command.minFuzzyMatchScore,
              excludePrefix: this.settings.searchesExcludePrefix,
            }),
          )
          .filter((x) => x.matchResults.every((x) => x.type !== "not found"));

    const items = sort(
      matchedSuggestions,
      isQueryEmpty
        ? filterNoQueryPriorities(this.command.sortPriorities)
        : this.command.sortPriorities,
      this.lastOpenFileIndexByPath,
    );

    this.logger.showDebugLog(
      `Get suggestions: ${this.searchQuery} (${this.command.name})`,
      start,
    );

    this.countWrapperEl?.remove();
    this.countWrapperEl = createDiv({
      cls: "another-quick-switcher__status__count-wrapper",
    });
    this.countInputEl = createDiv({
      text: `${Math.min(items.length, this.limit)} / ${items.length}`,
      cls: "another-quick-switcher__status__count-input",
    });
    this.countWrapperEl.appendChild(this.countInputEl);
    this.inputEl.before(this.countWrapperEl);
    this.renderCheckedCountBadge(
      "another-quick-switcher__status__checked-count-badge",
      this.countWrapperEl,
    );

    return items.slice(0, this.limit).map((x, order) => ({ ...x, order }));
  }

  renderInputComponent() {
    this.navigationHistoryEl?.remove();
    this.searchCommandEl?.remove();
    this.defaultInputEl?.remove();
    this.countWrapperEl?.remove();
    this.countInputEl?.remove();

    this.navigationHistoryEl = createDiv({
      cls: "another-quick-switcher__custom-search__navigation-history-header",
    });
    const backHistoryLength = this.currentNavigationHistoryIndex;
    if (backHistoryLength > 0) {
      this.navigationHistoryEl.appendText(`${backHistoryLength} < `);
    }
    this.navigationHistoryEl.appendText(
      this.originFile ? this.originFile.basename : "No file",
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
    this.refreshAutoPreviewIcon();

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
      displayAliasAsTitleOnKeywordMatched: this.settings.showAliasesOnTop,
      displayAliaseAsTitle: this.settings.displayAliaseAsTitle,
      displayDescriptionBelowTitle: this.settings.displayDescriptionBelowTitle,
      hideGutterIcons: this.settings.hideGutterIcons,
      showFuzzyMatchScore: this.settings.showFuzzyMatchScore,
      relativeUpdatedPeriodSource: this.command.relativeUpdatedPeriodSource,
      relativeUpdatedPeriodPropertyKey:
        this.command.relativeUpdatedPeriodPropertyKey,
      selected: Boolean(this.selectedItemMap[this.toKey(item)]),
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
      this.handleCreateNewMarkdown(this.searchQuery, "same-tab"),
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

  /**
   * Resolves the API promise with the selected files and closes the modal.
   * This is used when apiMode is true.
   */
  private resolveApiWithFiles(files: TFile[]): void {
    if (this.resolveApiPromise) {
      this.resolveApiPromise(files);
      this.resolveApiPromise = null;
    }
    this.close();
  }

  async chooseCurrentSuggestion(
    leafType: LeafType,
    option: { keepOpen?: boolean } = {},
  ): Promise<TFile | null> {
    const item = this.getSelectedItem();
    if (!item) {
      return null;
    }

    let fileToOpened = item.file;
    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }

    let offset: number | undefined;
    let leafPriorToSameTab: WorkspaceLeaf | undefined;
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
      case "opened file":
        if (item.matchResults[0]?.type === "header") {
          // If type is "header", meta[0] is not empty
          const firstHeader = item.matchResults[0].meta![0];
          offset =
            this.appHelper.findFirstHeaderOffset(item.file, firstHeader) ??
            undefined;
        }
        this.appHelper.getFilePathsInActiveWindow;
        leafPriorToSameTab = this.appHelper.findLeaf(fileToOpened);
        break;
      case "backlink":
        offset = this.appHelper.findFirstLinkOffset(
          item.file,
          this.originFile!,
        );
        break;
      case "link":
        break;
      case "2-hop-link":
        break;
      default:
        throw new ExhaustiveError(this.command.searchTarget as never);
    }

    const isSameTab = leafType === "same-tab";
    const isFinalOpen = !option.keepOpen;

    if (isFinalOpen && this.usedPreview) {
      this.skipRecentHistoryRestoreOnClose = true;
      if (isSameTab) {
        this.skipRestoreOnClose = true;
      }
    }

    if (isFinalOpen) {
      this.close();
      this.navigate(() => this.isClosed); // wait for close to finish before navigating
    } else if (isSameTab) {
      this.stateToRestore ??= this.appHelper.captureState(this.initialLeaf);
      this.usedPreview = true;
    }

    const shouldRestoreRecentHistory = option.keepOpen === true;
    this.navigate(async () => {
      try {
        await this.appHelper.openFile(
          fileToOpened,
          {
            leafType: leafType,
            offset,
            inplace: option.keepOpen,
            preventDuplicateTabs: this.settings.preventDuplicateTabs,
            leafPriorToSameTab,
          },
          this.stateToRestore,
        );
        if (option.keepOpen) {
          setFloatingModal(this.appHelper);
        }
      } finally {
        if (shouldRestoreRecentHistory) {
          this.scheduleRecentHistoryRestore(this.recentHistorySnapshot);
        } else if (isFinalOpen && this.usedPreview) {
          const nextRecentHistory = this.buildRecentHistoryForFinalOpen(
            this.recentHistorySnapshot,
            this.recentHistoryBaseFilePath,
            fileToOpened.path,
          );
          this.scheduleRecentHistoryRestore(nextRecentHistory);
        }
      }
    });
    if (isFinalOpen && isSameTab && this.usedPreview) {
      this.navigate(() => {
        const leafToPatch = this.stateToRestore?.leaf ?? this.initialLeaf;
        this.appHelper.restoreLeafHistorySnapshot(
          leafToPatch ?? null,
          this.historySnapshot,
        );
      });
    }
    return fileToOpened;
  }

  async onChooseSuggestion(_item: any, evt: MouseEvent): Promise<any> {
    await this.chooseCurrentSuggestion(toLeafType(evt));
  }

  async handleCreateNewMarkdown(
    searchQuery: string,
    leafType: LeafType,
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

    const isSameTab = leafType === "same-tab";
    if (this.usedPreview) {
      this.skipRecentHistoryRestoreOnClose = true;
    }
    if (isSameTab && this.usedPreview) {
      this.skipRestoreOnClose = true;
    }
    this.close();
    this.navigate(() => this.isClosed);
    this.navigate(() => this.appHelper.openFile(file, { leafType: leafType }));
    if (this.usedPreview) {
      this.navigate(() => {
        const nextRecentHistory = this.buildRecentHistoryForFinalOpen(
          this.recentHistorySnapshot,
          this.recentHistoryBaseFilePath,
          file.path,
        );
        this.scheduleRecentHistoryRestore(nextRecentHistory);
      });
    }
    if (isSameTab && this.usedPreview) {
      this.navigate(() => {
        const leafToPatch = this.stateToRestore?.leaf ?? this.initialLeaf;
        this.appHelper.restoreLeafHistorySnapshot(
          leafToPatch ?? null,
          this.historySnapshot,
        );
      });
    }
    return false;
  }

  private registerKeys(
    key: keyof Hotkeys["main"],
    handler: () => void | Promise<void>,
  ) {
    for (const x of this.settings.hotkeys.main[key] ?? []) {
      this.scope.register(
        x.modifiers,
        normalizeKey(capitalizeFirstLetter(x.key)),
        (evt) => {
          if (!evt.isComposing) {
            evt.preventDefault();
            handler();
            return false;
          }
        },
      );
    }
  }

  private async toFileToOpened(item: SuggestionItem) {
    let fileToOpened = item.file;
    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }
    return fileToOpened;
  }

  private resetQueryHistoryNavigationBase() {
    this.queryHistoryBaseQuery = this.inputEl.value;
    this.queryHistoryIndex = globalInternalStorage.queryHistories.length;
  }

  private recordCurrentQueryToHistory(query?: string) {
    const queryToSave = (query ?? this.inputEl.value).trim();
    if (!queryToSave) {
      this.resetQueryHistoryNavigationBase();
      return;
    }

    const histories = globalInternalStorage.queryHistories;
    const lastHistory = histories[histories.length - 1];
    if (lastHistory !== queryToSave) {
      histories.push(queryToSave);
      const HISTORY_LIMIT = 50;
      if (histories.length > HISTORY_LIMIT) {
        histories.shift();
      }
    }

    this.resetQueryHistoryNavigationBase();
  }

  private navigateQueryHistory(direction: "back" | "forward") {
    const histories = globalInternalStorage.queryHistories;
    if (histories.length === 0) {
      return;
    }

    if (this.queryHistoryIndex === histories.length) {
      this.queryHistoryBaseQuery = this.inputEl.value;
    } else if (this.queryHistoryBaseQuery === null) {
      this.resetQueryHistoryNavigationBase();
    }

    const offset = direction === "back" ? -1 : 1;
    let nextIndex = this.queryHistoryIndex + offset;

    while (nextIndex >= 0 && nextIndex <= histories.length) {
      const currentValue = this.inputEl.value;
      const nextValue =
        nextIndex === histories.length
          ? (this.queryHistoryBaseQuery ?? "")
          : histories[nextIndex];

      if (nextValue !== currentValue) {
        this.queryHistoryIndex = nextIndex;
        this.inputEl.value = nextValue;
        this.inputEl.dispatchEvent(new Event("input"));
        return;
      }
      nextIndex += offset;
    }
  }

  private setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Enter")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    const openNthMod = quickResultSelectionModifier(
      this.settings.userAltInsteadOfModForQuickResultSelection,
    );

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↑]", purpose: "up" },
        { command: "[↓]", purpose: "down" },
        { command: `[${openNthMod} 1~9]`, purpose: "open Nth" },
        ...createInstructions(this.settings.hotkeys.main),
      ]);
    }

    this.registerKeys("up", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.registerKeys("down", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
    });
    this.registerKeys("scroll preview up", () => {
      this.scrollActiveLeafByPage("up");
    });
    this.registerKeys("scroll preview down", () => {
      this.scrollActiveLeafByPage("down");
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
      const items = this.getCheckedItems();
      if (items.length > 0) {
        // API mode: return files without opening
        if (this.apiMode) {
          const files = await Promise.all(
            items.map((x) => this.toFileToOpened(x)),
          );
          this.resolveApiWithFiles(files);
          return;
        }
        this.close();
        await this.isClosed;
        for (const x of items) {
          await this.appHelper.openFile(await this.toFileToOpened(x), {
            leafType: "new-tab",
            preventDuplicateTabs: this.settings.preventDuplicateTabs,
          });
          await sleep(0);
        }
      } else {
        // API mode: return single file without opening
        if (this.apiMode) {
          const item = this.getSelectedItem();
          if (item) {
            const file = await this.toFileToOpened(item);
            this.resolveApiWithFiles([file]);
          }
          return;
        }
        await this.chooseCurrentSuggestion("same-tab");
      }
    });
    this.registerKeys("open in new tab", async () => {
      const items = this.getCheckedItems();
      if (items.length > 0) {
        this.close();
        await this.isClosed;
        for (const x of items) {
          await this.appHelper.openFile(await this.toFileToOpened(x), {
            leafType: "new-tab",
            preventDuplicateTabs: this.settings.preventDuplicateTabs,
          });
          await sleep(0);
        }
      } else {
        await this.chooseCurrentSuggestion("new-tab");
      }
    });
    this.registerKeys("open in new pane (horizontal)", async () => {
      const items = this.getCheckedItems();
      if (items.length > 0) {
        this.close();
        await this.isClosed;
        for (const x of items) {
          await this.appHelper.openFile(await this.toFileToOpened(x), {
            leafType: "new-pane-horizontal",
            preventDuplicateTabs: this.settings.preventDuplicateTabs,
          });
          await sleep(0);
        }
      } else {
        await this.chooseCurrentSuggestion("new-pane-horizontal");
      }
    });
    this.registerKeys("open in new pane (vertical)", async () => {
      const items = this.getCheckedItems();
      if (items.length > 0) {
        this.close();
        await this.isClosed;
        for (const x of items) {
          await this.appHelper.openFile(await this.toFileToOpened(x), {
            leafType: "new-pane-vertical",
            preventDuplicateTabs: this.settings.preventDuplicateTabs,
          });
          await sleep(0);
        }
      } else {
        await this.chooseCurrentSuggestion("new-pane-vertical");
      }
    });
    this.registerKeys("open in new window", async () => {
      await this.chooseCurrentSuggestion("new-window");
    });
    this.registerKeys("open in popup", async () => {
      await this.chooseCurrentSuggestion("popup");
    });

    this.registerKeys("preview", () => this.preview());
    this.registerKeys("toggle auto preview", () => {
      this.autoPreviewEnabled = !this.autoPreviewEnabled;
      this.refreshAutoPreviewDebouncer();
      this.refreshAutoPreviewIcon();
      if (this.autoPreviewEnabled) {
        if (!this.floating) {
          this.enableFloating();
        }
        this.preview();
      }
    });

    this.registerKeys("create", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "same-tab");
    });
    this.registerKeys("create in new tab", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "new-tab");
    });
    this.registerKeys("create in new pane (horizontal)", async () => {
      await this.handleCreateNewMarkdown(
        this.searchQuery,
        "new-pane-horizontal",
      );
    });
    this.registerKeys("create in new pane (vertical)", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "new-pane-vertical");
    });
    this.registerKeys("create in new window", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "new-window");
    });
    this.registerKeys("create in new popup", async () => {
      await this.handleCreateNewMarkdown(this.searchQuery, "popup");
    });

    this.registerKeys("check/uncheck", async () => {
      await this.toggleCheckedItem();
    });
    this.registerKeys("check/uncheck and next", async () => {
      await this.toggleCheckedItem({ moveNext: true });
    });
    this.registerKeys("check/uncheck all", () => {
      this.toggleCheckAll();
    });
    this.registerKeys("uncheck all", () => {
      this.uncheckAll();
    });

    this.registerKeys("open in default app", () => {
      this.actionMultiItems((item) => {
        this.appHelper.openFileInDefaultApp(item.file);
      });
      this.close();
    });
    this.registerKeys("show in system explorer", () => {
      this.actionMultiItems((item) => {
        this.appHelper.openInSystemExplorer(item.file);
      });
      this.close();
    });
    this.registerKeys("open in google", () => {
      activeWindow.open(`https://www.google.com/search?q=${this.searchQuery}`);
      this.close();
    });
    this.registerKeys("open first URL", async () => {
      this.close();
      await this.isClosed;

      this.actionMultiItems(async (item, mode) => {
        const urls = await this.appHelper.findExternalLinkUrls(item.file);
        if (urls.length > 0) {
          activeWindow.open(urls[0]);
        } else {
          this.appHelper.openFile(item.file, {
            leafType: mode === "select" ? "same-tab" : "new-tab",
          });
        }
      });
    });

    const insertLinkToActiveMarkdownFile = (
      file: TFile,
      item: SuggestionItem,
    ) => {
      const saat = this.settings.searchesAutoAliasTransform;
      const { title, aliases } = getMatchedTitleAndAliases(item);
      this.appHelper.insertLinkToActiveFileBy(file, {
        phantom: item.phantom,
        displayedString: this.settings.showAliasesOnTop
          ? (title ?? aliases.at(0))
          : undefined,
        aliasTranformer: saat.enabled
          ? { pattern: saat.aliasPattern, format: saat.aliasFormat }
          : undefined,
      });
    };

    const insertPhantomLinkToActiveMarkdownFile = (text: string) => {
      const saat = this.settings.searchesAutoAliasTransform;
      this.appHelper.insertLinkToActiveFileBy(
        this.appHelper.createPhantomFile(text),
        {
          phantom: true,
          aliasTranformer: saat.enabled
            ? { pattern: saat.aliasPattern, format: saat.aliasFormat }
            : undefined,
        },
      );
    };

    this.registerKeys("insert to editor", async () => {
      let offsetX = 0;

      this.actionMultiItems(
        async (item, mode) => {
          await this.safeClose();
          switch (mode) {
            case "select":
              if (this.appHelper.isActiveLeafCanvas()) {
                this.appHelper.addFileToCanvas(item.file);
              } else {
                insertLinkToActiveMarkdownFile(item.file, item);
              }
              break;
            case "check":
              if (this.appHelper.isActiveLeafCanvas()) {
                const cv = this.appHelper.addFileToCanvas(item.file, {
                  x: offsetX,
                  y: 0,
                });
                offsetX += cv.width + 30;
              } else {
                insertLinkToActiveMarkdownFile(item.file, item);
                this.appHelper.insertStringToActiveFile("\n");
              }
              break;
            default:
              throw new ExhaustiveError(mode);
          }
        },
        async () => {
          insertPhantomLinkToActiveMarkdownFile(this.searchQuery);
          await this.safeClose();
        },
      );
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
          searchBy: this.command.searchBy,
          keysOfPropertyToSearch: this.command.keysOfPropertyToSearch,
          relativeUpdatedPeriodSource: this.command.relativeUpdatedPeriodSource,
          relativeUpdatedPeriodPropertyKey:
            this.command.relativeUpdatedPeriodPropertyKey,
          allowFuzzySearchForSearchTarget:
            this.command.allowFuzzySearchForSearchTarget,
          minFuzzyMatchScore: this.command.minFuzzyMatchScore,
          targetExtensions: this.command.targetExtensions,
          floating: this.floating,
          autoPreview: this.command.autoPreview,
          autoPreviewDelayMilliSeconds:
            this.command.autoPreviewDelayMilliSeconds,
          showFrontMatter: this.command.showFrontMatter,
          excludeFrontMatterKeys: this.command.excludeFrontMatterKeys,
          sortPriorities: this.command.sortPriorities,
          excludePrefixPathPatterns: this.command.excludePrefixPathPatterns,
          includePrefixPathPatterns: this.command.includePrefixPathPatterns,
        },
        originFile: file,
        inputQuery: null,
        navigationHistories: [
          ...this.navigationHistories.slice(
            0,
            this.currentNavigationHistoryIndex,
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
        selectedItemMap: this.selectedItemMap,
        // Preserve the pre-dialog history snapshot to avoid capturing preview-mutated history.
        historySnapshot: this.historySnapshot,
        recentHistorySnapshot: this.recentHistorySnapshot,
        recentHistoryBaseFilePath: this.recentHistoryBaseFilePath,
        navQueue: this.navQueue,
        apiMode: this.apiMode,
        resolveApiPromise: this.resolveApiPromise,
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
        selectedItemMap: this.selectedItemMap,
        historySnapshot: this.historySnapshot,
        recentHistorySnapshot: this.recentHistorySnapshot,
        recentHistoryBaseFilePath: this.recentHistoryBaseFilePath,
        navQueue: this.navQueue,
        apiMode: this.apiMode,
        resolveApiPromise: this.resolveApiPromise,
      });
      modal.open();
    };

    this.registerKeys("navigate back", () => {
      navigate(this.currentNavigationHistoryIndex - 1);
    });

    this.registerKeys("navigate forward", () => {
      navigate(this.currentNavigationHistoryIndex + 1);
    });

    this.registerKeys("previous search history", () => {
      this.navigateQueryHistory("back");
    });

    this.registerKeys("next search history", () => {
      this.navigateQueryHistory("forward");
    });

    this.registerKeys("close if opened", () => {
      this.actionMultiItems(async (item, mode) => {
        this.appHelper.closeFile(item.file);
        if (mode === "check") {
          this.close();
        }
      });
    });

    const modifierKey = this.settings.userAltInsteadOfModForQuickResultSelection
      ? "Alt"
      : "Mod";
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      this.scope.register([modifierKey], String(n), (evt: KeyboardEvent) => {
        this.chooser.setSelectedItem(n - 1, evt);
        // noinspection JSIgnoredPromiseFromCall (This call back needs to return false, not Promise<false>)
        this.chooseCurrentSuggestion("same-tab");
        return false;
      });
    }

    this.registerKeys("launch grep", async () => {
      const currentQuery = this.inputEl.value.trim();
      await this.safeClose();
      await showGrepDialog(this.app, this.settings, currentQuery || undefined);
    });

    this.registerKeys("copy file vault path", async () => {
      const item = this.chooser.values?.[this.chooser.selectedItem];
      if (!item) {
        return;
      }

      try {
        await navigator.clipboard.writeText(item.file.path);
        new Notice("Vault path copied to clipboard");
      } catch (_error) {
        new Notice("Failed to copy vault path to clipboard");
      }
    });

    this.registerKeys("copy absolute file path", async () => {
      const item = this.chooser.values?.[this.chooser.selectedItem];
      if (!item) {
        return;
      }

      try {
        const basePath = this.appHelper.getNormalizeVaultRootPath();
        await navigator.clipboard.writeText(`${basePath}/${item.file.path}`);
        new Notice("Absolute file path copied to clipboard");
      } catch (_error) {
        new Notice("Failed to copy absolute file path to clipboard");
      }
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

import {
  App,
  debounce,
  Debouncer,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  SuggestModal,
  TFile,
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
import { AppHelper, LeafType, UnsafeHistory } from "../app-helper";
import { stampMatchResults, SuggestionItem } from "src/matcher";
import { createElements } from "./suggestion-factory";
import { filterNoQueryPriorities, sort } from "../sorters";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { excludeFormat, smartWhitespaceSplit } from "../utils/strings";
import { createInstructions, quickResultSelectionModifier } from "src/keys";
import { FILTER, HEADER, LINK, SEARCH, TAG } from "./icons";
import { ExhaustiveError } from "../errors";
import { setFloatingModal } from "./modal";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

interface CustomSearchHistory {
  originFile: TFile | null;
  command: SearchCommand;
  inputQuery: string;
}

export class AnotherQuickSwitcherModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
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

  previewedFiles: TFile[];

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void],
    void
  >;

  command: SearchCommand;
  initialCommand: SearchCommand;

  initialHistory: UnsafeHistory;
  forwardHistories: UnsafeHistory[];

  navigationHistoryEl?: HTMLDivElement;
  searchCommandEl?: HTMLDivElement;
  defaultInputEl?: HTMLDivElement;
  countInputEl?: HTMLDivElement;
  floating: boolean;
  opened: boolean;
  openInSameLeaf: boolean;
  willSilentClose: boolean = false;

  constructor(
    app: App,
    settings: Settings,
    command: SearchCommand,
    originFile: TFile | null,
    inputQuery: string,
    navigationHistories: CustomSearchHistory[],
    currentNavigationHistoryIndex: number,
    stackHistory: boolean,
    initialHistory: UnsafeHistory | undefined,
    previewedFiles: TFile[],
    forwardHistories: UnsafeHistory[] | undefined
  ) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.initialCommand = command;
    this.command = command;
    this.originFile = originFile;
    this.floating = command.floating;
    this.initialInputQuery = inputQuery;
    this.navigationHistories = navigationHistories;
    this.currentNavigationHistoryIndex = currentNavigationHistoryIndex;
    this.stackHistory = stackHistory;
    this.initialHistory =
      initialHistory ??
      this.appHelper.getCurrentLeafHistoryState(this.app.workspace.getLeaf());
    this.previewedFiles = previewedFiles;
    this.forwardHistories =
      forwardHistories ??
      this.appHelper.getCurrentLeafForwardHistories(
        this.app.workspace.getLeaf()
      );

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

    this.openInSameLeaf = false;
    this.opened = true;
  }

  onClose() {
    super.onClose();
    if (this.willSilentClose) {
      return;
    }

    const leaf = this.app.workspace.getLeaf();

    if (!this.openInSameLeaf) {
      this.appHelper.resetCurrentLeafHistoryStateTo(leaf, this.initialHistory);
      this.appHelper.setLeafForwardHistories(leaf, this.forwardHistories);
    }

    setTimeout(() => {
      const previewedPaths = this.previewedFiles.map((x) => x.path);
      const { backHistories } = this.appHelper.cloneLeafHistories(leaf);
      this.appHelper.setLeafBackHistories(
        leaf,
        backHistories.filter(
          (x) => !previewedPaths.includes(x.state.state.file)
        )
      );
    }, 200);
  }

  silentClose() {
    this.willSilentClose = true;
    this.close();
  }

  enableFloating() {
    this.floating = true;
    setFloatingModal(
      this.appHelper,
      this.modalEl.offsetWidth,
      this.modalEl.offsetHeight
    );
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
            ? uniq(cache.links?.map((x) => x.displayText ?? "") ?? [])
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
    this.showDebugLog(() =>
      buildLogMessage(`Indexing file items: `, performance.now() - start)
    );

    this.originItems = [...fileItems, ...this.phantomItems];

    start = performance.now();
    this.ignoredItems = this.prefilterItems(this.command);
    this.showDebugLog(() =>
      buildLogMessage(`Prefilter items: `, performance.now() - start)
    );
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
              sorter(
                (x) => originFileLinkMap[x.file.path].position.start.offset
              )
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
      this.showDebugLog(() => `beforeCommand: ${this.command.name}`);
      this.command = commandByPrefix ?? this.initialCommand;
      this.indexingItems(); // slow?
      this.showDebugLog(() => `afterCommand: ${this.command.name}`);
    }
    this.searchQuery = query.startsWith(this.command.commandPrefix)
      ? query.replace(this.command.commandPrefix, "")
      : query;
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

    this.showDebugLog(() =>
      buildLogMessage(
        `Get suggestions: ${this.searchQuery} (${this.command.name})`,
        performance.now() - start
      )
    );

    this.countInputEl = createDiv({
      text: `${Math.min(
        items.length,
        this.settings.maxNumberOfSuggestions
      )} / ${items.length}`,
      cls: "another-quick-switcher__status__count-input",
    });
    this.inputEl.before(this.countInputEl);

    return items
      .slice(0, this.settings.maxNumberOfSuggestions)
      .map((x, order) => ({ ...x, order }));
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

    this.searchCommandEl.appendText(`${this.command.name} ... `);

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
      default:
        throw new ExhaustiveError(this.command.searchTarget as never);
    }

    if (!option.keepOpen) {
      if (leaf === "same-tab") {
        this.openInSameLeaf = true;
      }
      this.close();
    }
    this.appHelper.openFile(fileToOpened, { leaf, offset });
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

    if (leafType === "same-tab") {
      this.openInSameLeaf = true;
    }
    this.close();
    this.appHelper.openFile(file, { leaf: leafType });
    return false;
  }

  private registerKeys(
    key: keyof Hotkeys["main"],
    handler: () => void | Promise<void>
  ) {
    this.settings.hotkeys.main[key]?.forEach((x) => {
      this.scope.register(x.modifiers, x.key.toUpperCase(), (evt) => {
        evt.preventDefault();
        handler();
        return false;
      });
    });
  }

  private setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Enter")!);

    const openNthMod = quickResultSelectionModifier(
      this.settings.userAltInsteadOfModForQuickResultSelection
    );

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: `[↑]`, purpose: "up" },
        { command: `[↓]`, purpose: "down" },
        { command: `[${openNthMod} 1~9]`, purpose: "open Nth" },
        ...createInstructions(this.settings.hotkeys.main),
        { command: "[Esc]", purpose: "dismiss" },
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

    this.registerKeys("preview", async () => {
      if (!this.floating) {
        this.enableFloating();
      }
      const file = await this.chooseCurrentSuggestion("same-tab", {
        keepOpen: true,
      });
      if (file) {
        this.previewedFiles.push(file);
      }
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

      const urls = await this.appHelper.findExternalLinkUrls(fileToOpened);
      if (urls.length > 0) {
        activeWindow.open(urls[0]);
      } else {
        this.appHelper.openFile(fileToOpened, {
          leaf: "same-tab",
        });
      }
    });

    this.registerKeys("insert to editor", () => {
      const file = this.chooser.values?.[this.chooser.selectedItem]?.file;
      if (!file) {
        return;
      }

      this.close();
      if (this.appHelper.isActiveLeafCanvas()) {
        this.appHelper.addFileToCanvas(file);
      } else {
        this.appHelper.insertLinkToActiveFileBy(file);
      }
    });
    this.registerKeys("insert all to editor", () => {
      this.close();

      let offsetX = 0;
      this.chooser.values?.forEach((x) => {
        if (this.appHelper.isActiveLeafCanvas()) {
          const cv = this.appHelper.addFileToCanvas(x.file, {
            x: offsetX,
            y: 0,
          });
          offsetX += cv.width + 30;
        } else {
          this.appHelper.insertLinkToActiveFileBy(x.file);
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
      const modal = new AnotherQuickSwitcherModal(
        this.app,
        this.settings,
        {
          ...command,
          floating: this.floating,
        },
        file,
        "",
        [
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
        this.currentNavigationHistoryIndex + 1,
        true,
        this.initialHistory,
        this.previewedFiles,
        this.forwardHistories
      );
      modal.open();
    };

    this.registerKeys("show links", () => {
      navigateLinks(createDefaultLinkSearchCommand());
    });

    this.registerKeys("show backlinks", () => {
      navigateLinks(createDefaultBacklinkSearchCommand());
    });

    const navigate = (index: number) => {
      const history = this.navigationHistories[index];
      if (!history) {
        return;
      }

      this.silentClose();
      const modal = new AnotherQuickSwitcherModal(
        this.app,
        this.settings,
        {
          ...history.command,
          floating: this.floating,
        },
        history.originFile,
        history.inputQuery,
        this.navigationHistories,
        index,
        false,
        this.initialHistory,
        this.previewedFiles,
        this.forwardHistories
      );
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
  }
}

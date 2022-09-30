import {
  App,
  debounce,
  Debouncer,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  SuggestModal,
} from "obsidian";
import {
  excludeItems,
  includeItems,
  keyBy,
  uniq,
} from "../utils/collection-helper";
import { Hotkeys, SearchCommand, Settings } from "../settings";
import { AppHelper, LeafType } from "../app-helper";
import { stampMatchResults, SuggestionItem } from "src/matcher";
import { createElements } from "./suggestion-factory";
import { filterNoQueryPriorities, sort } from "../sorters";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { excludeFormat, smartWhitespaceSplit } from "../utils/strings";
import { createInstructions, quickResultSelectionModifier } from "src/keys";
import { FILTER, HEADER, LINK, SEARCH, TAG } from "./icons";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
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
  searchQuery: string;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void],
    void
  >;

  command: SearchCommand;
  initialCommand: SearchCommand;

  searchCommandEl?: HTMLDivElement;
  defaultInputEl?: HTMLDivElement;
  countInputEl?: HTMLDivElement;

  constructor(app: App, settings: Settings, command: SearchCommand) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.initialCommand = command;
    this.command = command;

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

  indexingItems() {
    const starredPathMap = keyBy(
      this.appHelper.getStarredFilePaths(),
      (x) => x
    );
    const activeFilePath = app.workspace.getActiveFile()?.path;

    const start = performance.now();
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
          phantom: false,
          starred: x.path in starredPathMap,
          matchResults: [],
          tokens: x.basename.split(" "),
        };
      });
    this.showDebugLog(() =>
      buildLogMessage(`Indexing markdown items: `, performance.now() - start)
    );

    this.originItems = [...markdownItems, ...this.phantomItems];
    this.ignoredItems = this.prefilterItems(this.command);
  }

  async handleCreateNew(
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
    this.appHelper.openMarkdownFile(file, { leaf: leafType });
    return false;
  }

  prefilterItems(command: SearchCommand): SuggestionItem[] {
    const filterItems = (
      includePatterns: string[],
      excludePatterns: string[]
    ): SuggestionItem[] => {
      let items = this.originItems;
      if (command.searchTarget === "backlink") {
        const backlinksMap = this.appHelper.createBacklinksMap();
        items = items.filter((x) =>
          backlinksMap[this.appHelper.getActiveFile()?.path ?? ""]?.has(
            x.file.path
          )
        );
      }
      if (includePatterns.length > 0) {
        items = includeItems(items, includePatterns, (x) => x.file.path);
      }
      if (excludePatterns.length > 0) {
        items = excludeItems(items, excludePatterns, (x) => x.file.path);
      }
      return items;
    };

    const currentDirPath = this.appHelper.getActiveFile()?.parent.path ?? "";
    return filterItems(
      command.includePrefixPathPatterns.map((p) =>
        p.replace(/<current_dir>/g, currentDirPath)
      ),
      command.excludePrefixPathPatterns.map((p) =>
        p.replace(/<current_dir>/g, currentDirPath)
      )
    );
  }

  getSuggestions(query: string): SuggestionItem[] | Promise<SuggestionItem[]> {
    if (!query || query === this.command.defaultInput) {
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

    if (
      this.command.searchTarget === "backlink" &&
      !this.app.workspace.getActiveFile()?.path
    ) {
      return [];
    }

    const isQueryEmpty = !this.searchQuery.trim();

    const matchedSuggestions = isQueryEmpty
      ? this.ignoredItems
      : this.ignoredItems
          .map((x) =>
            stampMatchResults(
              x,
              qs,
              this.command.searchBy.tag,
              this.command.searchBy.header,
              this.command.searchBy.link,
              this.settings.normalizeAccentsAndDiacritics
            )
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
    this.searchCommandEl?.remove();
    this.defaultInputEl?.remove();
    this.countInputEl?.remove();

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
    const { itemDiv, descriptionDiv } = createElements(item, {
      showDirectory: this.settings.showDirectory,
      showDirectoryAtNewLine: this.settings.showDirectoryAtNewLine,
      showFullPathOfDirectory: this.settings.showFullPathOfDirectory,
      showAliasesOnTop: this.settings.showAliasesOnTop,
      hideGutterIcons: this.settings.hideGutterIcons,
    });

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
      this.handleCreateNew(this.searchQuery, "same-tab")
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
  ): Promise<void> {
    const item = this.chooser.values?.[this.chooser.selectedItem];
    if (!item) {
      return;
    }

    let fileToOpened = item.file;
    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }

    const offset =
      this.command.searchTarget === "backlink"
        ? this.appHelper.findFirstLinkOffset(
            item.file,
            this.app.workspace.getActiveFile()! // never undefined
          )
        : undefined;

    if (!option.keepOpen) {
      this.close();
    }
    this.appHelper.openMarkdownFile(fileToOpened, { leaf: leaf, offset });
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

  private registerKeys(
    key: keyof Hotkeys["main"],
    handler: () => void | Promise<void>
  ) {
    this.settings.hotkeys.main[key]?.forEach((x) => {
      this.scope.register(x.modifiers, x.key, (evt) => {
        evt.preventDefault();
        handler();
        return false;
      });
    });
  }

  private setHotkeys() {
    const openNthMod = quickResultSelectionModifier(
      this.settings.userAltInsteadOfModForQuickResultSelection
    );

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↵]", purpose: "open" },
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

    this.registerKeys("open in new tab", () => {
      this.chooseCurrentSuggestion("new-tab");
    });
    this.registerKeys("open in new pane (horizontal)", () => {
      this.chooseCurrentSuggestion("new-pane-horizontal");
    });
    this.registerKeys("open in new pane (vertical)", () => {
      this.chooseCurrentSuggestion("new-pane-vertical");
    });
    this.registerKeys("open in new window", () => {
      this.chooseCurrentSuggestion("new-window");
    });
    this.registerKeys("open in popup", () => {
      this.chooseCurrentSuggestion("popup");
    });
    this.registerKeys("open in new tab in background", () => {
      this.chooseCurrentSuggestion("new-tab-background", { keepOpen: true });
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
          this.appHelper.openMarkdownFile(x.file, {
            leaf: "new-tab-background",
          })
        );
    });

    this.registerKeys("create", () => {
      this.handleCreateNew(this.searchQuery, "same-tab");
    });
    this.registerKeys("create in new tab", () => {
      this.handleCreateNew(this.searchQuery, "new-tab");
    });
    this.registerKeys("create in new window", () => {
      this.handleCreateNew(this.searchQuery, "new-window");
    });
    this.registerKeys("create in new popup", () => {
      this.handleCreateNew(this.searchQuery, "popup");
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
        this.appHelper.openMarkdownFile(fileToOpened, {
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
      this.appHelper.insertLinkToActiveFileBy(file);
    });
    this.registerKeys("insert all to editor", () => {
      this.close();
      this.chooser.values?.forEach((x) => {
        this.appHelper.insertLinkToActiveFileBy(x.file);
        this.appHelper.insertStringToActiveFile("\n");
      });
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

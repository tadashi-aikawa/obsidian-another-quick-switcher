import {
  type App,
  type Debouncer,
  Platform,
  SuggestModal,
  type TFile,
  type WorkspaceLeaf,
  debounce,
} from "obsidian";
import {
  AppHelper,
  type CaptureState,
  type LeafType,
  isFrontMatterLinkCache,
} from "../app-helper";
import {
  createInstructions,
  normalizeKey,
  quickResultSelectionModifier,
} from "../keys";
import type { Hotkeys, Settings } from "../settings";
import { compare } from "../sorters";
import { uniqBy } from "../utils/collection-helper";
import { Logger } from "../utils/logger";
import { isExcalidraw, normalizePath } from "../utils/path";
import {
  capitalizeFirstLetter,
  smartIncludes,
  trimLineByEllipsis,
} from "../utils/strings";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";
import { setFloatingModal } from "./modal";

interface SuggestionItem {
  order?: number;
  file: TFile;
  line: string;
  lineNumber: number;
  offset: number;
}

export class BacklinkModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
  logger: Logger;
  appHelper: AppHelper;
  settings: Settings;
  ignoredItems: SuggestionItem[];
  initialLeaf: WorkspaceLeaf | null;
  originFileBaseName: string;
  originFileBaseNameRegExp: RegExp;
  stateToRestore: CaptureState;
  lastOpenFileIndexByPath: { [path: string]: number } = {};

  // unofficial
  isOpen: boolean;
  updateSuggestions: () => unknown;
  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void],
    void
  >;

  vaultRootPath: string;
  suggestions: SuggestionItem[] = [];
  opened: boolean;

  countInputEl?: HTMLDivElement;

  private markClosed: () => void;
  isClosed: Promise<void> = new Promise((resolve) => {
    this.markClosed = resolve;
  });
  navQueue: Promise<void> = Promise.resolve();

  constructor(app: App, settings: Settings, initialLeaf: WorkspaceLeaf | null) {
    super(app);
    this.modalEl.addClass("another-quick-switcher__modal-prompt");

    this.vaultRootPath = normalizePath(
      (this.app.vault.adapter as any).basePath as string,
    );

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.logger = Logger.of(this.settings);
    this.initialLeaf = initialLeaf;
    this.originFileBaseName = this.appHelper.getActiveFile()!.basename;
    this.originFileBaseNameRegExp = new RegExp(this.originFileBaseName, "g");
    this.limit = 255;
    this.app.workspace.getLastOpenFiles().forEach((v, i) => {
      this.lastOpenFileIndexByPath[v] = i;
    });

    this.setHotkeys();

    this.debounceGetSuggestions = debounce(
      (query: string, cb: (items: SuggestionItem[]) => void) => {
        cb(this._getSuggestions(query));
      },
      this.settings.searchDelayMilliSeconds,
      true,
    );
  }

  async init() {
    await this.indexingItems();
  }

  onOpen() {
    super.onOpen();
    if (!Platform.isPhone) {
      setFloatingModal(this.appHelper);
    }
    this.opened = true;
  }

  close() {
    if (Platform.isMobile) {
      // https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/207
      this.onClose();
    }
    super.close();
  }

  onClose() {
    super.onClose();
    if (this.stateToRestore) {
      // restore initial leaf state, undoing any previewing
      this.navigate(() => this.stateToRestore.restore());
    }
    this.navigate(this.markClosed);
  }

  async indexingItems() {
    const start = performance.now();

    const ignoredItems = [];

    const backlinks = this.appHelper.getBacklinksByFilePathInActiveFile();
    if (!backlinks) {
      return;
    }

    for (const [path, caches] of Object.entries(backlinks)) {
      const file = this.appHelper.getFileByPath(path)!;
      if (
        this.settings.backlinkExcludePrefixPathPatterns.some((p) =>
          file.path.startsWith(p),
        )
      ) {
        continue;
      }

      const content = await this.app.vault.cachedRead(file);
      for (const cache of caches) {
        ignoredItems.push(
          isFrontMatterLinkCache(cache)
            ? {
                file,
                line: `<${cache.key}: in properties>`,
                lineNumber: 1,
                offset: 0,
              }
            : {
                file,
                line: content.split("\n").at(cache.position.start.line)!,
                lineNumber: cache.position.start.line + 1,
                offset: cache.position.start.offset,
              },
        );
      }
    }

    this.ignoredItems = uniqBy(
      ignoredItems,
      (item) => `${item.file.path}/${item.lineNumber}`,
    );

    this.logger.showDebugLog("Indexing backlinks", start);
  }

  getSuggestions(query: string): SuggestionItem[] | Promise<SuggestionItem[]> {
    if (!query || !this.opened) {
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

    const isQueryEmpty = query.trim() === "";
    const queries = query.trim().split(" ");

    const matchedSuggestions = isQueryEmpty
      ? this.ignoredItems
      : this.ignoredItems.filter((x) =>
          queries.every(
            (q) =>
              smartIncludes(
                x.file.path,
                q,
                this.settings.normalizeAccentsAndDiacritics,
              ) ||
              smartIncludes(
                x.line,
                q,
                this.settings.normalizeAccentsAndDiacritics,
              ),
          ),
        );

    this.logger.showDebugLog(`Get suggestions: ${query}`, start);

    this.countInputEl?.remove();
    this.countInputEl = createDiv({
      text: `${Math.min(matchedSuggestions.length, this.limit)} / ${
        matchedSuggestions.length
      }`,
      cls: "another-quick-switcher__backlink__status__count-input",
    });
    this.inputEl.before(this.countInputEl);

    this.suggestions = matchedSuggestions
      .sort((a, b) =>
        compare(
          a,
          b,
          (x) => this.lastOpenFileIndexByPath[x.file.path] ?? 999999,
          "asc",
        ),
      )
      .slice(0, this.limit)
      .map((x, order) => ({ ...x, order }));
    return this.suggestions;
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const previousPath = this.suggestions[item.order! - 1]?.file.path;
    const sameFileWithPrevious = previousPath === item.file.path;

    const itemDiv = createDiv({
      cls: "another-quick-switcher__item",
    });

    const entryDiv = createDiv({
      cls: "another-quick-switcher__item__entry",
    });

    if (!sameFileWithPrevious) {
      const titleDiv = createDiv({
        cls: [
          "another-quick-switcher__item__title",
          "another-quick-switcher__backlink__item__title_entry",
        ],
        text: item.file.basename,
        attr: {
          extension: item.file.extension,
        },
      });

      const isExcalidrawFile = isExcalidraw(item.file);
      if (item.file.extension !== "md" || isExcalidrawFile) {
        const extDiv = createDiv({
          cls: "another-quick-switcher__item__extension",
          text: isExcalidrawFile ? "excalidraw" : item.file.extension,
        });
        titleDiv.appendChild(extDiv);
      }
      entryDiv.appendChild(titleDiv);

      itemDiv.appendChild(entryDiv);
      if (this.settings.showDirectory) {
        const directoryDiv = createDiv({
          cls: "another-quick-switcher__item__directory",
        });
        directoryDiv.insertAdjacentHTML("beforeend", FOLDER);
        const text = this.settings.showFullPathOfDirectory
          ? item.file.parent?.path
          : item.file.parent?.name;
        directoryDiv.appendText(` ${text}`);
        entryDiv.appendChild(directoryDiv);

        if (this.settings.showDirectoryAtNewLine) {
          itemDiv.appendChild(directoryDiv);
        }
      }
    }

    const descriptionsDiv = createDiv({
      cls: "another-quick-switcher__item__descriptions",
    });

    const descriptionDiv = createDiv({
      cls: "another-quick-switcher__backlink__item__description",
    });

    let restLine = item.line;
    let offset = 0;
    const indices = Array.from(
      restLine.matchAll(this.originFileBaseNameRegExp),
    ).map((x) => x.index!);
    for (const index of indices) {
      const before = restLine.slice(0, index - offset);
      descriptionDiv.createSpan({
        text: trimLineByEllipsis(
          before,
          this.settings.maxDisplayLengthAroundMatchedWord,
        ),
      });
      descriptionDiv.createSpan({
        text: this.originFileBaseName,
        cls: "another-quick-switcher__hit_word",
      });

      offset = index - offset + this.originFileBaseName.length;
      restLine = restLine.slice(offset);
    }
    descriptionDiv.createSpan({
      text: trimLineByEllipsis(
        restLine,
        this.settings.maxDisplayLengthAroundMatchedWord,
      ),
    });

    if (item.order! < 9) {
      const hotKeyGuide = createSpan({
        cls: "another-quick-switcher__backlink__item__hot-key-guide",
        text: `${item.order! + 1}`,
      });
      descriptionsDiv.appendChild(hotKeyGuide);
    }
    descriptionsDiv.appendChild(descriptionDiv);

    itemDiv.appendChild(descriptionsDiv);

    el.appendChild(itemDiv);
  }

  navigate(cb: () => any) {
    this.navQueue = this.navQueue.then(cb);
  }

  async chooseCurrentSuggestion(
    leaf: LeafType,
    option: { keepOpen?: boolean } = {},
  ): Promise<TFile | null> {
    const item = this.chooser.values?.[this.chooser.selectedItem];
    if (!item) {
      return null;
    }

    if (!option.keepOpen) {
      this.close();
      this.navigate(() => this.isClosed); // wait for close to finish before navigating
    } else if (leaf === "same-tab") {
      this.stateToRestore ??= this.appHelper.captureState(this.initialLeaf);
    }
    this.navigate(() =>
      this.appHelper.openFile(
        item.file,
        {
          leafType: leaf,
          line: item.lineNumber - 1,
          inplace: option.keepOpen,
          preventDuplicateTabs: this.settings.preventDuplicateTabs,
        },
        this.stateToRestore,
      ),
    );
    return item.file;
  }

  async onChooseSuggestion(): Promise<void> {
    await this.chooseCurrentSuggestion("same-tab");
  }

  private registerKeys(
    key: keyof Hotkeys["backlink"],
    handler: () => void | Promise<void>,
  ) {
    const hotkeys = this.settings.hotkeys.backlink[key];
    for (const x of hotkeys) {
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
        { command: "[↵]", purpose: "open" },
        { command: "[↑]", purpose: "up" },
        { command: "[↓]", purpose: "down" },
        { command: `[${openNthMod} 1~9]`, purpose: "open Nth" },
        ...createInstructions(this.settings.hotkeys.backlink),
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

      const items = this.chooser.values.slice().reverse();
      for (const x of items) {
        this.appHelper.openFile(x.file, {
          leafType: "new-tab-background",
          preventDuplicateTabs: this.settings.preventDuplicateTabs,
        });
      }
    });

    this.registerKeys("show all results", () => {
      this.limit = Number.MAX_SAFE_INTEGER;
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    });

    this.registerKeys("preview", async () => {
      // XXX: chooseCurrentSuggestionにできるか?
      await this.chooseCurrentSuggestion("same-tab", {
        keepOpen: true,
      });
    });

    const modifierKey = this.settings.userAltInsteadOfModForQuickResultSelection
      ? "Alt"
      : "Mod";
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      this.scope.register([modifierKey], String(n), (evt: KeyboardEvent) => {
        this.chooser.setSelectedItem(n - 1, evt);
        this.chooser.useSelectedItem({});
        return false;
      });
    }

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

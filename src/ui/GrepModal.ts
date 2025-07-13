import {
  type App,
  type Debouncer,
  SuggestModal,
  type TFile,
  type WorkspaceLeaf,
  debounce,
} from "obsidian";
import { AppHelper, type CaptureState, type LeafType } from "../app-helper";
import {
  createInstruction,
  createInstructions,
  equalsAsHotkey,
  normalizeKey,
  quickResultSelectionModifier,
} from "../keys";
import type { Hotkeys, Settings } from "../settings";
import { sorter } from "../utils/collection-helper";
import {
  convertSubmatchesToCharPositions,
  mergeAndFilterResults,
  mergeOverlappingSubmatches,
} from "../utils/grep-utils";
import { Logger } from "../utils/logger";
import {
  isExcalidraw,
  normalizePath,
  normalizeRelativePath,
} from "../utils/path";
import { type MatchResult, rg, rgFiles } from "../utils/ripgrep";
import {
  capitalizeFirstLetter,
  getSinglePatternMatchingLocations,
  hasCapitalLetter,
  isValidRegex,
  smartWhitespaceSplit,
  trimLineByEllipsis,
} from "../utils/strings";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";
import { setFloatingModal } from "./modal";

const globalInternalStorage: {
  items: SuggestionItem[];
  basePath?: string;
  selected?: number;
} = {
  items: [],
  basePath: undefined,
  selected: undefined,
};

interface SuggestionItem {
  order: number;
  file: TFile;
  line: string;
  lineNumber: number;
  offset: number;
  submatches: {
    type: "title" | "text";
    match: {
      text: string;
    };
    start: number;
    end: number;
  }[];
}

export class GrepModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
  logger: Logger;
  appHelper: AppHelper;
  settings: Settings;
  initialLeaf: WorkspaceLeaf | null;
  initialQuery?: string;
  stateToRestore: CaptureState;

  // unofficial
  isOpen: boolean;
  updateSuggestions: () => unknown;
  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  vaultRootPath: string;
  currentQuery: string;
  suggestions: SuggestionItem[];
  // input value
  basePath: string;

  clonedInputEl: HTMLInputElement;
  clonedInputElKeydownEventListener: (
    this: HTMLInputElement,
    ev: HTMLElementEventMap["keydown"],
  ) => any;
  debounceInputEvent: Debouncer<[], void>;
  clonedInputElInputEventListener: () => void;
  countInputEl?: HTMLDivElement;
  basePathInputEl: HTMLInputElement;
  basePathInputElChangeEventListener: (
    this: HTMLInputElement,
    ev: HTMLElementEventMap["change"],
  ) => any;
  basePathInputElKeydownEventListener: (
    this: HTMLInputElement,
    ev: HTMLElementEventMap["keydown"],
  ) => any;

  private markClosed: () => void;
  isClosed: Promise<void> = new Promise((resolve) => {
    this.markClosed = resolve;
  });
  navQueue: Promise<void> = Promise.resolve();

  debouncePreview?: Debouncer<[], void>;
  debouncePreviewCancelListener: () => void;
  debouncePreviewSearchCancelListener: () => void;

  constructor(
    app: App,
    settings: Settings,
    initialLeaf: WorkspaceLeaf | null,
    initialQuery?: string,
  ) {
    super(app);
    this.modalEl.addClass("another-quick-switcher__modal-prompt");

    this.suggestions = globalInternalStorage.items;
    this.vaultRootPath = normalizePath(
      (this.app.vault.adapter as any).basePath as string,
    );

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.logger = Logger.of(this.settings);
    this.initialLeaf = initialLeaf;
    this.limit = 255;

    const searchCmd = this.settings.hotkeys.grep.search.at(0);
    if (searchCmd) {
      const inst = createInstruction("_", {
        key: searchCmd.key,
        modifiers: searchCmd.modifiers,
      });
      this.setPlaceholder(`Search around the vault by ${inst?.command} key`);
    } else {
      this.setPlaceholder(
        `Please set a key about "search" in the "Grep dialog" setting`,
      );
    }
    this.setHotkeys();

    // Store initial query for later use in onOpen
    this.initialQuery = initialQuery;
  }

  onOpen() {
    super.onOpen();
    setFloatingModal(this.appHelper);

    this.basePath =
      globalInternalStorage.basePath ?? this.settings.defaultGrepFolder;

    // Set initial query if provided, after basePath is initialized
    if (this.initialQuery) {
      this.clonedInputEl.value = this.initialQuery;
      this.currentQuery = this.initialQuery;
      this.inputEl.value = this.initialQuery;
      // Trigger input event to initialize suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    }

    window.setTimeout(() => {
      this.basePathInputEl = createEl("input", {
        value: this.basePath,
        placeholder:
          "path from vault root (./ means current directory. ../ means parent directory)",
        cls: "another-quick-switcher__grep__path-input",
        type: "text",
      });
      this.basePathInputEl.setAttrs({
        autocomplete: "on",
        list: "directories",
      });

      const basePathInputList = createEl("datalist");
      basePathInputList.setAttrs({ id: "directories" });
      const folders = this.appHelper.getFolders().filter((x) => !x.isRoot());
      for (const x of folders) {
        basePathInputList.appendChild(createEl("option", { value: x.path }));
      }

      this.basePathInputElChangeEventListener = (evt: Event) => {
        this.basePath = (evt.target as any).value;
      };
      this.basePathInputElKeydownEventListener = (evt: KeyboardEvent) => {
        // XXX: Handled when selecting a suggestion
        if (!evt.key) {
          evt.preventDefault();
          return;
        }

        const hotkey = this.settings.hotkeys.grep.search[0];
        if (!hotkey) {
          return;
        }

        const keyEvent = evt as KeyboardEvent;
        if (equalsAsHotkey(hotkey, keyEvent)) {
          evt.preventDefault();

          this.basePath = (evt.target as any).value;
          this.currentQuery = this.clonedInputEl!.value;
          this.inputEl.value = this.currentQuery;
          // Necessary to rerender suggestions
          this.inputEl.dispatchEvent(new Event("input"));
        }
      };
      this.basePathInputEl.addEventListener(
        "change",
        this.basePathInputElChangeEventListener,
      );
      this.basePathInputEl.addEventListener(
        "keydown",
        this.basePathInputElKeydownEventListener,
      );

      const wrapper = createDiv({
        cls: "another-quick-switcher__grep__path-input__wrapper",
      });
      wrapper.appendChild(this.basePathInputEl);
      wrapper.appendChild(basePathInputList);

      const promptInputContainerEl = activeWindow.activeDocument.querySelector(
        ".prompt-input-container",
      );
      promptInputContainerEl?.after(wrapper);

      wrapper.insertAdjacentHTML("afterbegin", FOLDER);

      if (this.settings.autoPreviewInGrepSearch) {
        this.debouncePreview = debounce(
          this.preview,
          this.settings.grepAutoPreviewDelayMilliSeconds,
          true,
        );
        this.debouncePreviewCancelListener = () => {
          this.debouncePreview?.cancel();
        };
        this.debouncePreviewSearchCancelListener = () => {
          this.debouncePreview?.cancel();
          this.debounceInputEvent.cancel();
        };

        const originalSetSelectedItem = this.chooser.setSelectedItem.bind(
          this.chooser,
        );
        this.chooser.setSelectedItem = (selectedIndex: number, evt?: any) => {
          originalSetSelectedItem(selectedIndex, evt);
          this.debouncePreview?.();
        };

        this.clonedInputEl.addEventListener(
          "keydown",
          this.debouncePreviewCancelListener,
        );
        this.clonedInputEl.addEventListener(
          "focusout",
          this.debouncePreviewSearchCancelListener,
        );
        this.basePathInputEl.addEventListener(
          "keydown",
          this.debouncePreviewCancelListener,
        );
        this.basePathInputEl.addEventListener(
          "focusout",
          this.debouncePreviewSearchCancelListener,
        );
      }

      const selected = globalInternalStorage.selected;
      if (selected != null) {
        this.chooser.setSelectedItem(selected);
        this.chooser.suggestions.at(selected)?.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "center",
        });
      }
    }, 0);
  }

  onClose() {
    super.onClose();
    this.debouncePreview?.cancel();

    globalInternalStorage.items = this.suggestions;
    globalInternalStorage.basePath = this.basePath;
    globalInternalStorage.selected = this.chooser.selectedItem;

    this.clonedInputEl.removeEventListener(
      "keydown",
      this.clonedInputElKeydownEventListener,
    );
    this.clonedInputEl.removeEventListener(
      "input",
      this.clonedInputElInputEventListener,
    );
    this.clonedInputEl.removeEventListener(
      "keydown",
      this.debouncePreviewCancelListener,
    );
    this.clonedInputEl.removeEventListener(
      "focusout",
      this.debouncePreviewSearchCancelListener,
    );

    this.basePathInputEl.removeEventListener(
      "change",
      this.basePathInputElChangeEventListener,
    );
    this.basePathInputEl.removeEventListener(
      "keydown",
      this.basePathInputElKeydownEventListener,
    );
    this.basePathInputEl.removeEventListener(
      "keydown",
      this.debouncePreviewCancelListener,
    );
    this.basePathInputEl.removeEventListener(
      "focusout",
      this.debouncePreviewSearchCancelListener,
    );

    if (this.stateToRestore) {
      // restore initial leaf state, undoing any previewing
      this.navigate(() => this.stateToRestore.restore());
    }
    this.navigate(this.markClosed);
  }

  async searchSuggestions(query: string): Promise<SuggestionItem[]> {
    const start = performance.now();

    const absolutePathFromRoot = normalizeRelativePath(
      this.basePath,
      this.appHelper.getCurrentDirPath(),
    );

    // Parse query for AND search
    const queries = smartWhitespaceSplit(query.trim());
    let rgResults: MatchResult[];

    // Check if any query has invalid regex
    for (const singleQuery of queries) {
      if (!isValidRegex(singleQuery)) {
        this.countInputEl?.remove();
        this.countInputEl = createDiv({
          text: `Invalid regex pattern: ${singleQuery}`,
          cls: "another-quick-switcher__grep__count-input another-quick-switcher__grep__count-input--error",
        });
        this.clonedInputEl.before(this.countInputEl);
        return [];
      }
    }

    // Show searching message only after validation passes
    this.countInputEl?.remove();
    this.countInputEl = createDiv({
      text: "searching...",
      cls: "another-quick-switcher__grep__count-input",
    });
    this.clonedInputEl.before(this.countInputEl);

    if (queries.length > 1) {
      // AND search: run ripgrep for each query separately and merge results
      const allResults: MatchResult[][] = [];

      for (const singleQuery of queries) {
        const results = await rg(
          this.settings.ripgrepCommand,
          ...[
            ...this.settings.grepExtensions.flatMap((x) => ["-t", x]),
            hasCapitalLetter(singleQuery) ? "" : "-i",
            "--",
            singleQuery,
            `${this.vaultRootPath}/${absolutePathFromRoot}`,
          ].filter((x) => x),
        );

        // Handle regex error
        if (Array.isArray(results)) {
          allResults.push(results);
        } else if (
          results.type === "error" &&
          results.errorType === "regex_parse_error"
        ) {
          this.countInputEl?.remove();
          this.countInputEl = createDiv({
            text: `Invalid regex pattern: ${singleQuery}`,
            cls: "another-quick-switcher__grep__count-input another-quick-switcher__grep__count-input--error",
          });
          this.clonedInputEl.before(this.countInputEl);
          return [];
        }
      }

      // Merge results with AND logic
      rgResults = mergeAndFilterResults(allResults);
    } else {
      // Single query: use parsed query
      const singleQuery = queries[0];
      const rgArgs = [
        ...this.settings.grepExtensions.flatMap((x) => ["-t", x]),
        hasCapitalLetter(singleQuery) ? "" : "-i",
        "--",
        singleQuery,
        `${this.vaultRootPath}/${absolutePathFromRoot}`,
      ].filter((x) => x);

      const results = await rg(this.settings.ripgrepCommand, ...rgArgs);

      // Handle regex error
      if (Array.isArray(results)) {
        rgResults = results;
      } else if (
        results.type === "error" &&
        results.errorType === "regex_parse_error"
      ) {
        this.countInputEl?.remove();
        this.countInputEl = createDiv({
          text: `Invalid regex pattern: ${singleQuery}`,
          cls: "another-quick-switcher__grep__count-input another-quick-switcher__grep__count-input--error",
        });
        this.clonedInputEl.before(this.countInputEl);
        return [];
      } else {
        rgResults = [];
      }
    }

    const fileResults = this.settings.includeFilenameInGrepSearch
      ? await rgFiles(
          this.settings.ripgrepCommand,
          queries, // Use ALL queries for AND search
          `${this.vaultRootPath}/${absolutePathFromRoot}`,
          this.settings.grepExtensions,
        ).catch((err: string) => {
          if (err.includes("regex parse error")) {
            return [];
          }
          throw err;
        })
      : [];

    const rgItems: SuggestionItem[] = rgResults
      .map((x) => {
        return {
          order: -1,
          file: this.appHelper.getFileByPath(
            normalizePath(x.data.path.text).replace(
              `${this.vaultRootPath}/`,
              "",
            ),
          )!,
          line: x.data.lines.text,
          lineNumber: x.data.line_number,
          offset: x.data.absolute_offset,
          submatches: mergeOverlappingSubmatches(
            convertSubmatchesToCharPositions(
              x.data.submatches,
              x.data.lines.text,
            ),
            x.data.lines.text,
          ).map((submatch) => ({
            ...submatch,
            type: "text" as const,
          })),
        };
      })
      .filter((x) => x.file != null)
      .sort(sorter((x) => x.file.stat.mtime, "desc"));

    // Create file items with AND search highlighting
    const fileItems: SuggestionItem[] = fileResults
      .map((filePath) => {
        const file = this.appHelper.getFileByPath(
          normalizePath(filePath).replace(`${this.vaultRootPath}/`, ""),
        );
        if (!file) {
          return null;
        }

        // Find all matches for all queries in the filename
        const allMatches: { text: string; start: number; end: number }[] = [];

        for (const query of queries) {
          if (!query.trim()) continue;

          const regexpOption = hasCapitalLetter(query) ? "g" : "gi";
          const queryMatches = getSinglePatternMatchingLocations(
            file.basename,
            new RegExp(query, regexpOption),
          );

          allMatches.push(
            ...queryMatches.map((match) => ({
              text: match.text,
              start: match.range.start,
              end: match.range.end,
            })),
          );
        }

        return {
          order: -1,
          file,
          line: "",
          lineNumber: 0,
          offset: 0,
          submatches: mergeOverlappingSubmatches(
            allMatches.map((x) => ({
              match: { text: x.text },
              start: x.start,
              end: x.end,
            })),
            file.basename,
          ).map((submatch) => ({
            ...submatch,
            type: "title" as const,
          })),
        };
      })
      .filter((x) => x != null)
      .sort(sorter((x) => x.file.stat.mtime, "desc"));

    this.logger.showDebugLog("getSuggestions: ", start);

    return fileItems.concat(rgItems).map((x, order) => ({ ...x, order }));
  }

  async getSuggestions(query: string): Promise<SuggestionItem[]> {
    if (query) {
      this.suggestions = await this.searchSuggestions(query);

      // Don't update count display if there's an error message
      if (
        !this.countInputEl?.classList.contains(
          "another-quick-switcher__grep__count-input--error",
        )
      ) {
        this.countInputEl?.remove();
        this.countInputEl = createDiv({
          text: `${Math.min(this.suggestions.length, this.limit)} / ${
            this.suggestions.length
          }`,
          cls: "another-quick-switcher__grep__count-input",
        });
        this.clonedInputEl.before(this.countInputEl);
      }
    }

    return this.suggestions;
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const previousPath = this.suggestions[item.order - 1]?.file.path;
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
          "another-quick-switcher__grep__item__title_entry",
        ],
        attr: {
          extension: item.file.extension,
        },
      });

      let restLine = item.file.basename;
      for (const x of item.submatches.filter((s) => s.type === "title")) {
        const i = restLine.indexOf(x.match.text);
        const before = restLine.slice(0, i);
        titleDiv.createSpan({
          text: before,
        });
        titleDiv.createSpan({
          text: x.match.text,
          cls: "another-quick-switcher__hit_word",
        });
        restLine = restLine.slice(i + x.match.text.length);
      }
      titleDiv.createSpan({
        text: restLine,
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
      cls: "another-quick-switcher__grep__item__description",
    });

    // Sort submatches by start position and ensure no overlaps remain
    const textSubmatches = mergeOverlappingSubmatches(
      item.submatches.filter((s) => s.type === "text"),
      item.line,
    ).sort((a, b) => a.start - b.start);

    let currentPos = 0;
    for (const submatch of textSubmatches) {
      // Add text before the match
      if (submatch.start > currentPos) {
        const beforeText = item.line.slice(currentPos, submatch.start);
        descriptionDiv.createSpan({
          text: trimLineByEllipsis(
            beforeText,
            this.settings.maxDisplayLengthAroundMatchedWord,
          ),
        });
      }

      // Add the highlighted match
      descriptionDiv.createSpan({
        text: submatch.match.text,
        cls: "another-quick-switcher__hit_word",
      });

      currentPos = submatch.end;
    }

    // Add remaining text after the last match
    if (currentPos < item.line.length) {
      const remainingText = item.line.slice(currentPos);
      descriptionDiv.createSpan({
        text: trimLineByEllipsis(
          remainingText,
          this.settings.maxDisplayLengthAroundMatchedWord,
        ),
      });
    }

    if (item.order! < 9) {
      const hotKeyGuide = createSpan({
        cls: "another-quick-switcher__grep__item__hot-key-guide",
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

  private toggleInput(): void {
    if (document.activeElement === this.clonedInputEl) {
      this.basePathInputEl.focus();
    } else {
      this.clonedInputEl.focus();
    }
  }

  private validateRegexInput(): void {
    const query = this.clonedInputEl?.value?.trim();
    if (!query) {
      this.clonedInputEl?.classList.remove(
        "another-quick-switcher__grep__input--invalid",
      );
      // Clear error message when input is empty
      if (
        this.countInputEl?.classList.contains(
          "another-quick-switcher__grep__count-input--error",
        )
      ) {
        this.countInputEl?.remove();
        this.countInputEl = undefined;
      }
      return;
    }

    const queries = smartWhitespaceSplit(query);
    let hasInvalidRegex = false;
    let invalidQuery = "";

    for (const singleQuery of queries) {
      if (!isValidRegex(singleQuery)) {
        hasInvalidRegex = true;
        invalidQuery = singleQuery;
        break;
      }
    }

    if (hasInvalidRegex) {
      this.clonedInputEl?.classList.add(
        "another-quick-switcher__grep__input--invalid",
      );
      // Show error message immediately
      this.countInputEl?.remove();
      this.countInputEl = createDiv({
        text: `Invalid regex pattern: ${invalidQuery}`,
        cls: "another-quick-switcher__grep__count-input another-quick-switcher__grep__count-input--error",
      });
      this.clonedInputEl.before(this.countInputEl);
    } else {
      this.clonedInputEl?.classList.remove(
        "another-quick-switcher__grep__input--invalid",
      );
      // Clear error message when regex becomes valid
      if (
        this.countInputEl?.classList.contains(
          "another-quick-switcher__grep__count-input--error",
        )
      ) {
        this.countInputEl?.remove();
        this.countInputEl = undefined;
      }
    }
  }

  private registerKeys(
    key: keyof Hotkeys["grep"],
    handler: () => void | Promise<void>,
  ) {
    const hotkeys = this.settings.hotkeys.grep[key];
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

  private async preview() {
    await this.chooseCurrentSuggestion("same-tab", {
      keepOpen: true,
    });
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
        ...createInstructions(this.settings.hotkeys.grep),
      ]);
    }

    // XXX: This is a hack to avoid default input events
    this.clonedInputEl = this.inputEl.cloneNode(true) as HTMLInputElement;
    this.inputEl.parentNode?.replaceChild(this.clonedInputEl, this.inputEl);
    this.clonedInputElKeydownEventListener = (evt: KeyboardEvent) => {
      const keyEvent = evt as KeyboardEvent;
      const hotkey = this.settings.hotkeys.grep.search[0];
      if (!hotkey) {
        return;
      }

      if (equalsAsHotkey(hotkey, keyEvent)) {
        evt.preventDefault();
        this.currentQuery = this.clonedInputEl!.value;
        this.inputEl.value = this.currentQuery;
        // Necessary to rerender suggestions
        this.inputEl.dispatchEvent(new Event("input"));
      }
    };
    this.clonedInputEl.addEventListener(
      "keydown",
      this.clonedInputElKeydownEventListener,
    );

    this.debounceInputEvent =
      this.settings.grepSearchDelayMilliSeconds > 0
        ? debounce(
            () => {
              this.currentQuery = this.clonedInputEl!.value;
              this.inputEl.value = this.currentQuery;

              this.validateRegexInput();

              if (
                this.currentQuery.length >= this.settings.grepMinQueryLength
              ) {
                // Necessary to rerender suggestions
                this.inputEl.dispatchEvent(new Event("input"));
              }
            },
            this.settings.grepSearchDelayMilliSeconds,
            true,
          )
        : debounce(
            () => {
              this.validateRegexInput();
            },
            0,
            true,
          );
    this.clonedInputElInputEventListener = () => {
      this.debounceInputEvent();
    };
    this.clonedInputEl.addEventListener(
      "input",
      this.clonedInputElInputEventListener,
    );

    this.registerKeys("up", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.registerKeys("down", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
    });

    this.registerKeys("clear input", () => {
      this.clonedInputEl.value = "";
      // Necessary to rerender suggestions
      this.clonedInputEl.dispatchEvent(new InputEvent("input"));
      this.clonedInputEl.focus();
    });

    this.registerKeys("clear path", () => {
      this.basePathInputEl.value = "";
      this.basePathInputEl.dispatchEvent(new InputEvent("change"));
    });
    this.registerKeys("set ./ to path", () => {
      this.basePathInputEl.value = "./";
      this.basePathInputEl.dispatchEvent(new InputEvent("change"));
    });

    this.registerKeys("toggle input", () => {
      this.toggleInput();
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
    this.registerKeys("open all in new tabs", async () => {
      this.close();
      if (this.chooser.values == null) {
        return;
      }

      const items = this.chooser.values.slice().reverse();
      for (const x of items) {
        await this.appHelper.openFile(x.file, {
          leafType: "new-tab",
          line: x.lineNumber - 1,
          preventDuplicateTabs: this.settings.preventDuplicateTabs,
        });
        await sleep(0);
      }
    });

    this.registerKeys("preview", this.preview);

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

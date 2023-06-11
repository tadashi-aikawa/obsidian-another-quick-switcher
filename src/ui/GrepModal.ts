import { App, SuggestModal, TFile, WorkspaceLeaf } from "obsidian";
import { Hotkeys, Settings } from "../settings";
import { AppHelper, LeafType, CaptureState } from "../app-helper";
import { rg } from "../utils/ripgrep";
import {
  createInstruction,
  createInstructions,
  equalsAsHotkey,
  quickResultSelectionModifier,
} from "../keys";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";
import { normalizePath, normalizeRelativePath } from "../utils/path";
import { setFloatingModal } from "./modal";
import { capitalizeFirstLetter } from "../utils/strings";
import { sorter } from "../utils/collection-helper";

let globalInternalStorage: {
  items: SuggestionItem[];
  basePath?: string;
  selected?: number;
} = {
  items: [],
  basePath: undefined,
  selected: undefined,
};

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

interface SuggestionItem {
  order: number;
  file: TFile;
  line: string;
  lineNumber: number;
  offset: number;
  submatches: {
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
  appHelper: AppHelper;
  settings: Settings;
  initialLeaf: WorkspaceLeaf | null;
  stateToRestore: CaptureState;

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
    ev: HTMLElementEventMap["keydown"]
  ) => any;
  countInputEl?: HTMLDivElement;
  basePathInputEl: HTMLInputElement;
  basePathInputElChangeEventListener: (
    this: HTMLInputElement,
    ev: HTMLElementEventMap["change"]
  ) => any;
  basePathInputElKeydownEventListener: (
    this: HTMLInputElement,
    ev: HTMLElementEventMap["keydown"]
  ) => any;

  private markClosed: () => void;
  isClosed: Promise<void> = new Promise((resolve) => {
    this.markClosed = resolve;
  });
  navQueue: Promise<void> = Promise.resolve();

  constructor(app: App, settings: Settings, initialLeaf: WorkspaceLeaf | null) {
    super(app);
    this.suggestions = globalInternalStorage.items;
    this.vaultRootPath = normalizePath(
      (this.app.vault.adapter as any).basePath as string
    );

    this.appHelper = new AppHelper(app);
    this.settings = settings;
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
        `Please set a key about "search" in the "Grep dialog" setting`
      );
    }
    this.setHotkeys();
  }

  onOpen() {
    super.onOpen();
    setFloatingModal(this.appHelper);

    this.basePath = globalInternalStorage.basePath ?? "";

    window.setTimeout(() => {
      if (globalInternalStorage.selected != null) {
        this.chooser.setSelectedItem(globalInternalStorage.selected!);
      }

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
      this.appHelper
        .getFolders()
        .filter((x) => !x.isRoot())
        .forEach((x) => {
          basePathInputList.appendChild(createEl("option", { value: x.path }));
        });

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
        this.basePathInputElChangeEventListener
      );
      this.basePathInputEl.addEventListener(
        "keydown",
        this.basePathInputElKeydownEventListener
      );

      const wrapper = createDiv({
        cls: "another-quick-switcher__grep__path-input__wrapper",
      });
      wrapper.appendChild(this.basePathInputEl);
      wrapper.appendChild(basePathInputList);

      const promptInputContainerEl = activeWindow.activeDocument.querySelector(
        ".prompt-input-container"
      );
      promptInputContainerEl?.after(wrapper);

      wrapper.insertAdjacentHTML("afterbegin", FOLDER);
    }, 0);
  }

  onClose() {
    super.onClose();
    globalInternalStorage.items = this.suggestions;
    globalInternalStorage.basePath = this.basePath;
    globalInternalStorage.selected = this.chooser.selectedItem;
    this.clonedInputEl.removeEventListener(
      "keydown",
      this.clonedInputElKeydownEventListener
    );
    this.basePathInputEl.removeEventListener(
      "change",
      this.basePathInputElChangeEventListener
    );
    this.basePathInputEl.removeEventListener(
      "keydown",
      this.basePathInputElKeydownEventListener
    );

    if (this.stateToRestore) {
      // restore initial leaf state, undoing any previewing
      this.navigate(() => this.stateToRestore.restore());
    }
    this.navigate(this.markClosed);
  }

  async searchSuggestions(query: string): Promise<SuggestionItem[]> {
    const start = performance.now();

    this.countInputEl?.remove();
    this.countInputEl = createDiv({
      text: "searching...",
      cls: "another-quick-switcher__grep__count-input",
    });
    this.clonedInputEl.before(this.countInputEl);

    const hasCapitalLetter = query.toLowerCase() !== query;

    const absolutePathFromRoot = normalizeRelativePath(
      this.basePath,
      this.appHelper.getCurrentDirPath()
    );

    const rgResults = await rg(
      this.settings.ripgrepCommand,
      ...[
        ...this.settings.grepExtensions.flatMap((x) => ["-t", x]),
        hasCapitalLetter ? "" : "-i",
        "--",
        query,
        `${this.vaultRootPath}/${absolutePathFromRoot}`,
      ].filter((x) => x)
    );

    const items = rgResults
      .map((x) => {
        return {
          order: -1,
          file: this.appHelper.getFileByPath(
            normalizePath(x.data.path.text).replace(
              this.vaultRootPath + "/",
              ""
            )
          )!,
          line: x.data.lines.text,
          lineNumber: x.data.line_number,
          offset: x.data.absolute_offset,
          submatches: x.data.submatches,
        };
      })
      .filter((x) => x.file != null)
      .sort(sorter((x) => x.file.stat.mtime, "desc"))
      .map((x, order) => ({ ...x, order }));

    this.showDebugLog(() =>
      buildLogMessage(`getSuggestions: `, performance.now() - start)
    );

    return items;
  }

  async getSuggestions(query: string): Promise<SuggestionItem[]> {
    if (query) {
      this.suggestions = await this.searchSuggestions(query);

      this.countInputEl?.remove();
      this.countInputEl = createDiv({
        text: `${Math.min(this.suggestions.length, this.limit)} / ${
          this.suggestions.length
        }`,
        cls: "another-quick-switcher__grep__count-input",
      });
      this.clonedInputEl.before(this.countInputEl);
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
        text: item.file.basename,
        attr: {
          extension: item.file.extension,
        },
      });
      const isExcalidraw = item.file.basename.endsWith(".excalidraw");
      if (item.file.extension !== "md" || isExcalidraw) {
        const extDiv = createDiv({
          cls: "another-quick-switcher__item__extension",
          text: isExcalidraw ? "excalidraw" : item.file.extension,
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

    let restLine = item.line;
    item.submatches.forEach((x) => {
      const i = restLine.indexOf(x.match.text);
      descriptionDiv.createSpan({
        text: restLine.slice(0, i),
      });
      descriptionDiv.createSpan({
        text: x.match.text,
        cls: "another-quick-switcher__hit_word",
      });
      restLine = restLine.slice(i + x.match.text.length);
    });
    descriptionDiv.createSpan({
      text: restLine,
    });

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
    option: { keepOpen?: boolean } = {}
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
          leaf: leaf,
          line: item.lineNumber - 1,
          inplace: option.keepOpen,
        },
        this.stateToRestore
      )
    );
    return item.file;
  }

  async onChooseSuggestion(
    item: SuggestionItem,
    evt: MouseEvent | KeyboardEvent
  ): Promise<void> {
    await this.chooseCurrentSuggestion("same-tab");
  }

  private showDebugLog(toMessage: () => string) {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(toMessage());
    }
  }

  private registerKeys(
    key: keyof Hotkeys["grep"],
    handler: () => void | Promise<void>
  ) {
    this.settings.hotkeys.grep[key]?.forEach((x) => {
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
        { command: "[↵]", purpose: "open" },
        { command: `[↑]`, purpose: "up" },
        { command: `[↓]`, purpose: "down" },
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
      this.clonedInputElKeydownEventListener
    );

    this.registerKeys("up", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.registerKeys("down", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
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
      // FIXME: chooseCurrentSuggestionにできるか?
      const file = await this.chooseCurrentSuggestion("same-tab", {
        keepOpen: true,
      });
    });

    const modifierKey = this.settings.userAltInsteadOfModForQuickResultSelection
      ? "Alt"
      : "Mod";
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => {
      this.scope.register([modifierKey], String(n), (evt: KeyboardEvent) => {
        this.chooser.setSelectedItem(n - 1, evt, true);
        this.chooser.useSelectedItem({});
        return false;
      });
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

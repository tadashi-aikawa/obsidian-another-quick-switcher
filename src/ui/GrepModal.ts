import { App, SuggestModal, TFile } from "obsidian";
import { Hotkeys, Settings } from "../settings";
import { AppHelper, LeafType } from "../app-helper";
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

  constructor(app: App, settings: Settings) {
    super(app);
    this.suggestions = globalInternalStorage.items;
    this.vaultRootPath = normalizePath(
      (this.app.vault.adapter as any).basePath as string
    );

    this.appHelper = new AppHelper(app);
    this.settings = settings;
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
    activeWindow.activeDocument
      .querySelector(".modal-bg")
      ?.addClass("another-quick-switcher__grep__floating-modal-bg");

    this.basePath = globalInternalStorage.basePath ?? "";

    const promptEl = activeWindow.activeDocument.querySelector(".prompt");
    promptEl?.addClass("another-quick-switcher__grep__floating-prompt");
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
        "-t",
        "md",
        hasCapitalLetter ? "" : "-i",
        "--",
        query,
        `${this.vaultRootPath}/${absolutePathFromRoot}`,
      ].filter((x) => x)
    );

    const items = rgResults
      .map((x, order) => {
        return {
          order,
          file: this.appHelper.getMarkdownFileByPath(
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
      .filter((x) => x.file != null);

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
    const itemDiv = createDiv({
      cls: "another-quick-switcher__item",
    });

    const entryDiv = createDiv({
      cls: "another-quick-switcher__item__entry",
    });

    const titleDiv = createDiv({
      cls: "another-quick-switcher__item__title",
      text: item.file.basename,
    });
    entryDiv.appendChild(titleDiv);

    if (item.order! < 9) {
      const hotKeyGuide = createSpan({
        cls: "another-quick-switcher__item__hot-key-guide",
        text: `${item.order! + 1}`,
      });
      entryDiv.appendChild(hotKeyGuide);
    }

    itemDiv.appendChild(entryDiv);
    if (this.settings.showDirectory) {
      const directoryDiv = createDiv({
        cls: "another-quick-switcher__item__directory",
      });
      directoryDiv.insertAdjacentHTML("beforeend", FOLDER);
      const text = this.settings.showFullPathOfDirectory
        ? item.file.parent.path
        : item.file.parent.name;
      directoryDiv.appendText(` ${text}`);
      entryDiv.appendChild(directoryDiv);

      if (this.settings.showDirectoryAtNewLine) {
        itemDiv.appendChild(directoryDiv);
      }
    }

    const descriptionsDiv = createDiv({
      cls: "another-quick-switcher__item__descriptions",
    });

    const descriptionDiv = createDiv({
      cls: "another-quick-switcher__item__description",
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

    descriptionsDiv.appendChild(descriptionDiv);
    itemDiv.appendChild(descriptionsDiv);

    el.appendChild(itemDiv);
  }

  async chooseCurrentSuggestion(
    leaf: LeafType,
    option: { keepOpen?: boolean } = {}
  ): Promise<void> {
    const item = this.chooser.values?.[this.chooser.selectedItem];
    if (!item) {
      return;
    }

    if (!option.keepOpen) {
      this.close();
    }
    this.appHelper.openFile(item.file, {
      leaf: leaf,
      line: item.lineNumber - 1,
    });
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
      this.scope.register(x.modifiers, x.key.toUpperCase(), (evt) => {
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
        ...createInstructions(this.settings.hotkeys.grep),
        { command: "[esc]", purpose: "dismiss" },
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
      const item = this.chooser.values?.[this.chooser.selectedItem];
      if (!item) {
        return;
      }

      this.appHelper.openFile(item.file, {
        line: item.lineNumber - 1,
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
  }
}

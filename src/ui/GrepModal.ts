import { App, normalizePath, SuggestModal, TFile } from "obsidian";
import { Hotkeys, Settings } from "../settings";
import { AppHelper, LeafType } from "../app-helper";
import { rg } from "../utils/ripgrep";
import {
  createInstructions,
  equalsAsHotkey,
  quickResultSelectionModifier,
} from "../keys";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";

let globalInternalStorage: {
  items: SuggestionItem[];
  selected?: number;
} = {
  items: [],
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
  currentQuery: string;
  suggestions: SuggestionItem[];

  clonedInputEl: HTMLInputElement;
  clonedInputElKeyupEventListener: (
    this: HTMLInputElement,
    ev: HTMLElementEventMap["keyup"]
  ) => any;
  countInputEl?: HTMLDivElement;

  constructor(app: App, settings: Settings) {
    super(app);
    this.suggestions = globalInternalStorage.items;

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.limit = 255;

    this.setPlaceholder("Search around the vault by TAB key");
    this.setHotkeys();
  }

  onOpen() {
    super.onOpen();
    activeWindow.activeDocument
      .querySelector(".modal-bg")
      ?.addClass("another-quick-switcher__grep__floating-modal-bg");

    const promptEl = activeWindow.activeDocument.querySelector(".prompt");
    promptEl?.addClass("another-quick-switcher__grep__floating-prompt");
    window.setTimeout(() => {
      if (globalInternalStorage.selected != null) {
        this.chooser.setSelectedItem(globalInternalStorage.selected!);
      }
    }, 0);
  }

  onClose() {
    super.onClose();
    globalInternalStorage.items = this.suggestions;
    globalInternalStorage.selected = this.chooser.selectedItem;
    this.clonedInputEl.removeEventListener(
      "keyup",
      this.clonedInputElKeyupEventListener
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

    const basePath: string = (this.app.vault.adapter as any).basePath;
    const rgResults = await rg(
      ...[
        "-t",
        "md",
        hasCapitalLetter ? "" : "-i",
        "--",
        query,
        basePath,
      ].filter((x) => x)
    );

    const items = rgResults.map((x, order) => ({
      order,
      file: this.appHelper.getMarkdownFileByPath(
        normalizePath(x.data.path.text.replace(basePath, ""))
      )!,
      line: x.data.lines.text,
      lineNumber: x.data.line_number,
      offset: x.data.absolute_offset,
      submatches: x.data.submatches,
    }));

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

  async chooseCurrentSuggestion(leaf: LeafType): Promise<void> {
    const item = this.chooser.values?.[this.chooser.selectedItem];
    if (!item) {
      return;
    }

    this.close();
    this.appHelper.openMarkdownFile(item.file, {
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
        ...createInstructions(this.settings.hotkeys.grep),
        { command: "[esc]", purpose: "dismiss" },
      ]);
    }

    // XXX: This is a hack to avoid default input events
    this.clonedInputEl = this.inputEl.cloneNode(true) as HTMLInputElement;
    this.inputEl.parentNode?.replaceChild(this.clonedInputEl, this.inputEl);
    this.clonedInputElKeyupEventListener = (evt: KeyboardEvent) => {
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
      this.clonedInputElKeyupEventListener
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

    this.registerKeys("preview", () => {
      const item = this.chooser.values?.[this.chooser.selectedItem];
      if (!item) {
        return;
      }

      this.appHelper.openMarkdownFile(item.file, {
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

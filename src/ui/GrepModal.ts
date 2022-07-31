import {
  App,
  debounce,
  Debouncer,
  normalizePath,
  SuggestModal,
  TFile,
} from "obsidian";
import { Settings } from "../settings";
import { AppHelper, LeafType } from "../app-helper";
import { rg } from "../utils/ripgrep";
import { MOD, quickResultSelectionModifier } from "../keys";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";

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

export class GrepModal extends SuggestModal<SuggestionItem> {
  appHelper: AppHelper;
  settings: Settings;
  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];
  currentQuery: string;

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void]
  >;

  constructor(app: App, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.limit = 255;

    this.setHotKeys();
    this.debounceGetSuggestions = debounce(
      async (query: string, cb: (items: SuggestionItem[]) => void) => {
        cb(await this._getSuggestions(query));
      },
      250,
      true
    );
  }

  onOpen() {
    super.onOpen();
    activeWindow.activeDocument
      .querySelector(".modal-bg")
      ?.addClass("another-quick-switcher__grep__floating-modal-bg");

    const promptEl = activeWindow.activeDocument.querySelector(".prompt");
    promptEl?.addClass("another-quick-switcher__grep__floating-prompt");
  }

  async _getSuggestions(query: string): Promise<SuggestionItem[]> {
    const start = performance.now();

    const hasCapitalLetter = query.toLowerCase() !== query;

    const basePath: string = (this.app.vault.adapter as any).basePath;
    const rgResults = await rg(
      "-t",
      "md",
      hasCapitalLetter ? "" : "-i",
      "--",
      query,
      basePath
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
    this.currentQuery = query;
    if (!query) {
      return [];
    }

    return new Promise((resolve) => {
      this.debounceGetSuggestions(query, (items) => {
        resolve(items);
      });
    });
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

    itemDiv.appendChild(descriptionDiv);

    el.appendChild(itemDiv);
  }

  async onChooseSuggestion(
    item: SuggestionItem,
    evt: MouseEvent | KeyboardEvent
  ): Promise<void> {
    let leaf: LeafType;
    const key = (evt as KeyboardEvent).key;

    if (evt.metaKey && key === "o") {
      leaf = "popout";
    } else if (evt.metaKey && evt.shiftKey && key === "-") {
      leaf = "new-vertical";
    } else if (evt.metaKey && !evt.shiftKey && key === "-") {
      leaf = "new-horizontal";
    } else if (evt.metaKey && evt.altKey) {
      leaf = "popup";
    } else if (evt.metaKey && !evt.altKey) {
      leaf = "new";
    } else {
      leaf = "same";
    }

    this.appHelper.openMarkdownFile(item.file, {
      leaf,
      line: item.lineNumber - 1,
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
      { command: "[↵]", purpose: "open" },
      { command: `[${MOD} ↵]`, purpose: "open in new pane" },
      { command: `[${MOD} -]`, purpose: "open in new pane (horizontal)" },
      { command: `[${MOD} shift -]`, purpose: "open in new pane (vertical)" },
      { command: `[${MOD} o]`, purpose: "open in new window" },
      { command: `[${MOD} alt ↵]`, purpose: "open in popup" },
      { command: `[${MOD} ,]`, purpose: "preview" },
      { command: "[esc]", purpose: "dismiss" },
    ]);

    this.scope.register(["Mod"], "Enter", () =>
      this.chooser.useSelectedItem({ metaKey: true })
    );
    this.scope.register(["Mod"], "-", () => {
      this.chooser.useSelectedItem({ metaKey: true, key: "-" });
      return false;
    });
    this.scope.register(["Mod", "Shift"], "-", () => {
      this.chooser.useSelectedItem({ metaKey: true, shiftKey: true, key: "-" });
      return false;
    });
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

    this.scope.register(["Mod"], "D", () => {
      this.inputEl.value = "";
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    });

    this.scope.register(["Mod"], ",", () => {
      const item = this.chooser.values[this.chooser.selectedItem];
      this.appHelper.openMarkdownFile(item.file, {
        line: item.lineNumber - 1,
      });
    });
  }
}

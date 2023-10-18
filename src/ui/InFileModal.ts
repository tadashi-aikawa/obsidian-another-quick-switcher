import {
  App,
  debounce,
  Debouncer,
  SuggestModal,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { Hotkeys, Settings } from "../settings";
import { AppHelper, CaptureState, LeafType } from "../app-helper";
import { createInstructions, quickResultSelectionModifier } from "../keys";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { setFloatingModal } from "./modal";
import {
  capitalizeFirstLetter,
  includes,
  trimLineByEllipsis,
} from "../utils/strings";
import { isPresent } from "../utils/types";
import { Logger } from "../utils/logger";

let globalInternalStorage: {
  query: string;
} = {
  query: "",
};

interface SuggestionItem {
  order?: number;
  file?: TFile;
  lineBefore: string[];
  line: string;
  lineAfter: string[];
  // >= 1
  lineNumber: number;
}

export class InFileModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
  logger: Logger;
  appHelper: AppHelper;
  settings: Settings;
  ignoredItems: SuggestionItem[];
  initialLeaf: WorkspaceLeaf | null;
  stateToRestore: CaptureState;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  currentQueriesRegExp: RegExp;

  debounceGetSuggestions: Debouncer<
    [string, (items: SuggestionItem[]) => void],
    void
  >;

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

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.logger = Logger.of(this.settings);
    this.initialLeaf = initialLeaf;
    this.limit = 255;

    this.setHotkeys();
    this.setPlaceholder("Type anything then shows the results");

    this.debounceGetSuggestions = debounce(
      (query: string, cb: (items: SuggestionItem[]) => void) => {
        cb(this._getSuggestions(query));
      },
      this.settings.searchDelayMilliSeconds,
      true
    );
  }

  async init() {
    await this.indexingItems();
  }

  onOpen() {
    super.onOpen();
    setFloatingModal(this.appHelper);

    this.inputEl.value = globalInternalStorage.query;
    // Necessary to rerender suggestions
    this.inputEl.dispatchEvent(new Event("input"));
    this.inputEl.select();

    this.opened = true;
  }

  onClose() {
    super.onClose();
    globalInternalStorage.query = this.inputEl.value;
    if (this.stateToRestore) {
      // restore initial leaf state, undoing any previewing
      this.navigate(() => this.stateToRestore.restore());
    }
    this.navigate(this.markClosed);
  }

  async indexingItems() {
    const file = this.appHelper.getActiveFile()!;
    const lines = this.appHelper.getCurrentEditor()!.getValue().split("\n");
    this.ignoredItems = lines.map((line, i) => ({
      file,
      lineBefore: [lines[i - 2], lines[i - 1]].filter(isPresent),
      line,
      lineAfter: [lines[i + 1], lines[i + 2]].filter(isPresent),
      lineNumber: i + 1,
    }));
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
    this.currentQueriesRegExp = new RegExp(queries.join("|"), "gi");

    const matchedSuggestions = isQueryEmpty
      ? []
      : this.ignoredItems.filter((x) =>
          queries.every((q) =>
            includes(x.line, q, this.settings.normalizeAccentsAndDiacritics)
          )
        );

    this.logger.showDebugLog(`Get suggestions: ${query}`, start);

    this.countInputEl?.remove();
    this.countInputEl = createDiv({
      text: `${Math.min(matchedSuggestions.length, this.limit)} / ${
        matchedSuggestions.length
      }`,
      cls: "another-quick-switcher__in-file__status__count-input",
    });
    this.inputEl.before(this.countInputEl);

    this.suggestions = matchedSuggestions
      .slice(0, this.limit)
      .map((x, order) => ({ ...x, order }));
    return this.suggestions;
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const itemDiv = createDiv({
      cls: [
        "another-quick-switcher__item",
        "another-quick-switcher__in-file__item",
      ],
    });

    const descriptionsDiv = createDiv({
      cls: "another-quick-switcher__item__descriptions",
    });

    const descriptionDiv = createDiv({
      cls: "another-quick-switcher__in-file__item__description",
    });

    item.lineBefore.forEach((line, i) => {
      const lineDiv = descriptionDiv.createDiv({
        cls: "another-quick-switcher__in-file__line",
      });
      lineDiv.createSpan({
        text: String(item.lineNumber - item.lineBefore.length + i),
        cls: "another-quick-switcher__in-file__line-number",
      });
      lineDiv.createSpan({
        text: trimLineByEllipsis(
          line,
          this.settings.maxDisplayLengthAroundMatchedWord
        ),
      });
    });

    const activeLineDiv = descriptionDiv.createDiv({
      cls: [
        "another-quick-switcher__in-file__line",
        "another-quick-switcher__in-file__active-line",
      ],
    });
    activeLineDiv.createSpan({
      text: item.lineNumber.toString(),
      cls: "another-quick-switcher__in-file__line-number",
    });

    const activeLineBlockDiv = activeLineDiv.createDiv();
    let restLine = item.line;
    let offset = 0;
    Array.from(restLine.matchAll(this.currentQueriesRegExp))
      .map((x) => ({ index: x.index!, text: x[0] }))
      .forEach(({ index, text }) => {
        const before = restLine.slice(0, index - offset);

        activeLineBlockDiv.createSpan({
          text: trimLineByEllipsis(
            before,
            this.settings.maxDisplayLengthAroundMatchedWord
          ),
        });
        activeLineBlockDiv.createSpan({
          text,
          cls: "another-quick-switcher__hit_word",
        });

        offset += before.length + text.length;
        restLine = item.line.slice(offset);
      });
    activeLineBlockDiv.createSpan({
      text: trimLineByEllipsis(
        restLine,
        this.settings.maxDisplayLengthAroundMatchedWord
      ),
    });

    item.lineAfter.forEach((line, i) => {
      const lineDiv = descriptionDiv.createDiv({
        cls: "another-quick-switcher__in-file__line",
      });
      lineDiv.createSpan({
        text: String(item.lineNumber + i + 1),
        cls: "another-quick-switcher__in-file__line-number",
      });
      lineDiv.createSpan({
        text: trimLineByEllipsis(
          line,
          this.settings.maxDisplayLengthAroundMatchedWord
        ),
      });
    });

    if (item.order! < 9) {
      const hotKeyGuide = createSpan({
        cls: "another-quick-switcher__in-file__item__hot-key-guide",
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
        this.appHelper.getActiveFile()!,
        {
          leaf: leaf,
          line: item.lineNumber - 1,
          inplace: option.keepOpen,
        },
        this.stateToRestore
      )
    );
    return this.appHelper.getActiveFile()!;
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
    key: keyof Hotkeys["link"],
    handler: () => void | Promise<void>
  ) {
    this.settings.hotkeys.link[key]?.forEach((x) => {
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
        ...createInstructions(this.settings.hotkeys["in-file"]),
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
        .map((x) => x.file)
        .filter(isPresent)
        .forEach((x) =>
          this.appHelper.openFile(x, {
            leaf: "new-tab-background",
          })
        );
    });

    this.registerKeys("show all results", () => {
      this.limit = Number.MAX_SAFE_INTEGER;
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
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

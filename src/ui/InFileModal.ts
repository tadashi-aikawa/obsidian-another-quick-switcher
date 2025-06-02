import {
  type App,
  type EditorPosition,
  Platform,
  SuggestModal,
  type WorkspaceLeaf,
} from "obsidian";
import { AppHelper } from "../app-helper";
import type { CaptureState } from "../app-helper";
import {
  createInstructions,
  normalizeKey,
  quickResultSelectionModifier,
} from "../keys";
import type { Hotkeys, Settings } from "../settings";
import { range } from "../utils/collection-helper";
import { Logger } from "../utils/logger";
import {
  capitalIncludes,
  capitalizeFirstLetter,
  escapeRegExp,
  trimLineByEllipsis,
} from "../utils/strings";
import { isPresent } from "../utils/types";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";
import { PREVIEW } from "./icons";
import { setFloatingModal } from "./modal";

const globalInternalStorage: {
  query: string;
  selected: number | null;
} = {
  query: "",
  selected: null,
};

interface SuggestionItem {
  order?: number;
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
  floating: boolean;
  autoPreview: boolean;
  ignoredItems: SuggestionItem[];
  initialLeaf: WorkspaceLeaf | null;
  /** !Not work correctly in all cases */
  unsafeSelectedIndex = 0;

  // unofficial
  isOpen: boolean;
  updateSuggestions: () => unknown;
  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  previewIcon: Element | null;

  currentQueriesRegExp: RegExp;

  suggestions: SuggestionItem[] = [];
  opened: boolean;

  countInputEl?: HTMLDivElement;

  stateToRestore: CaptureState;
  initialCursor: EditorPosition;
  navQueue: Promise<void>;

  constructor(app: App, settings: Settings, initialLeaf: WorkspaceLeaf | null) {
    super(app);
    this.modalEl.addClass("another-quick-switcher__modal-prompt");

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.logger = Logger.of(this.settings);
    this.initialLeaf = initialLeaf;
    this.floating = this.settings.autoPreviewInFloatingInFileSearch;
    this.autoPreview = settings.autoPreviewInFloatingInFileSearch;
    this.stateToRestore = this.appHelper.captureStateInFile(this.initialLeaf);
    this.initialCursor = this.appHelper.getCurrentEditor()!.getCursor();
    this.navQueue = Promise.resolve();
    this.limit = 255;

    this.setHotkeys();
    this.setPlaceholder("Type anything then shows the results");
  }

  close() {
    if (Platform.isMobile) {
      // https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/207
      this.onClose();
    }
    super.close();
  }

  async init() {
    await this.indexingItems();
  }

  navigate(cb: () => any) {
    this.navQueue = this.navQueue.then(cb);
  }

  onOpen() {
    // WARN: Instead of super.onOpen()
    this.isOpen = true;
    this.inputEl.value = globalInternalStorage.query;
    this.inputEl.select();
    this.updateSuggestions();

    if (this.floating) {
      this.enableFloating();
      this.refreshPreviewIcon();
    }

    if (
      globalInternalStorage.selected != null &&
      this.chooser.suggestions.length > 0
    ) {
      const selected = Math.min(
        globalInternalStorage.selected,
        this.chooser.suggestions.length - 1,
      );
      this.select(selected);
      this.chooser.suggestions.at(selected)?.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "center",
      });
    }

    this.inputEl.addEventListener("input", (evt) => {
      const unsafeEvt = evt as KeyboardEvent;
      if (this.suggestions.length === 0) {
        return;
      }

      this.select(
        Math.min(this.unsafeSelectedIndex, this.suggestions.length - 1),
        unsafeEvt,
      );
    });

    this.opened = true;
  }

  onClose() {
    super.onClose();
    globalInternalStorage.query = this.inputEl.value;
    globalInternalStorage.selected =
      this.chooser.values != null ? this.chooser.selectedItem : null;

    if (this.stateToRestore) {
      this.navigate(() => this.stateToRestore!.restore());
    }
  }

  select(index: number, evt?: KeyboardEvent) {
    this.chooser.setSelectedItem(index, evt);
    this.unsafeSelectedIndex = index;
    if (this.autoPreview) {
      const p = {
        line: this.chooser.values![index].lineNumber - 1,
        offset: 0,
        col: 0,
      };
      this.appHelper.moveTo({
        start: p,
        end: p,
      });
    }
  }

  getNextSelectIndex(): number {
    return this.chooser.selectedItem + 1 > this.chooser.suggestions.length - 1
      ? 0
      : this.chooser.selectedItem + 1;
  }

  getPreviousSelectIndex(): number {
    return this.chooser.selectedItem - 1 < 0
      ? this.chooser.suggestions.length - 1
      : this.chooser.selectedItem - 1;
  }

  refreshPreviewIcon() {
    this.previewIcon?.remove();
    if (this.autoPreview) {
      this.previewIcon = this.inputEl.insertAdjacentElement(
        "afterend",
        createDiv({
          cls: "another-quick-switcher__in-file__auto-preview-icon",
        }),
      );
      this.previewIcon?.insertAdjacentHTML("beforeend", PREVIEW);
    }
  }

  enableFloating() {
    this.floating = true;
    if (!Platform.isPhone) {
      setFloatingModal(this.appHelper);
    }
  }

  async indexingItems() {
    const lines = this.appHelper.getCurrentEditor()!.getValue().split("\n");

    this.ignoredItems = lines.map((line, i) => ({
      lineBefore: range(this.settings.inFileContextLines)
        .reverse()
        .map((x) => lines[i - x - 1])
        .filter(isPresent),
      line,
      lineAfter: range(this.settings.inFileContextLines)
        .map((x) => lines[i + x + 1])
        .filter(isPresent),
      lineNumber: i + 1,
    }));
  }

  getSuggestions(query: string): SuggestionItem[] {
    const start = performance.now();

    const isQueryEmpty = query.trim() === "";
    const queries = query.trim().split(" ");
    this.currentQueriesRegExp = new RegExp(
      queries.map(escapeRegExp).join("|"),
      "gi",
    );

    const matchedSuggestions = isQueryEmpty
      ? []
      : this.ignoredItems.filter((x) =>
          queries.every((q) =>
            capitalIncludes(
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
          this.settings.inFileMaxDisplayLengthAroundMatchedWord,
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

    const indexAndText = Array.from(
      restLine.matchAll(this.currentQueriesRegExp),
    ).map((x) => ({ index: x.index!, text: x[0] }));

    for (const { index, text } of indexAndText) {
      const before = restLine.slice(0, index - offset);

      activeLineBlockDiv.createSpan({
        text: trimLineByEllipsis(
          before,
          this.settings.inFileMaxDisplayLengthAroundMatchedWord,
        ),
      });
      activeLineBlockDiv.createSpan({
        text,
        cls: "another-quick-switcher__hit_word",
      });

      offset += before.length + text.length;
      restLine = item.line.slice(offset);
    }
    activeLineBlockDiv.createSpan({
      text: trimLineByEllipsis(
        restLine,
        this.settings.inFileMaxDisplayLengthAroundMatchedWord,
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
          this.settings.inFileMaxDisplayLengthAroundMatchedWord,
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

  async onChooseSuggestion(item: SuggestionItem): Promise<void> {
    this.appHelper.moveTo(
      this.appHelper
        .getCurrentEditor()!
        .posToOffset({ line: item.lineNumber - 1, ch: 0 }),
      undefined,
      this.initialCursor,
    );
  }

  private registerKeys(
    key: keyof Hotkeys["in-file"],
    handler: (evt: KeyboardEvent) => void | Promise<void>,
  ) {
    for (const x of this.settings.hotkeys["in-file"][key] ?? []) {
      this.scope.register(
        x.modifiers,
        normalizeKey(capitalizeFirstLetter(x.key)),
        (evt) => {
          if (!evt.isComposing) {
            evt.preventDefault();
            handler(evt);
            return false;
          }
        },
      );
    }
  }

  private setHotkeys() {
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
        ...createInstructions(this.settings.hotkeys["in-file"]),
      ]);
    }

    const navigateNext = (evt: KeyboardEvent) => {
      this.select(this.getNextSelectIndex(), evt);
    };
    const navigatePrevious = (evt: KeyboardEvent) => {
      this.select(this.getPreviousSelectIndex(), evt);
    };

    // Unregister default arrows behavior
    const keyHandlers = this.scope.keys.filter((x) =>
      ["ArrowDown", "ArrowUp"].includes(x.key!),
    );
    for (const x of keyHandlers) {
      this.scope.unregister(x);
    }

    this.scope.register([], "ArrowUp", (evt) => {
      evt.preventDefault();
      navigatePrevious(evt);
      return false;
    });
    this.scope.register([], "ArrowDown", (evt) => {
      evt.preventDefault();
      navigateNext(evt);
      return false;
    });

    this.registerKeys("up", (evt) => {
      navigatePrevious(evt);
    });
    this.registerKeys("down", (evt) => {
      navigateNext(evt);
    });

    this.registerKeys("show all results", () => {
      this.limit = Number.MAX_SAFE_INTEGER;
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
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

    this.registerKeys("toggle auto preview", () => {
      this.autoPreview = !this.autoPreview;
      this.refreshPreviewIcon();
      if (this.autoPreview) {
        this.select(this.unsafeSelectedIndex);
        if (!this.floating) {
          this.enableFloating();
        }
      }
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

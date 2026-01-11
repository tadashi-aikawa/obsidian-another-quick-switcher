import { type App, type EditorPosition, Platform, type Pos } from "obsidian";
import { minBy } from "src/utils/collection-helper";
import { AppHelper, type CaptureState } from "../app-helper";
import { createInstructions, normalizeKey } from "../keys";
import type { Hotkeys, Settings } from "../settings";
import {
  capitalizeFirstLetter,
  excludeFormat,
  smartIncludes,
  smartWhitespaceSplit,
} from "../utils/strings";
import { AbstractSuggestionModal } from "./AbstractSuggestionModal";
import { PREVIEW } from "./icons";
import { setFloatingModal } from "./modal";

interface SuggestionItem {
  value: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  position: Pos;
  hit: boolean;
  index: number;
}

export class HeaderModal extends AbstractSuggestionModal<SuggestionItem> {
  toKey(item: SuggestionItem): string {
    return String(item.index);
  }

  items: SuggestionItem[];
  hitItems: SuggestionItem[] = [];
  appHelper: AppHelper;
  settings: Settings;
  floating: boolean;
  autoPreview: boolean;
  /** !Not work correctly in all cases */
  unsafeSelectedIndex = 0;

  previewIcon: Element | null;

  stateToRestore: CaptureState;
  initialCursor: EditorPosition;
  navQueue: Promise<void>;

  constructor(app: App, settings: Settings, floating: boolean) {
    super(app);
    this.modalEl.addClass("another-quick-switcher__modal-prompt");

    this.limit = 1000;

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.floating = floating;
    this.autoPreview = settings.autoPreviewInFloatingHeaderSearch && floating;

    this.stateToRestore = this.appHelper.captureStateInFile(
      this.appHelper.getActiveFileLeaf(),
    );
    this.initialCursor = this.appHelper.getCurrentEditor()!.getCursor();
    this.navQueue = Promise.resolve();

    this.items = this.appHelper.getHeadersInActiveFile().map((x, i) => ({
      value: excludeFormat(x.heading),
      level: x.level as SuggestionItem["level"],
      position: x.position,
      hit: false,
      index: i,
    }));

    this.inputEl.addEventListener("input", (evt) => {
      const unsafeEvt = evt as KeyboardEvent;

      if (this.hitItems.length === 0) {
        this.select(this.unsafeSelectedIndex, unsafeEvt);
        return;
      }

      const nextIndex =
        this.hitItems.find((x) => x.index >= this.unsafeSelectedIndex)?.index ??
        this.hitItems[0].index;

      this.select(nextIndex, unsafeEvt);
    });

    this.setHotkeys();
  }

  navigate(cb: () => any) {
    this.navQueue = this.navQueue.then(cb);
  }

  onClose() {
    super.onClose();
    this.disableFloatingModalWheelScroll();
    this.navigate(() => this.stateToRestore.restore());
  }

  select(index: number, evt?: KeyboardEvent, suppressAutoPreview?: boolean) {
    this.chooser.setSelectedItem(index, evt);
    this.chooser.suggestions.at(index)?.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });

    this.unsafeSelectedIndex = index;
    const item = this.items.at(this.unsafeSelectedIndex);
    if (this.autoPreview && item && !suppressAutoPreview) {
      this.appHelper.moveTo(item.position);
    }
  }

  getNextSelectIndex(): number {
    return this.unsafeSelectedIndex + 1 > this.items.length - 1
      ? 0
      : this.unsafeSelectedIndex + 1;
  }

  getPreviousSelectIndex(): number {
    return this.unsafeSelectedIndex - 1 < 0
      ? this.items.length - 1
      : this.unsafeSelectedIndex - 1;
  }

  onOpen() {
    super.onOpen();
    if (this.floating) {
      this.enableFloating();
      this.refreshPreviewIcon();
    }

    const markdownView = this.appHelper.getMarkdownViewInActiveLeaf();
    if (!markdownView || this.items.length === 0) {
      return;
    }

    const mode = markdownView.getMode();
    const offset =
      mode === "source"
        ? this.appHelper.getCurrentOffset()
        : markdownView.editor.posToOffset({
            ch: 0,
            line: markdownView.previewMode.getScroll(),
          });
    if (!offset) {
      return;
    }

    const firstOverIndex = this.items.findIndex(
      (x) => x.position.start.offset > offset,
    );

    if (firstOverIndex === -1) {
      this.select(this.items.last()!.index, undefined, true);
    } else if (firstOverIndex === 0) {
      this.select(0, undefined, true);
    } else {
      this.select(firstOverIndex - 1, undefined, true);
    }
  }

  refreshPreviewIcon() {
    this.previewIcon?.remove();
    if (this.autoPreview) {
      this.previewIcon = this.inputEl.insertAdjacentElement(
        "afterend",
        createDiv({ cls: "another-quick-switcher__header__auto-preview-icon" }),
      );
      this.previewIcon?.insertAdjacentHTML("beforeend", PREVIEW);
    }
  }

  enableFloating() {
    this.floating = true;
    if (!Platform.isPhone) {
      setFloatingModal(this.appHelper);
      this.enableFloatingModalWheelScroll();
    }
  }

  getSuggestions(query: string): SuggestionItem[] {
    const qs = smartWhitespaceSplit(query);

    const suggestions = this.items.map((x) => {
      const hit =
        qs.length > 0 &&
        qs.every((q) =>
          smartIncludes(
            x.value,
            q,
            this.settings.normalizeAccentsAndDiacritics,
          ),
        );
      return { ...x, hit };
    });

    this.hitItems = suggestions.filter((x) => x.hit);

    return suggestions;
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const itemDiv = createDiv({
      cls: "another-quick-switcher__item",
    });

    const entryDiv = createDiv({
      cls: "another-quick-switcher__item__entry",
    });

    const headerDiv = createDiv({
      cls: [
        "another-quick-switcher__item__title",
        "another-quick-switcher__item__title__header",
        item.hit
          ? "another-quick-switcher__item__title__header_hit"
          : "another-quick-switcher__item__title__header_no_hit",
        `another-quick-switcher__item__title__header${item.level}`,
      ],
      text: item.value,
    });
    entryDiv.appendChild(headerDiv);

    if (item.hit) {
      const i = this.hitItems.findIndex((x) => x.index === item.index);
      if (i !== -1) {
        entryDiv.createSpan({
          cls: "another-quick-switcher__item__title__header_hit__counter",
          text: `${i + 1} / ${this.hitItems.length}`,
        });
      }
    }

    itemDiv.appendChild(entryDiv);

    el.appendChild(itemDiv);
  }

  async onChooseSuggestion(item: SuggestionItem): Promise<void> {
    this.appHelper.moveTo(item.position, undefined, this.initialCursor);
  }

  private registerKeys(
    key: keyof Hotkeys["header"],
    handler: (evt: KeyboardEvent) => void | Promise<void>,
  ) {
    for (const x of this.settings.hotkeys.header[key] ?? []) {
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

  setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↵]", purpose: "move to header" },
        { command: "[↑]", purpose: "up" },
        { command: "[↓]", purpose: "down" },
        ...createInstructions(this.settings.hotkeys.header),
      ]);
    }

    const navigateNext = (evt: KeyboardEvent) => {
      this.select(this.getNextSelectIndex(), evt);
    };
    const navigatePrevious = (evt: KeyboardEvent) => {
      this.select(this.getPreviousSelectIndex(), evt);
    };
    const moveToNextHit = (evt: KeyboardEvent) => {
      if (this.hitItems.length === 1) {
        return;
      }
      if (this.hitItems.length === 0) {
        navigateNext(evt);
        return;
      }

      const nextIndex =
        this.hitItems.find((x) => x.index > this.unsafeSelectedIndex)?.index ??
        this.hitItems[0].index;
      this.select(nextIndex, evt);
    };
    const moveToPreviousHit = (evt: KeyboardEvent) => {
      if (this.hitItems.length === 1) {
        return;
      }
      if (this.hitItems.length === 0) {
        navigatePrevious(evt);
        return;
      }

      const currentIndex = this.hitItems.findIndex(
        (x) => x.index >= this.unsafeSelectedIndex,
      );
      const previousIndex =
        currentIndex === 0 ? this.hitItems.length - 1 : currentIndex - 1;
      this.select(this.hitItems[previousIndex].index, evt);
    };

    // Unregister default arrows behavior
    for (const x of this.scope.keys.filter((x) =>
      ["ArrowDown", "ArrowUp"].includes(x.key!),
    )) {
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
    this.registerKeys("scroll preview up", () => {
      this.scrollActiveLeafByPage("up");
    });
    this.registerKeys("scroll preview down", () => {
      this.scrollActiveLeafByPage("down");
    });
    this.registerKeys("clear input", () => {
      this.inputEl.value = "";
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new InputEvent("input"));
    });
    this.registerKeys("move to next hit", (evt) => {
      moveToNextHit(evt);
    });
    this.registerKeys("move to previous hit", (evt) => {
      moveToPreviousHit(evt);
    });
    this.registerKeys("toggle auto preview", () => {
      this.autoPreview = !this.autoPreview;
      this.refreshPreviewIcon();
      if (this.autoPreview && !this.floating) {
        this.enableFloating();
      }
    });

    this.registerKeys("insert all to editor", async () => {
      this.close();
      const headers = this.chooser.values;
      if (!headers) {
        return;
      }

      const minLevel = minBy(headers, (x) => x.level).level;
      for (const x of headers) {
        this.appHelper.insertStringToActiveFile(
          `${" ".repeat((x.level - minLevel) * 4)}- ${x.value}\n`,
        );
      }
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

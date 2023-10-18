import { App, Pos, SuggestModal } from "obsidian";
import { Hotkeys, Settings } from "../settings";
import { AppHelper } from "../app-helper";
import {
  capitalizeFirstLetter,
  excludeFormat,
  smartIncludes,
  smartWhitespaceSplit,
} from "../utils/strings";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { createInstructions } from "../keys";
import { PREVIEW } from "./icons";
import { setFloatingModal } from "./modal";

interface SuggestionItem {
  value: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  position: Pos;
  hit: boolean;
  index: number;
}

export class HeaderModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface<SuggestionItem>
{
  items: SuggestionItem[];
  hitItems: SuggestionItem[] = [];
  appHelper: AppHelper;
  settings: Settings;
  floating: boolean;
  autoPreview: boolean;
  /** ⚠Not work correctly in all cases */
  unsafeSelectedIndex = 0;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  previewIcon: Element | null;

  constructor(app: App, settings: Settings, floating: boolean) {
    super(app);
    this.limit = 1000;

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.floating = floating;
    this.autoPreview = settings.autoPreviewInFloatingHeaderSearch && floating;

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

  select(index: number, evt?: KeyboardEvent) {
    this.chooser.setSelectedItem(index, evt);
    this.chooser.suggestions[index].scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });

    this.unsafeSelectedIndex = index;
    if (this.autoPreview) {
      this.appHelper.moveTo(this.items[this.unsafeSelectedIndex].position);
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
      (x) => x.position.start.offset > offset
    );

    if (firstOverIndex === -1) {
      this.select(this.items.last()!.index);
    } else if (firstOverIndex === 0) {
      this.select(0);
    } else {
      this.select(firstOverIndex - 1);
    }
  }

  refreshPreviewIcon() {
    this.previewIcon?.remove();
    if (this.autoPreview) {
      this.previewIcon = this.inputEl.insertAdjacentElement(
        "afterend",
        createDiv({ cls: "another-quick-switcher__header__auto-preview-icon" })
      );
      this.previewIcon?.insertAdjacentHTML("beforeend", PREVIEW);
    }
  }

  enableFloating() {
    this.floating = true;
    setFloatingModal(this.appHelper);
  }

  getSuggestions(query: string): SuggestionItem[] {
    const qs = smartWhitespaceSplit(query);

    const suggestions = this.items.map((x) => {
      const hit =
        qs.length > 0 &&
        qs.every((q) =>
          smartIncludes(x.value, q, this.settings.normalizeAccentsAndDiacritics)
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
        `another-quick-switcher__item__title__header`,
        item.hit
          ? `another-quick-switcher__item__title__header_hit`
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
    this.appHelper.moveTo(item.position);
  }

  private registerKeys(
    key: keyof Hotkeys["header"],
    handler: (evt: KeyboardEvent) => void | Promise<void>
  ) {
    this.settings.hotkeys.header[key]?.forEach((x) => {
      this.scope.register(x.modifiers, capitalizeFirstLetter(x.key), (evt) => {
        if (!evt.isComposing) {
          evt.preventDefault();
          handler(evt);
          return false;
        }
      });
    });
  }

  setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↵]", purpose: "move to header" },
        { command: `[↑]`, purpose: "up" },
        { command: `[↓]`, purpose: "down" },
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
        (x) => x.index >= this.unsafeSelectedIndex
      );
      const previousIndex =
        currentIndex === 0 ? this.hitItems.length - 1 : currentIndex - 1;
      this.select(this.hitItems[previousIndex].index, evt);
    };

    // Unregister default arrows behavior
    this.scope.keys
      .filter((x) => ["ArrowDown", "ArrowUp"].includes(x.key!))
      .forEach((x) => this.scope.unregister(x));
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

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

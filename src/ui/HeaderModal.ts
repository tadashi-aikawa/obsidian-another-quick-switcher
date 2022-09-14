import { App, Pos, SuggestModal } from "obsidian";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";
import { excludeFormat, smartIncludes } from "../utils/strings";
import { UnsafeModalInterface } from "./UnsafeModalInterface";
import { MOD } from "../keys";

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
  /** ⚠Not work correctly in all cases */
  unsafeSelectedIndex = 0;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  constructor(app: App, settings: Settings, floating: boolean) {
    super(app);
    this.limit = 1000;

    this.appHelper = new AppHelper(app);
    this.settings = settings;
    this.floating = floating;

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
        this.select(this.unsafeSelectedIndex, unsafeEvt, this.floating);
        return;
      }

      const nextIndex =
        this.hitItems.find((x) => x.index >= this.unsafeSelectedIndex)?.index ??
        this.hitItems[0].index;
      this.select(nextIndex, unsafeEvt, this.floating);
    });

    this.bindHotKeys();
  }

  select(index: number, evt?: KeyboardEvent, preview: boolean = true) {
    this.chooser.setSelectedItem(index, evt);
    this.chooser.suggestions[index].scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });

    this.unsafeSelectedIndex = index;
    if (preview) {
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
      activeWindow.activeDocument
        .querySelector(".modal-bg")
        ?.addClass("another-quick-switcher__header__floating-modal-bg");

      const promptEl = activeWindow.activeDocument.querySelector(".prompt");
      promptEl?.addClass("another-quick-switcher__header__floating-prompt");

      const markdownView = this.appHelper.getMarkdownViewInActiveLeaf();

      if (markdownView) {
        const windowWidth = activeWindow.innerWidth;
        const windowHeight = activeWindow.innerHeight;
        const modalWidth = this.modalEl.offsetWidth;
        const modalHeight = this.modalEl.offsetHeight;
        const {
          x: leafX,
          y: leafY,
          width: leafWidth,
        } = markdownView.containerEl.getBoundingClientRect();
        const { y: promptY } = promptEl!.getBoundingClientRect();

        const left = Math.min(
          windowWidth - modalWidth - 30,
          leafX + leafWidth / 1.5
        );
        const top = Math.min(windowHeight - modalHeight - 10, leafY + promptY);

        promptEl?.setAttribute("style", `left: ${left}px; top: ${top}px`);
      }
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

  getSuggestions(query: string): SuggestionItem[] {
    const qs = query.split(" ").filter((x) => x);

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

  bindHotKeys() {
    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        {
          command: "[↑↓]",
          purpose: this.settings.headerSearchKeyBindArrowUpDown,
        },
        {
          command: "[tab or shift tab]",
          purpose: this.settings.headerSearchKeyBindTab,
        },
        {
          command: `[${MOD} j or k]`,
          purpose: this.settings.headerSearchKeyBindVim,
        },
        {
          command: `[${MOD} n or p]`,
          purpose: this.settings.headerSearchKeyBindEmacs,
        },
        { command: `[${MOD} d]`, purpose: "clear input" },
        { command: "[↵]", purpose: "move to header" },
        { command: "[esc]", purpose: "dismiss" },
      ]);
    }

    this.scope.register(["Mod"], "D", () => {
      this.inputEl.value = "";
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
      return false;
    });

    this.scope.keys
      .filter((x) => ["ArrowDown", "ArrowUp"].includes(x.key!))
      .forEach((x) => this.scope.unregister(x));

    const navigateNext = (evt: KeyboardEvent) => {
      this.select(this.getNextSelectIndex(), evt, this.floating);
    };
    const navigatePrevious = (evt: KeyboardEvent) => {
      this.select(this.getPreviousSelectIndex(), evt, this.floating);
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
      this.select(nextIndex, evt, this.floating);
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
      this.select(this.hitItems[previousIndex].index, evt, this.floating);
    };

    this.scope.register([], "ArrowDown", (evt: KeyboardEvent) => {
      (this.settings.headerSearchKeyBindArrowUpDown === "navigate"
        ? navigateNext
        : moveToNextHit)(evt);
      return false;
    });
    this.scope.register([], "ArrowUp", (evt: KeyboardEvent) => {
      (this.settings.headerSearchKeyBindArrowUpDown === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)(evt);
      return false;
    });

    this.scope.register(["Mod"], "J", (evt: KeyboardEvent) => {
      (this.settings.headerSearchKeyBindVim === "navigate"
        ? navigateNext
        : moveToNextHit)(evt);
      return false;
    });
    this.scope.register(["Mod"], "K", (evt: KeyboardEvent) => {
      (this.settings.headerSearchKeyBindVim === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)(evt);
      return false;
    });

    this.scope.register(["Mod"], "N", (evt: KeyboardEvent) => {
      (this.settings.headerSearchKeyBindEmacs === "navigate"
        ? navigateNext
        : moveToNextHit)(evt);
      return false;
    });
    this.scope.register(["Mod"], "P", (evt: KeyboardEvent) => {
      (this.settings.headerSearchKeyBindEmacs === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)(evt);
      return false;
    });

    this.scope.register([], "Tab", (evt) => {
      evt.preventDefault();
      (this.settings.headerSearchKeyBindTab === "navigate"
        ? navigateNext
        : moveToNextHit)(evt);
      return false;
    });
    this.scope.register(["Shift"], "Tab", (evt) => {
      evt.preventDefault();
      (this.settings.headerSearchKeyBindTab === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)(evt);
      return false;
    });
  }
}

import { App, Pos, SuggestModal } from "obsidian";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";
import { excludeFormat, smartIncludes } from "../utils/strings";
import { UnsafeModalInterface } from "./UnsafeModalInterface";

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
  /** ⚠Not work correctly in all cases */
  unsafeSelectedIndex = 0;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  constructor(app: App, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    this.items = this.appHelper.getHeadersInActiveFile().map((x, i) => ({
      value: excludeFormat(x.heading),
      level: x.level as SuggestionItem["level"],
      position: x.position,
      hit: false,
      index: i,
    }));

    this.inputEl.addEventListener("input", () => {
      if (this.hitItems.length === 0) {
        this.select(this.unsafeSelectedIndex);
        return;
      }

      const nextIndex =
        this.hitItems.find((x) => x.index >= this.unsafeSelectedIndex)?.index ??
        this.hitItems[0].index;
      this.select(nextIndex);
    });

    this.bindHotKeys();
  }

  select(index: number) {
    this.chooser.setSelectedItem(index, true);
    this.unsafeSelectedIndex = index;
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

    const leaf = this.appHelper.getMarkdownViewInActiveLeaf();
    if (!leaf || this.items.length === 0) {
      return;
    }

    const mode = leaf.getMode();
    const offset =
      mode === "source"
        ? this.appHelper.getCurrentOffset()
        : leaf.editor.posToOffset({
            ch: 0,
            line: leaf.previewMode.getScroll(),
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
        command: "[ctrl/cmd j or k]",
        purpose: this.settings.headerSearchKeyBindVim,
      },
      {
        command: "[ctrl/cmd n or p]",
        purpose: this.settings.headerSearchKeyBindEmacs,
      },
      { command: "[ctrl/cmd d]", purpose: "clear input" },
      { command: "[↵]", purpose: "move to header" },
      { command: "[esc]", purpose: "dismiss" },
    ]);

    this.scope.register(["Mod"], "D", () => {
      this.inputEl.value = "";
      // Necessary to rerender suggestions
      this.inputEl.dispatchEvent(new Event("input"));
    });

    this.scope.keys
      .filter((x) => ["ArrowDown", "ArrowUp"].includes(x.key!))
      .forEach((x) => this.scope.unregister(x));

    const navigateNext = () => {
      this.select(this.getNextSelectIndex());
    };
    const navigatePrevious = () => {
      this.select(this.getPreviousSelectIndex());
    };
    const moveToNextHit = () => {
      if (this.hitItems.length === 1) {
        return;
      }
      if (this.hitItems.length === 0) {
        navigateNext();
        return;
      }

      const nextIndex =
        this.hitItems.find((x) => x.index > this.unsafeSelectedIndex)?.index ??
        this.hitItems[0].index;
      this.select(nextIndex);
    };
    const moveToPreviousHit = () => {
      if (this.hitItems.length === 1) {
        return;
      }
      if (this.hitItems.length === 0) {
        navigatePrevious();
        return;
      }

      const currentIndex = this.hitItems.findIndex(
        (x) => x.index >= this.unsafeSelectedIndex
      );
      const previousIndex =
        currentIndex === 0 ? this.hitItems.length - 1 : currentIndex - 1;
      this.select(this.hitItems[previousIndex].index);
    };

    this.scope.register([], "ArrowDown", () => {
      (this.settings.headerSearchKeyBindArrowUpDown === "navigate"
        ? navigateNext
        : moveToNextHit)();
    });
    this.scope.register([], "ArrowUp", () => {
      (this.settings.headerSearchKeyBindArrowUpDown === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)();
    });

    this.scope.register(["Mod"], "J", () => {
      (this.settings.headerSearchKeyBindVim === "navigate"
        ? navigateNext
        : moveToNextHit)();
    });
    this.scope.register(["Mod"], "K", () => {
      (this.settings.headerSearchKeyBindVim === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)();
    });

    this.scope.register(["Mod"], "N", () => {
      (this.settings.headerSearchKeyBindEmacs === "navigate"
        ? navigateNext
        : moveToNextHit)();
    });
    this.scope.register(["Mod"], "P", () => {
      (this.settings.headerSearchKeyBindEmacs === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)();
    });

    this.scope.register([], "Tab", (evt) => {
      evt.preventDefault();
      (this.settings.headerSearchKeyBindTab === "navigate"
        ? navigateNext
        : moveToNextHit)();
    });
    this.scope.register(["Shift"], "Tab", (evt) => {
      evt.preventDefault();
      (this.settings.headerSearchKeyBindTab === "navigate"
        ? navigatePrevious
        : moveToPreviousHit)();
    });
  }
}

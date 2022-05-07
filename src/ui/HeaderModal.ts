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
    if (this.items.length === 0) {
      return;
    }

    const offset = this.appHelper.getCurrentOffset();
    if (offset) {
      const firstOverIndex = this.items.findIndex(
        (x) => x.position.start.offset > offset
      );
      this.select(
        firstOverIndex > 0 ? firstOverIndex - 1 : this.items.last()!.index
      );
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
        command: "[↑↓][ctrl/cmd n or p][ctrl/cmd j or k]",
        purpose: "navigate",
      },
      { command: "[ctrl/cmd d]", purpose: "clear input" },
      { command: "[tab]", purpose: "move to next hit" },
      { command: "[shift tab]", purpose: "move to previous hit" },
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
    this.scope.register([], "ArrowDown", () => {
      this.select(this.getNextSelectIndex());
    });
    this.scope.register([], "ArrowUp", () => {
      this.select(this.getPreviousSelectIndex());
    });
    this.scope.register(["Mod"], "N", () => {
      this.select(this.getNextSelectIndex());
    });
    this.scope.register(["Mod"], "P", () => {
      this.select(this.getPreviousSelectIndex());
    });
    this.scope.register(["Mod"], "J", () => {
      this.select(this.getNextSelectIndex());
    });
    this.scope.register(["Mod"], "K", () => {
      this.select(this.getPreviousSelectIndex());
    });

    this.scope.register([], "Tab", (evt) => {
      evt.preventDefault();
      if (this.hitItems.length < 2) {
        return;
      }

      const nextIndex =
        this.hitItems.find((x) => x.index > this.chooser.selectedItem)?.index ??
        this.hitItems[0].index;
      this.select(nextIndex);
    });
    this.scope.register(["Shift"], "Tab", (evt) => {
      evt.preventDefault();
      if (this.hitItems.length < 2) {
        return;
      }

      const currentIndex = this.hitItems.findIndex(
        (x) => x.index >= this.chooser.selectedItem
      );
      const previousIndex =
        currentIndex === -1 ? this.hitItems.length - 1 : currentIndex - 1;
      this.select(this.hitItems[previousIndex].index);
    });
  }
}

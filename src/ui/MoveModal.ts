import { App, SuggestModal, TFolder } from "obsidian";
import { excludeItems, sorter } from "../utils/collection-helper";
import { FOLDER } from "./icons";
import { Hotkeys, Settings } from "../settings";
import { AppHelper } from "../app-helper";
import { smartIncludes, smartStartsWith } from "../utils/strings";
import { createInstructions } from "../keys";
import { UnsafeModalInterface } from "./UnsafeModalInterface";

interface SuggestionItem {
  folder: TFolder;
  matchType?: "name" | "prefix-name" | "directory";
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  matcher: (item: SuggestionItem, query: string) => boolean,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  const qs = query.split("/");
  const folder = qs.pop()!;
  return (
    qs.every((dir) =>
      smartIncludes(
        item.folder.parent?.path!,
        dir,
        isNormalizeAccentsDiacritics,
      ),
    ) && matcher(item, folder)
  );
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  matcher: (item: SuggestionItem, query: string) => boolean,
  isNormalizeAccentsDiacritics: boolean,
): boolean {
  return queries.every((q) =>
    matchQuery(item, q, matcher, isNormalizeAccentsDiacritics),
  );
}

function stampMatchType(
  item: SuggestionItem,
  queries: string[],
  isNormalizeAccentsDiacritics: boolean,
): SuggestionItem {
  if (
    matchQueryAll(
      item,
      queries,
      (item, query) =>
        smartStartsWith(item.folder.name, query, isNormalizeAccentsDiacritics),
      isNormalizeAccentsDiacritics,
    )
  ) {
    return { ...item, matchType: "prefix-name" };
  }

  if (
    matchQueryAll(
      item,
      queries,
      (item, query) =>
        smartIncludes(item.folder.name, query, isNormalizeAccentsDiacritics),
      isNormalizeAccentsDiacritics,
    )
  ) {
    return { ...item, matchType: "name" };
  }

  if (
    matchQueryAll(
      item,
      queries,
      (item, query) =>
        smartIncludes(item.folder.path, query, isNormalizeAccentsDiacritics),
      isNormalizeAccentsDiacritics,
    )
  ) {
    return { ...item, matchType: "directory" };
  }

  return item;
}

export class MoveModal extends SuggestModal<SuggestionItem> {
  originItems: SuggestionItem[];
  filteredItems: SuggestionItem[];
  appHelper: AppHelper;
  settings: Settings;

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  constructor(app: App, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    this.setHotkeys();

    this.originItems = this.appHelper
      .getFolders()
      .filter((x) => !x.isRoot())
      .map((x) => ({
        folder: x,
      }));

    this.filteredItems = excludeItems(
      this.originItems,
      this.settings.moveFileExcludePrefixPathPatterns,
      (x) => x.folder.path,
    );
  }

  getSuggestions(query: string): SuggestionItem[] {
    const qs = query.split(" ").filter((x) => x);

    return this.filteredItems
      .map((x) =>
        stampMatchType(x, qs, this.settings.normalizeAccentsAndDiacritics),
      )
      .filter((x) => x.matchType)
      .sort(sorter((x) => (x.matchType === "directory" ? 1 : 0)))
      .sort(
        sorter(
          (x) =>
            x.matchType === "prefix-name" ? 1000 - x.folder.name.length : 0,
          "desc",
        ),
      )
      .slice(0, 10);
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const itemDiv = createDiv({
      cls: [
        "another-quick-switcher__item",
        "another-quick-switcher__directory_item",
      ],
    });

    const entryDiv = createDiv({
      cls: "another-quick-switcher__item__entry",
    });

    const folderDiv = createDiv({
      cls: "another-quick-switcher__item__title",
      text: item.folder.name,
    });
    entryDiv.appendChild(folderDiv);

    const directoryDiv = createDiv({
      cls: "another-quick-switcher__item__directory",
    });
    directoryDiv.insertAdjacentHTML("beforeend", FOLDER);
    directoryDiv.appendText(` ${item.folder.parent?.name}`);
    entryDiv.appendChild(directoryDiv);

    itemDiv.appendChild(entryDiv);

    el.appendChild(itemDiv);
  }

  async onChooseSuggestion(item: SuggestionItem): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return;
    }

    await this.app.fileManager.renameFile(
      activeFile,
      `${item.folder.path}/${activeFile.name}`,
    );
  }

  private registerKeys(
    key: keyof Hotkeys["move"],
    handler: () => void | Promise<void>,
  ) {
    this.settings.hotkeys.move[key]?.forEach((x) => {
      this.scope.register(x.modifiers, x.key.toUpperCase(), (evt) => {
        evt.preventDefault();
        handler();
        return false;
      });
    });
  }

  private setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↵]", purpose: "move to" },
        { command: `[↑]`, purpose: "up" },
        { command: `[↓]`, purpose: "down" },
        ...createInstructions(this.settings.hotkeys.move),
      ]);
    }

    this.registerKeys("up", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.registerKeys("down", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
    });

    this.registerKeys("open in default app", () => {
      const folder = this.chooser.values?.[this.chooser.selectedItem]?.folder;
      if (!folder) {
        return;
      }

      this.appHelper.openFolderInDefaultApp(folder);
      this.close();
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

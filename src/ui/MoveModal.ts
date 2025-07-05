import moment from "moment";
import { type App, Notice, SuggestModal, type TFolder } from "obsidian";
import { AppHelper } from "../app-helper";
import { createInstructions } from "../keys";
import type { Hotkeys, MoveFolderSortPriority, Settings } from "../settings";
import { excludeItems, sorter } from "../utils/collection-helper";
import { smartIncludes, smartStartsWith } from "../utils/strings";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";

interface SuggestionItem {
  folder: TFolder;
  matchType?: "name" | "prefix-name" | "directory";
  isRecentlyUsed?: boolean;
  recentlyUsedIndex?: number;
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

function stampRecentlyUsed(
  item: SuggestionItem,
  recentFolders: string[],
): SuggestionItem {
  const index = recentFolders.indexOf(item.folder.path);
  if (index !== -1) {
    return {
      ...item,
      isRecentlyUsed: true,
      recentlyUsedIndex: index,
    };
  }
  return item;
}

function sortFolders(
  items: SuggestionItem[],
  priority: MoveFolderSortPriority,
): SuggestionItem[] {
  return items.sort((a, b) => {
    switch (priority) {
      case "Recently used": {
        const aIndex = a.recentlyUsedIndex ?? 999999;
        const bIndex = b.recentlyUsedIndex ?? 999999;
        return aIndex - bIndex;
      }
      case "Alphabetical":
        return a.folder.name.localeCompare(b.folder.name);
      case "Alphabetical reverse":
        return b.folder.name.localeCompare(a.folder.name);
      default:
        return 0;
    }
  });
}

export class MoveModal extends SuggestModal<SuggestionItem> {
  originItems: SuggestionItem[];
  filteredItems: SuggestionItem[];
  appHelper: AppHelper;
  settings: Settings;
  recentFolders: string[] = [];

  chooser: UnsafeModalInterface<SuggestionItem>["chooser"];
  scope: UnsafeModalInterface<SuggestionItem>["scope"];

  constructor(app: App, settings: Settings) {
    super(app);
    this.modalEl.addClass("another-quick-switcher__modal-prompt");

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

  async onOpen(): Promise<void> {
    await this.loadRecentlyUsedFolders();
    super.onOpen();
  }

  private getRecentlyUsedFilePath(): string {
    return (
      this.settings.moveFileRecentlyUsedFilePath ||
      ".obsidian/plugins/obsidian-another-quick-switcher/recently-used-folders.json"
    );
  }

  private async loadRecentlyUsedFolders(): Promise<void> {
    const filePath = this.getRecentlyUsedFilePath();
    try {
      if (await this.app.vault.adapter.exists(filePath)) {
        const content = await this.app.vault.adapter.read(filePath);
        this.recentFolders = JSON.parse(content);
      }
    } catch (error) {
      console.warn("Failed to load recently used folders:", error);
      this.recentFolders = [];
    }
  }

  private async saveRecentlyUsedFolders(): Promise<void> {
    const filePath = this.getRecentlyUsedFilePath();
    try {
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }

      await this.app.vault.adapter.write(
        filePath,
        JSON.stringify(this.recentFolders, null, 2),
      );
    } catch (error) {
      console.warn("Failed to save recently used folders:", error);
    }
  }

  private async updateRecentlyUsedFolder(folderPath: string): Promise<void> {
    const index = this.recentFolders.indexOf(folderPath);
    if (index > -1) {
      this.recentFolders.splice(index, 1);
    }
    this.recentFolders.unshift(folderPath);

    if (
      this.recentFolders.length > this.settings.moveFileMaxRecentlyUsedFolders
    ) {
      this.recentFolders.pop();
    }

    await this.saveRecentlyUsedFolders();
  }

  getSuggestions(query: string): SuggestionItem[] {
    const qs = query.split(" ").filter((x) => x);

    const matchedItems = this.filteredItems
      .map((x) =>
        stampMatchType(x, qs, this.settings.normalizeAccentsAndDiacritics),
      )
      .filter((x) => x.matchType)
      .map((x) => stampRecentlyUsed(x, this.recentFolders));

    // Apply sorting using the configured priority
    const sortedItems = sortFolders(
      matchedItems,
      this.settings.moveFolderSortPriority,
    );

    return sortedItems.slice(0, 10);
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

    let newPath = `${item.folder.path}/${activeFile.name}`;
    if (await this.appHelper.exists(newPath)) {
      const newName = `${activeFile.basename}.${moment().format("YYYYMMDD_HHmmss_SSS")}.${activeFile.extension}`;
      newPath = `${item.folder.path}/${newName}`;
      new Notice(
        `Since a file with the same name already exists in the destination directory, it will be moved and renamed ${newName}`,
      );
    }

    await this.app.fileManager.renameFile(activeFile, newPath);
    await this.updateRecentlyUsedFolder(item.folder.path);
  }

  private registerKeys(
    key: keyof Hotkeys["move"],
    handler: () => void | Promise<void>,
  ) {
    for (const x of this.settings.hotkeys.move[key] ?? []) {
      this.scope.register(x.modifiers, x.key.toUpperCase(), (evt) => {
        evt.preventDefault();
        handler();
        return false;
      });
    }
  }

  private setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↵]", purpose: "move to" },
        { command: "[↑]", purpose: "up" },
        { command: "[↓]", purpose: "down" },
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

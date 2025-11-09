import { type App, Notice, SuggestModal, type TFolder } from "obsidian";
import { AppHelper } from "../app-helper";
import { createInstructions } from "../keys";
import type { Hotkeys, MoveFolderSortPriority, Settings } from "../settings";
import { excludeItems } from "../utils/collection-helper";
import { smartIncludes, smartMicroFuzzy } from "../utils/strings";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";
import { FOLDER } from "./icons";

/**
 * Merges overlapping or adjacent ranges into consolidated ranges.
 */
function mergeRanges(
  ranges: { start: number; end: number }[],
): { start: number; end: number }[] {
  if (ranges.length === 0) return [];

  // Sort ranges by start position
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if ranges overlap or are adjacent
    if (next.start <= current.end + 1) {
      // Merge ranges
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
      };
    } else {
      // No overlap, push current and move to next
      merged.push(current);
      current = next;
    }
  }

  // Push the last range
  merged.push(current);
  return merged;
}

/**
 * Creates text content with highlighted portions based on given ranges.
 * Returns DocumentFragment containing text nodes and highlighted spans.
 */
function createHighlightedText(
  text: string,
  ranges?: { start: number; end: number }[],
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (!ranges || ranges.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Merge overlapping ranges to avoid duplicate highlighting
  const mergedRanges = mergeRanges(ranges);

  let lastEnd = -1;

  for (const range of mergedRanges) {
    // Add text before this range
    if (range.start > lastEnd + 1) {
      const beforeText = text.slice(lastEnd + 1, range.start);
      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }
    }

    // Add highlighted text
    const highlightedText = text.slice(range.start, range.end + 1);
    if (highlightedText) {
      const highlightSpan = createSpan({
        cls: "another-quick-switcher__hit_word",
        text: highlightedText,
      });
      fragment.appendChild(highlightSpan);
    }

    lastEnd = range.end;
  }

  // Add remaining text after last range
  if (lastEnd + 1 < text.length) {
    const remainingText = text.slice(lastEnd + 1);
    if (remainingText) {
      fragment.appendChild(document.createTextNode(remainingText));
    }
  }

  return fragment;
}

interface SuggestionItem {
  folder: TFolder;
  matchType?: "name" | "prefix-name" | "directory" | "fuzzy-name";
  isRecentlyUsed?: boolean;
  recentlyUsedIndex?: number;
  score?: number;
  ranges?: { start: number; end: number }[];
  directoryRanges?: { start: number; end: number }[];
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
  // Check fuzzy match against folder name
  const combinedQuery = queries.join(" ");
  const fuzzyResult = smartMicroFuzzy(
    item.folder.name,
    combinedQuery,
    isNormalizeAccentsDiacritics,
  );

  switch (fuzzyResult.type) {
    case "starts-with":
      return {
        ...item,
        matchType: "prefix-name",
        score: fuzzyResult.score,
        ranges: fuzzyResult.ranges,
      };
    case "includes":
      return {
        ...item,
        matchType: "name",
        score: fuzzyResult.score,
        ranges: fuzzyResult.ranges,
      };
    case "fuzzy":
      return {
        ...item,
        matchType: "fuzzy-name",
        score: fuzzyResult.score,
        ranges: fuzzyResult.ranges,
      };
  }

  // Check directory path match
  if (
    matchQueryAll(
      item,
      queries,
      (item, query) =>
        smartIncludes(item.folder.path, query, isNormalizeAccentsDiacritics),
      isNormalizeAccentsDiacritics,
    )
  ) {
    // Calculate ranges for directory highlighting
    const parentName = item.folder.parent?.name || "";
    const directoryFuzzyResult = smartMicroFuzzy(
      parentName,
      combinedQuery,
      isNormalizeAccentsDiacritics,
    );

    return {
      ...item,
      matchType: "directory",
      directoryRanges: directoryFuzzyResult.ranges,
    };
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
    });

    // Apply highlighting using DocumentFragment
    const highlightedContent = createHighlightedText(
      item.folder.name,
      item.ranges,
    );
    folderDiv.appendChild(highlightedContent);

    entryDiv.appendChild(folderDiv);

    const directoryDiv = createDiv({
      cls: "another-quick-switcher__item__directory",
    });
    directoryDiv.insertAdjacentHTML("beforeend", FOLDER);

    // Apply highlighting to directory name if it's a directory match
    const parentName = item.folder.parent?.name || "";
    if (item.matchType === "directory" && item.directoryRanges) {
      directoryDiv.appendText(" ");
      const directoryHighlightedContent = createHighlightedText(
        parentName,
        item.directoryRanges,
      );
      directoryDiv.appendChild(directoryHighlightedContent);
    } else {
      directoryDiv.appendText(` ${parentName}`);
    }

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
      const newName = `${activeFile.basename}.${window.moment().format("YYYYMMDD_HHmmss_SSS")}.${activeFile.extension}`;
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

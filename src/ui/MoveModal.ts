import { App, SuggestModal, TFolder } from "obsidian";
import { excludeItems, sorter } from "../utils/collection-helper";
import { FOLDER } from "./icons";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";
import { smartIncludes, smartStartsWith } from "../utils/strings";

interface SuggestionItem {
  folder: TFolder;
  matchType?: "name" | "prefix-name" | "directory";
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  matcher: (item: SuggestionItem, query: string) => boolean,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  const qs = query.split("/");
  const folder = qs.pop()!;
  return (
    qs.every((dir) =>
      smartIncludes(item.folder.parent.path, dir, isNormalizeAccentsDiacritics)
    ) && matcher(item, folder)
  );
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  matcher: (item: SuggestionItem, query: string) => boolean,
  isNormalizeAccentsDiacritics: boolean
): boolean {
  return queries.every((q) =>
    matchQuery(item, q, matcher, isNormalizeAccentsDiacritics)
  );
}

function stampMatchType(
  item: SuggestionItem,
  queries: string[],
  isNormalizeAccentsDiacritics: boolean
): SuggestionItem {
  if (
    matchQueryAll(
      item,
      queries,
      (item, query) =>
        smartStartsWith(item.folder.name, query, isNormalizeAccentsDiacritics),
      isNormalizeAccentsDiacritics
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
      isNormalizeAccentsDiacritics
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
      isNormalizeAccentsDiacritics
    )
  ) {
    return { ...item, matchType: "directory" };
  }

  return item;
}

export class MoveModal extends SuggestModal<SuggestionItem> {
  originItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  settings: Settings;

  constructor(app: App, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↑↓]", purpose: "navigate" },
        { command: "[↵]", purpose: "move to" },
        { command: "[esc]", purpose: "dismiss" },
      ]);
    }

    this.originItems = this.appHelper
      .getFolders()
      .filter((x) => !x.isRoot())
      .map((x) => ({
        folder: x,
      }));

    this.ignoredItems = excludeItems(
      this.originItems,
      this.settings.ignoreMoveFileToAnotherFolderPrefixPatterns.split("\n"),
      (x) => x.folder.path
    );
  }

  getSuggestions(query: string): SuggestionItem[] {
    const qs = query.split(" ").filter((x) => x);

    return this.ignoredItems
      .map((x) =>
        stampMatchType(x, qs, this.settings.normalizeAccentsAndDiacritics)
      )
      .filter((x) => x.matchType)
      .sort(sorter((x) => (x.matchType === "directory" ? 1 : 0)))
      .sort(
        sorter(
          (x) =>
            x.matchType === "prefix-name" ? 1000 - x.folder.name.length : 0,
          "desc"
        )
      )
      .slice(0, 10);
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const itemDiv = createDiv({
      cls: "another-quick-switcher__item",
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
    directoryDiv.appendText(` ${item.folder.parent.name}`);
    entryDiv.appendChild(directoryDiv);

    const prefixIcon = createSpan({
      cls: "another-quick-switcher__item__icon",
    });
    prefixIcon.insertAdjacentHTML("beforeend", FOLDER);
    itemDiv.appendChild(prefixIcon);

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
      `${item.folder.path}/${activeFile.name}`
    );
  }
}

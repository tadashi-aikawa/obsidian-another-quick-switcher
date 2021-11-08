import {
  App,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  SuggestModal,
  TFile,
} from "obsidian";
import { sorter, uniq } from "../utils/collection-helper";
import { ALIAS, FOLDER } from "./icons";
import { smartIncludes, smartStartsWith } from "../utils/strings";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";

export type Mode = "normal" | "recent" | "backlink";

interface SuggestionItem {
  file: TFile;
  tags: string[];
  aliases: string[];
  matchType?: "name" | "prefix-name" | "directory" | "alias";
  phantom: boolean;
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  matcher: (item: SuggestionItem, query: string) => boolean
): boolean {
  if (query.startsWith("#")) {
    // XXX: Don't use matcher...
    return item.tags.some((tag) => smartIncludes(tag.slice(1), query.slice(1)));
  }

  const qs = query.split("/");
  const file = qs.pop();
  return (
    qs.every((dir) => smartIncludes(item.file.parent.path, dir)) &&
    matcher(item, file)
  );
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  matcher: (item: SuggestionItem, query: string) => boolean
): boolean {
  return queries.every((q) => matchQuery(item, q, matcher));
}

function stampMatchType(
  item: SuggestionItem,
  queries: string[]
): SuggestionItem {
  if (
    matchQueryAll(item, queries, (item, query) =>
      smartStartsWith(item.file.name, query)
    )
  ) {
    return { ...item, matchType: "prefix-name" };
  }

  if (
    matchQueryAll(item, queries, (item, query) =>
      smartIncludes(item.file.name, query)
    )
  ) {
    return { ...item, matchType: "name" };
  }

  if (
    matchQueryAll(item, queries, (item, query) =>
      smartIncludes(item.file.path, query)
    )
  ) {
    return { ...item, matchType: "directory" };
  }

  if (
    matchQueryAll(item, queries, (item, query) =>
      item.aliases.some((al) => smartIncludes(al, query))
    )
  ) {
    return { ...item, matchType: "alias" };
  }

  return item;
}

function toPrefixIconHTML(item: SuggestionItem): HTMLSpanElement {
  const el = createSpan({ cls: "another-quick-switcher__item__icon" });
  switch (item.matchType) {
    case "alias":
      el.insertAdjacentHTML("beforeend", ALIAS);
      break;
    default:
    // do nothing
  }
  return el;
}

// This is an unsafe code..!! However, it might be a public interface because lishid commented it as a better way on PR :)
// https://github.com/obsidianmd/obsidian-releases/pull/520#issuecomment-944846642
interface UnsafeModalInterface {
  chooser: {
    selectedItem: number;
    setSelectedItem(item: number): void;
    useSelectedItem(ev: Partial<KeyboardEvent>): void;
  };
}

export class AnotherQuickSwitcherModal
  extends SuggestModal<SuggestionItem>
  implements UnsafeModalInterface
{
  originItems: SuggestionItem[];
  ignoredItems: SuggestionItem[];
  appHelper: AppHelper;
  mode: Mode;
  settings: Settings;
  searchQuery: string;

  chooser: UnsafeModalInterface["chooser"];

  constructor(app: App, public initialMode: Mode, settings: Settings) {
    super(app);

    this.appHelper = new AppHelper(app);
    this.settings = settings;

    this.setInstructions([
      { command: "[↑↓]", purpose: "navigate" },
      { command: "[↵]", purpose: "open" },
      { command: "[ctrl/cmd ↵]", purpose: "open in new pane" },
      { command: "[shift ↵]", purpose: "create" },
      { command: "[ctrl/cmd shift ↵]", purpose: "create in new pane" },
      { command: "[alt ↵]", purpose: "insert to editor" },
      { command: "[esc]", purpose: "dismiss" },
    ]);
    this.scope.register(["Mod"], "Enter", () =>
      this.chooser.useSelectedItem({ metaKey: true })
    );
    this.scope.register(["Alt"], "Enter", () =>
      this.chooser.useSelectedItem({ altKey: true })
    );
    this.scope.register(["Shift"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, false);
      }
    });
    this.scope.register(["Shift", "Mod"], "Enter", () => {
      if (this.searchQuery) {
        this.handleCreateNew(this.searchQuery, true);
      }
    });
    this.scope.register(["Mod"], "N", () => {
      this.chooser.setSelectedItem(this.chooser.selectedItem + 1);
    });
    this.scope.register(["Mod"], "P", () => {
      this.chooser.setSelectedItem(this.chooser.selectedItem - 1);
    });

    const phantomItems: SuggestionItem[] = this.appHelper
      .searchPhantomFiles()
      .map((x) => ({
        file: x,
        aliases: [],
        tags: [],
        phantom: true,
      }));

    const activeFilePath = app.workspace.getActiveFile()?.path;
    const markdownItems = app.vault
      .getMarkdownFiles()
      .filter((x) => x.path !== activeFilePath)
      .map((x) => {
        const cache = app.metadataCache.getFileCache(x);
        return {
          file: x,
          aliases: parseFrontMatterAliases(cache.frontmatter) ?? [],
          tags: uniq([
            ...(cache.tags ?? []).map((x) => x.tag),
            ...(parseFrontMatterTags(cache.frontmatter) ?? []),
          ]),
          phantom: false,
        };
      });

    this.originItems = [...markdownItems, ...phantomItems];
    this.ignoredItems = this.ignoreItems(initialMode);
  }

  async handleCreateNew(searchQuery: string, newLeaf: boolean) {
    const file = await this.appHelper.createMarkdown(this.searchQuery);
    if (!file) {
      // noinspection ObjectAllocationIgnored
      new Notice("This file already exists.");
      return;
    }

    this.appHelper.openMarkdownFile(file, newLeaf);
    this.close();
  }

  ignoreItems(mode: Mode): SuggestionItem[] {
    const ignoreItems = (pattern: string): SuggestionItem[] =>
      pattern
        ? this.originItems.filter(
            (x) => !x.file.path.match(new RegExp(pattern))
          )
        : this.originItems;

    switch (mode) {
      case "normal":
        return ignoreItems(this.settings.ignoreNormalPathPattern);
      case "recent":
        return ignoreItems(this.settings.ignoreRecentPathPattern);
      case "backlink":
        return ignoreItems(this.settings.ignoreBackLinkPathPattern);
    }
  }

  getSuggestions(query: string): SuggestionItem[] {
    let lastOpenFileIndexByPath: { [path: string]: number } = {};
    this.app.workspace.getLastOpenFiles().forEach((v, i) => {
      lastOpenFileIndexByPath[v] = i;
    });

    let searchQuery = query;
    const changeMode = (mode: Mode, slice: number = 0) => {
      if (this.mode !== mode) {
        this.ignoredItems = this.ignoreItems(mode);
      }
      this.mode = mode;
      searchQuery = query.slice(slice);
    };
    // noinspection IfStatementWithTooManyBranchesJS
    if (query.startsWith(":n ")) {
      changeMode("normal", 3);
    } else if (query.startsWith(":r ")) {
      changeMode("recent", 3);
    } else if (query.startsWith(":b ")) {
      changeMode("backlink", 3);
    } else {
      changeMode(this.initialMode);
    }

    this.searchQuery = searchQuery;

    const qs = searchQuery.split(" ").filter((x) => x);

    if (this.mode === "backlink") {
      // ✨ If I can use MetadataCache.getBacklinksForFile, I would like to use it instead of original createBacklinksMap :)
      const backlinksMap = this.appHelper.createBacklinksMap();

      const activeFilePath = this.app.workspace.getActiveFile()?.path;
      return this.ignoredItems
        .filter((x) => backlinksMap[activeFilePath]?.has(x.file.path))
        .map((x) => stampMatchType(x, qs))
        .filter((x) => x.matchType);
    }

    if (!query) {
      return this.ignoredItems
        .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535))
        .slice(0, 10);
    }

    let suggestions = this.ignoredItems
      .map((x) => stampMatchType(x, qs))
      .filter((x) => x.matchType)
      .sort(sorter((x) => x.file.stat.mtime, "desc"))
      .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535));

    if (this.mode === "normal") {
      suggestions = suggestions
        .sort(sorter((x) => (x.matchType === "directory" ? 1 : 0)))
        .sort(
          sorter(
            (x) =>
              x.matchType === "prefix-name" ? 1000 - x.file.name.length : 0,
            "desc"
          )
        );
    }

    return suggestions.slice(0, 10);
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement) {
    const itemDiv = createDiv({
      cls: [
        "another-quick-switcher__item",
        item.phantom ? "another-quick-switcher__phantom_item" : "",
      ],
    });

    const entryDiv = createDiv({
      cls: "another-quick-switcher__item__entry",
    });

    const fileDiv = createDiv({
      cls: "another-quick-switcher__item__file",
      text: item.file.basename,
    });
    entryDiv.appendChild(fileDiv);

    if (this.settings.showDirectory) {
      const directoryDiv = createDiv({
        cls: "another-quick-switcher__item__directory",
      });
      directoryDiv.insertAdjacentHTML("beforeend", FOLDER);
      directoryDiv.appendText(` ${item.file.parent.name}`);
      entryDiv.appendChild(directoryDiv);
    }

    itemDiv.appendChild(toPrefixIconHTML(item));
    itemDiv.appendChild(entryDiv);

    el.appendChild(itemDiv);

    if (this.settings.showTags) {
      const tagsDiv = createDiv({
        cls: "another-quick-switcher__item__tags",
      });
      item.tags.forEach((tag) => {
        const labelSpan = createSpan({
          cls: "another-quick-switcher__item__tag",
        });
        labelSpan.appendText(tag);
        tagsDiv.appendChild(labelSpan);
      });

      el.appendChild(tagsDiv);
    }
  }

  async onChooseSuggestion(
    item: SuggestionItem,
    evt: MouseEvent | KeyboardEvent
  ): Promise<void> {
    let fileToOpened = item.file;
    if (evt.altKey) {
      this.appHelper.insertLinkToActiveFileBy(fileToOpened);
      return;
    }

    if (item.phantom) {
      fileToOpened = await this.app.vault.create(item.file.path, "");
    }

    const offset =
      this.mode === "backlink"
        ? this.appHelper.findFirstLinkOffset(
            item.file,
            this.app.workspace.getActiveFile()
          )
        : undefined;

    this.appHelper.openMarkdownFile(
      fileToOpened,
      evt.ctrlKey || evt.metaKey,
      offset
    );
  }
}

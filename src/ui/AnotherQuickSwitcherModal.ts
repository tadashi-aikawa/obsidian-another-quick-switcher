import {
  App,
  Notice,
  parseFrontMatterAliases,
  parseFrontMatterTags,
  SuggestModal,
  TFile,
} from "obsidian";
import {
  ignoreItems,
  minBy,
  sorter,
  uniq,
  uniqFlatMap,
} from "../utils/collection-helper";
import { ALIAS, FOLDER, TAG } from "./icons";
import { smartIncludes, smartStartsWith } from "../utils/strings";
import { Settings } from "../settings";
import { AppHelper } from "../app-helper";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

export type Mode = "normal" | "recent" | "backlink";
type MatchType = "not found" | "name" | "prefix-name" | "directory" | "tag";

interface SuggestionItem {
  file: TFile;
  tags: string[];
  aliases: string[];
  matchResults: MatchQueryResult[];
  phantom: boolean;
}

interface MatchQueryResult {
  type: MatchType;
  alias?: string;
  hitWord?: string;
  meta?: string[];
}

function matchQuery(
  item: SuggestionItem,
  query: string,
  isNormalizeAccentsDiacritics: boolean
): MatchQueryResult {
  // tag
  if (query.startsWith("#")) {
    const tags = item.tags.filter((tag) =>
      smartIncludes(tag.slice(1), query.slice(1), isNormalizeAccentsDiacritics)
    );
    return {
      type: tags.length > 0 ? "tag" : "not found",
      meta: tags,
    };
  }

  const qs = query.split("/");
  const file = qs.pop();
  const includeDir = qs.every((dir) =>
    smartIncludes(item.file.parent.path, dir, isNormalizeAccentsDiacritics)
  );
  if (!includeDir) {
    return { type: "not found" };
  }

  if (smartStartsWith(item.file.name, file, isNormalizeAccentsDiacritics)) {
    return { type: "prefix-name", meta: [item.file.name] };
  }
  const prefixNameMatchedAliases = item.aliases.filter((x) =>
    smartStartsWith(x, file, isNormalizeAccentsDiacritics)
  );
  if (prefixNameMatchedAliases.length > 0) {
    return {
      type: "prefix-name",
      meta: prefixNameMatchedAliases,
      alias: minBy(prefixNameMatchedAliases, (x) => x.length),
    };
  }

  if (smartIncludes(item.file.name, file, isNormalizeAccentsDiacritics)) {
    return { type: "name", meta: [item.file.name] };
  }
  const nameMatchedAliases = item.aliases.filter((x) =>
    smartIncludes(x, file, isNormalizeAccentsDiacritics)
  );
  if (nameMatchedAliases.length > 0) {
    return {
      type: "name",
      meta: nameMatchedAliases,
      alias: minBy(nameMatchedAliases, (x) => x.length),
    };
  }

  if (smartIncludes(item.file.path, file, isNormalizeAccentsDiacritics)) {
    return { type: "directory", meta: [item.file.path] };
  }

  return { type: "not found" };
}

function matchQueryAll(
  item: SuggestionItem,
  queries: string[],
  isNormalizeAccentsDiacritics: boolean
): MatchQueryResult[] {
  return queries.map((q) => matchQuery(item, q, isNormalizeAccentsDiacritics));
}

function stampMatchResults(
  item: SuggestionItem,
  queries: string[],
  isNormalizeAccentsDiacritics: boolean
): SuggestionItem {
  return {
    ...item,
    matchResults: matchQueryAll(item, queries, isNormalizeAccentsDiacritics),
  };
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
      {
        command: "[↑↓][ctrl/cmd n or p][ctrl/cmd j or k]",
        purpose: "navigate",
      },
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
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
      );
    });
    this.scope.register(["Mod"], "P", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.scope.register(["Mod"], "J", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
      );
    });
    this.scope.register(["Mod"], "K", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });

    const phantomItems = this.settings.showExistingFilesOnly
      ? []
      : this.appHelper.searchPhantomFiles().map((x) => ({
          file: x,
          aliases: [],
          tags: [],
          phantom: true,
          matchResults: [],
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
          matchResults: [],
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
    const _ignoreItems = (patterns: string): SuggestionItem[] =>
      ignoreItems(this.originItems, patterns, (x) => x.file.path);

    switch (mode) {
      case "normal":
        return _ignoreItems(this.settings.ignoreNormalPathPrefixPatterns);
      case "recent":
        return _ignoreItems(this.settings.ignoreRecentPathPrefixPatterns);
      case "backlink":
        return _ignoreItems(this.settings.ignoreBackLinkPathPrefixPatterns);
    }
  }

  getSuggestions(query: string): SuggestionItem[] {
    const start = performance.now();

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
      const items = this.ignoredItems
        .filter((x) => backlinksMap[activeFilePath]?.has(x.file.path))
        .map((x) =>
          stampMatchResults(x, qs, this.settings.normalizeAccentsAndDiacritics)
        )
        .filter((x) => x.matchResults.every((x) => x.type !== "not found"))
        .slice(0, this.settings.maxNumberOfSuggestions);
      this.showDebugLog(() =>
        buildLogMessage(`Get suggestions: ${query}`, performance.now() - start)
      );
      return items;
    }

    if (!query) {
      return this.ignoredItems
        .sort(sorter((x) => x.file.stat.mtime, "desc"))
        .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535))
        .slice(0, this.settings.maxNumberOfSuggestions);
    }

    let suggestions = this.ignoredItems
      .map((x) =>
        stampMatchResults(x, qs, this.settings.normalizeAccentsAndDiacritics)
      )
      .filter((x) => x.matchResults.every((x) => x.type !== "not found"))
      .sort(sorter((x) => x.file.stat.mtime, "desc"))
      .sort(sorter((x) => lastOpenFileIndexByPath[x.file.path] ?? 65535));

    if (this.mode === "normal") {
      suggestions = suggestions
        .sort(
          sorter((x) =>
            x.matchResults.some(
              (x) => x.type === "prefix-name" || x.type === "name"
            )
              ? 0
              : 1
          )
        )
        .sort(
          sorter((x) => {
            const firstPrefixMatch = x.matchResults.find(
              (x) => x.type === "prefix-name"
            );
            if (firstPrefixMatch) {
              return (
                1000 -
                (firstPrefixMatch.alias
                  ? firstPrefixMatch.alias.length
                  : x.file.name.length)
              );
            }
            return 0;
          }, "desc")
        );
    }

    const items = suggestions.slice(0, this.settings.maxNumberOfSuggestions);

    this.showDebugLog(() =>
      buildLogMessage(`Get suggestions: ${query}`, performance.now() - start)
    );
    return items;
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

    itemDiv.appendChild(entryDiv);

    el.appendChild(itemDiv);

    // reasons..
    const aliases = item.matchResults.filter((res) => res.alias);
    const tags = item.matchResults.filter((res) => res.type === "tag");

    if (aliases.length === 0 && tags.length === 0) {
      return;
    }

    const reasonsDiv = createDiv({
      cls: "another-quick-switcher__item__reasons",
    });
    el.appendChild(reasonsDiv);

    if (aliases.length > 0) {
      const aliasDiv = createDiv({
        cls: "another-quick-switcher__item__reason",
      });
      uniqFlatMap(aliases, (x) => x.meta).forEach((x) => {
        const aliasSpan = createSpan({
          cls: "another-quick-switcher__item__reason__alias",
        });
        aliasSpan.insertAdjacentHTML("beforeend", ALIAS);
        aliasSpan.appendText(x);
        aliasDiv.appendChild(aliasSpan);
      });
      reasonsDiv.appendChild(aliasDiv);
    }

    if (tags.length > 0) {
      const tagsDiv = createDiv({
        cls: "another-quick-switcher__item__reason",
      });
      uniqFlatMap(tags, (x) => x.meta).forEach((x) => {
        const tagsSpan = createSpan({
          cls: "another-quick-switcher__item__reason__tag",
        });
        tagsSpan.insertAdjacentHTML("beforeend", TAG);
        tagsSpan.appendText(x.replace("#", ""));
        tagsDiv.appendChild(tagsSpan);
      });
      reasonsDiv.appendChild(tagsDiv);
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

  private showDebugLog(toMessage: () => string) {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(toMessage());
    }
  }
}

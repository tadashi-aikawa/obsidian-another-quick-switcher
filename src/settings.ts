import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import { type Hotkey, hotkey2String, string2Hotkey } from "./keys";
import type AnotherQuickSwitcher from "./main";
import { type SortPriority, regardAsSortPriority } from "./sorters";
import { mirror } from "./utils/collection-helper";
import { smartCommaSplit, smartLineBreakSplit } from "./utils/strings";

const searchTargetList = [
  "file",
  "opened file",
  "backlink",
  "link",
  "2-hop-link",
] as const;
export type SearchTarget = (typeof searchTargetList)[number];

const moveFolderSortPriorityList = [
  "Recently used",
  "Alphabetical",
  "Alphabetical reverse",
] as const;
export type MoveFolderSortPriority =
  (typeof moveFolderSortPriorityList)[number];

export interface SearchCommand {
  name: string;
  searchBy: {
    tag: boolean;
    header: boolean;
    link: boolean;
    property: boolean;
  };
  keysOfPropertyToSearch: string[];
  searchTarget: SearchTarget;
  allowFuzzySearchForSearchTarget: boolean;
  minFuzzyMatchScore: number;
  includeCurrentFile: boolean;
  targetExtensions: string[];
  floating: boolean;
  showFrontMatter: boolean;
  excludeFrontMatterKeys: string[];
  defaultInput: string;
  restoreLastInput: boolean;
  commandPrefix: string;
  sortPriorities: SortPriority[];
  includePrefixPathPatterns: string[];
  excludePrefixPathPatterns: string[];
  expand: boolean;
}

export interface Hotkeys {
  main: {
    up: Hotkey[];
    down: Hotkey[];
    "clear input": Hotkey[];
    "replace input": Hotkey[];
    open: Hotkey[];
    "open in new tab": Hotkey[];
    "open in new pane (horizontal)": Hotkey[];
    "open in new pane (vertical)": Hotkey[];
    "open in new window": Hotkey[];
    "open in popup": Hotkey[];
    "open in new tab in background": Hotkey[];
    "open all in new tabs": Hotkey[];
    preview: Hotkey[];
    create: Hotkey[];
    "create in new tab": Hotkey[];
    "create in new window": Hotkey[];
    "create in new popup": Hotkey[];
    "open in default app": Hotkey[];
    "show in system explorer": Hotkey[];
    "open in google": Hotkey[];
    "open first URL": Hotkey[];
    "insert to editor": Hotkey[];
    "insert to editor in background": Hotkey[];
    "insert all to editor": Hotkey[];
    "show backlinks": Hotkey[];
    "show links": Hotkey[];
    "show all results": Hotkey[];
    "navigate forward": Hotkey[];
    "navigate back": Hotkey[];
    "close if opened": Hotkey[];
    "launch grep": Hotkey[];
    dismiss: Hotkey[];
  };
  folder: {
    up: Hotkey[];
    down: Hotkey[];
    "open in default app": Hotkey[];
    dismiss: Hotkey[];
  };
  move: {
    up: Hotkey[];
    down: Hotkey[];
    "open in default app": Hotkey[];
    dismiss: Hotkey[];
  };
  header: {
    up: Hotkey[];
    down: Hotkey[];
    "clear input": Hotkey[];
    "move to next hit": Hotkey[];
    "move to previous hit": Hotkey[];
    "toggle auto preview": Hotkey[];
    "insert all to editor": Hotkey[];
    dismiss: Hotkey[];
  };
  backlink: {
    up: Hotkey[];
    down: Hotkey[];
    open: Hotkey[];
    "open in new tab": Hotkey[];
    "open in new pane (horizontal)": Hotkey[];
    "open in new pane (vertical)": Hotkey[];
    "open in new window": Hotkey[];
    "open in popup": Hotkey[];
    "open in new tab in background": Hotkey[];
    "open all in new tabs": Hotkey[];
    "show all results": Hotkey[];
    preview: Hotkey[];
    dismiss: Hotkey[];
  };
  link: {
    up: Hotkey[];
    down: Hotkey[];
    open: Hotkey[];
    "open in new tab": Hotkey[];
    "open in new pane (horizontal)": Hotkey[];
    "open in new pane (vertical)": Hotkey[];
    "open in new window": Hotkey[];
    "open in popup": Hotkey[];
    "open in new tab in background": Hotkey[];
    "open all in new tabs": Hotkey[];
    "show all results": Hotkey[];
    preview: Hotkey[];
    dismiss: Hotkey[];
  };
  "in-file": {
    up: Hotkey[];
    down: Hotkey[];
    "show all results": Hotkey[];
    "toggle auto preview": Hotkey[];
    dismiss: Hotkey[];
  };
  grep: {
    search: Hotkey[];
    up: Hotkey[];
    down: Hotkey[];
    "clear input": Hotkey[];
    "clear path": Hotkey[];
    "set ./ to path": Hotkey[];
    "toggle input": Hotkey[];
    open: Hotkey[];
    "open in new tab": Hotkey[];
    "open in new pane (horizontal)": Hotkey[];
    "open in new pane (vertical)": Hotkey[];
    "open in new window": Hotkey[];
    "open in popup": Hotkey[];
    "open in new tab in background": Hotkey[];
    "open all in new tabs": Hotkey[];
    preview: Hotkey[];
    dismiss: Hotkey[];
  };
}

export interface Settings {
  searchDelayMilliSeconds: number;
  maxNumberOfSuggestions: number;
  normalizeAccentsAndDiacritics: boolean;
  useSelectionWordsAsDefaultInputQuery: boolean;
  preventDuplicateTabs: boolean;
  // Appearance
  showDirectory: boolean;
  showDirectoryAtNewLine: boolean;
  showFullPathOfDirectory: boolean;
  showAliasesOnTop: boolean; // Display alias as title on keyword match
  displayAliaseAsTitle: boolean; // Display the alias as the title.
  displayDescriptionBelowTitle: boolean;
  showExistingFilesOnly: boolean;
  hideGutterIcons: boolean;
  hideHotkeyGuides: boolean;
  // Hotkey in search dialog
  userAltInsteadOfModForQuickResultSelection: boolean;
  hotkeys: Hotkeys;
  // Searches
  searchCommands: SearchCommand[];
  searchesExcludePrefix: string;
  searchesAutoAliasTransform: {
    enabled: boolean;
    aliasPattern: string;
    aliasFormat: string;
  };
  // Header search
  autoPreviewInFloatingHeaderSearch: boolean;
  // Backlink search
  backlinkExcludePrefixPathPatterns: string[];
  // In file search
  inFileContextLines: number;
  autoPreviewInFloatingInFileSearch: boolean;
  inFileMaxDisplayLengthAroundMatchedWord: number;
  // Grep
  ripgrepCommand: string;
  grepSearchDelayMilliSeconds: number;
  grepExtensions: string[];
  maxDisplayLengthAroundMatchedWord: number;
  includeFilenameInGrepSearch: boolean;
  fdCommand: string;
  defaultGrepFolder: string;

  // Move file to another folder
  moveFileExcludePrefixPathPatterns: string[];
  moveFolderSortPriority: MoveFolderSortPriority;
  moveFileRecentlyUsedFilePath: string;
  moveFileMaxRecentlyUsedFolders: number;
  // debug
  showLogAboutPerformanceInConsole: boolean;
  showFuzzyMatchScore: boolean;
}

export const createDefaultHotkeys = (): Hotkeys => ({
  main: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "clear input": [{ modifiers: ["Mod"], key: "d" }],
    "replace input": [{ modifiers: [], key: "Tab" }],
    open: [{ modifiers: [], key: "Enter" }],
    "open in new tab": [{ modifiers: ["Mod"], key: "Enter" }],
    "open in new pane (horizontal)": [{ modifiers: ["Mod"], key: "-" }],
    "open in new pane (vertical)": [{ modifiers: ["Mod"], key: "i" }],
    "open in new window": [{ modifiers: ["Mod"], key: "o" }],
    "open in popup": [],
    "open in new tab in background": [{ modifiers: ["Alt"], key: "o" }],
    "open all in new tabs": [{ modifiers: ["Mod", "Shift", "Alt"], key: "o" }],
    preview: [{ modifiers: ["Mod"], key: "," }],
    create: [{ modifiers: ["Shift"], key: "Enter" }],
    "create in new tab": [{ modifiers: ["Mod", "Shift"], key: "Enter" }],
    "create in new window": [{ modifiers: ["Mod", "Shift"], key: "o" }],
    "create in new popup": [],
    "open in default app": [],
    "show in system explorer": [],
    "open in google": [{ modifiers: ["Mod"], key: "g" }],
    "open first URL": [{ modifiers: ["Mod"], key: "]" }],
    "insert to editor": [{ modifiers: ["Alt"], key: "Enter" }],
    "insert to editor in background": [],
    "insert all to editor": [{ modifiers: ["Alt", "Shift"], key: "Enter" }],
    "show backlinks": [{ modifiers: ["Mod"], key: "h" }],
    "show links": [{ modifiers: ["Mod"], key: "l" }],
    "show all results": [{ modifiers: ["Shift", "Alt"], key: "a" }],
    "navigate forward": [{ modifiers: ["Alt"], key: "ArrowRight" }],
    "navigate back": [{ modifiers: ["Alt"], key: "ArrowLeft" }],
    "close if opened": [],
    "launch grep": [],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  folder: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "open in default app": [],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  move: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "open in default app": [],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  header: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "clear input": [{ modifiers: ["Mod"], key: "d" }],
    "move to next hit": [{ modifiers: [], key: "Tab" }],
    "move to previous hit": [{ modifiers: ["Shift"], key: "Tab" }],
    "toggle auto preview": [{ modifiers: ["Mod"], key: "," }],
    "insert all to editor": [{ modifiers: ["Alt", "Shift"], key: "Enter" }],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  backlink: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    open: [{ modifiers: [], key: "Enter" }],
    "open in new tab": [{ modifiers: ["Mod"], key: "Enter" }],
    "open in new pane (horizontal)": [{ modifiers: ["Mod"], key: "-" }],
    "open in new pane (vertical)": [{ modifiers: ["Mod"], key: "i" }],
    "open in new window": [{ modifiers: ["Mod"], key: "o" }],
    "open in popup": [],
    "open in new tab in background": [{ modifiers: ["Alt"], key: "o" }],
    "open all in new tabs": [{ modifiers: ["Mod", "Shift", "Alt"], key: "o" }],
    "show all results": [{ modifiers: ["Shift", "Alt"], key: "a" }],
    preview: [{ modifiers: ["Mod"], key: "," }],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  link: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    open: [{ modifiers: [], key: "Enter" }],
    "open in new tab": [{ modifiers: ["Mod"], key: "Enter" }],
    "open in new pane (horizontal)": [{ modifiers: ["Mod"], key: "-" }],
    "open in new pane (vertical)": [{ modifiers: ["Mod"], key: "i" }],
    "open in new window": [{ modifiers: ["Mod"], key: "o" }],
    "open in popup": [],
    "open in new tab in background": [{ modifiers: ["Alt"], key: "o" }],
    "open all in new tabs": [{ modifiers: ["Mod", "Shift", "Alt"], key: "o" }],
    "show all results": [{ modifiers: ["Shift", "Alt"], key: "a" }],
    preview: [{ modifiers: ["Mod"], key: "," }],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  "in-file": {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "show all results": [{ modifiers: ["Shift", "Alt"], key: "a" }],
    "toggle auto preview": [{ modifiers: ["Mod"], key: "," }],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
  grep: {
    search: [{ modifiers: [], key: "Tab" }],
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "clear input": [{ modifiers: ["Mod"], key: "d" }],
    "clear path": [{ modifiers: ["Alt"], key: "d" }],
    "set ./ to path": [{ modifiers: ["Alt"], key: "c" }],
    "toggle input": [],
    open: [{ modifiers: [], key: "Enter" }],
    "open in new tab": [{ modifiers: ["Mod"], key: "Enter" }],
    "open in new pane (horizontal)": [{ modifiers: ["Mod"], key: "-" }],
    "open in new pane (vertical)": [{ modifiers: ["Mod"], key: "i" }],
    "open in new window": [{ modifiers: ["Mod"], key: "o" }],
    "open in popup": [],
    "open in new tab in background": [{ modifiers: ["Alt"], key: "o" }],
    "open all in new tabs": [{ modifiers: ["Mod", "Shift", "Alt"], key: "o" }],
    preview: [{ modifiers: ["Mod"], key: "," }],
    dismiss: [{ modifiers: [], key: "Escape" }],
  },
});

const createDefaultExcludeFrontMatterKeys = (): string[] => [
  "aliases",
  "alias",
  "tag",
  "tags",
  "cssclass",
  "publish",
];

export const createDefaultSearchCommand = (): SearchCommand => ({
  name: "",
  searchBy: {
    tag: false,
    link: false,
    header: false,
    property: false,
  },
  keysOfPropertyToSearch: [],
  searchTarget: "file",
  allowFuzzySearchForSearchTarget: false,
  minFuzzyMatchScore: 0.5,
  targetExtensions: [],
  includeCurrentFile: false,
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  restoreLastInput: false,
  commandPrefix: "",
  sortPriorities: [],
  includePrefixPathPatterns: [],
  excludePrefixPathPatterns: [],
  expand: true,
});

// Use only for "Navigate outgoing/backlinks without leaving the dialog"
export const createDefaultLinkSearchCommand = (): SearchCommand => ({
  name: "Link search",
  searchBy: {
    tag: false,
    link: false,
    header: false,
    property: false,
  },
  keysOfPropertyToSearch: [],
  searchTarget: "link",
  allowFuzzySearchForSearchTarget: false,
  minFuzzyMatchScore: 0.5,
  targetExtensions: [],
  includeCurrentFile: false,
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  restoreLastInput: false,
  commandPrefix: "",
  sortPriorities: [],
  includePrefixPathPatterns: [],
  excludePrefixPathPatterns: [],
  expand: false,
});

// Use only for "Navigate outgoing/backlinks without leaving the dialog"
export const createDefaultBacklinkSearchCommand = (): SearchCommand => ({
  name: "Backlink search",
  searchBy: {
    tag: false,
    link: false,
    header: false,
    property: false,
  },
  keysOfPropertyToSearch: [],
  searchTarget: "backlink",
  allowFuzzySearchForSearchTarget: false,
  minFuzzyMatchScore: 0.5,
  targetExtensions: ["md"],
  includeCurrentFile: false,
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  restoreLastInput: false,
  commandPrefix: "",
  sortPriorities: ["Last opened", "Last modified"],
  includePrefixPathPatterns: [],
  excludePrefixPathPatterns: [],
  expand: false,
});

export const createDefault2HopLinkSearchCommand = (): SearchCommand => ({
  name: "2 hop link search",
  searchBy: {
    tag: true,
    link: false,
    header: false,
    property: false,
  },
  keysOfPropertyToSearch: [],
  searchTarget: "2-hop-link",
  allowFuzzySearchForSearchTarget: false,
  minFuzzyMatchScore: 0.5,
  targetExtensions: [],
  includeCurrentFile: false,
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  restoreLastInput: false,
  commandPrefix: "",
  sortPriorities: [
    "Prefix name match",
    "Alphabetical",
    ".md",
    "Last opened",
    "Last modified",
  ],
  includePrefixPathPatterns: [],
  excludePrefixPathPatterns: [],
  expand: false,
});

export const createPreSettingSearchCommands = (): SearchCommand[] => [
  {
    name: "Recent search",
    searchBy: {
      tag: true,
      header: false,
      link: false,
      property: false,
    },
    keysOfPropertyToSearch: [],
    searchTarget: "file",
    allowFuzzySearchForSearchTarget: false,
    minFuzzyMatchScore: 0.5,
    targetExtensions: [],
    includeCurrentFile: false,
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    restoreLastInput: false,
    commandPrefix: ":e ",
    sortPriorities: ["Name match", ".md", "Last opened", "Last modified"],
    includePrefixPathPatterns: [],
    excludePrefixPathPatterns: [],
    expand: true,
  },
  {
    name: "File name search",
    searchBy: {
      tag: false,
      link: false,
      header: false,
      property: false,
    },
    keysOfPropertyToSearch: [],
    searchTarget: "file",
    allowFuzzySearchForSearchTarget: false,
    minFuzzyMatchScore: 0.5,
    targetExtensions: [],
    includeCurrentFile: false,
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    restoreLastInput: false,
    commandPrefix: ":f ",
    sortPriorities: [
      "Prefix name match",
      "Alphabetical",
      ".md",
      "Last opened",
      "Last modified",
    ],
    includePrefixPathPatterns: [],
    excludePrefixPathPatterns: [],
    expand: false,
  },
  {
    name: "File name fuzzy search",
    searchBy: {
      tag: false,
      link: false,
      header: false,
      property: false,
    },
    keysOfPropertyToSearch: [],
    searchTarget: "file",
    allowFuzzySearchForSearchTarget: true,
    minFuzzyMatchScore: 0.5,
    targetExtensions: [],
    includeCurrentFile: false,
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    restoreLastInput: false,
    commandPrefix: "",
    sortPriorities: [
      "Prefix name match",
      "Fuzzy name match",
      ".md",
      "Last opened",
      "Last modified",
    ],
    includePrefixPathPatterns: [],
    excludePrefixPathPatterns: [],
    expand: false,
  },
  {
    name: "Landmark search",
    searchBy: {
      tag: true,
      link: true,
      header: true,
      property: false,
    },
    keysOfPropertyToSearch: [],
    searchTarget: "file",
    allowFuzzySearchForSearchTarget: false,
    minFuzzyMatchScore: 0.5,
    targetExtensions: [],
    includeCurrentFile: false,
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    restoreLastInput: false,
    commandPrefix: ":l ",
    sortPriorities: [
      "Prefix name match",
      "Name match",
      "Tag match",
      "Header match",
      "Link match",
      ".md",
      "Last opened",
      "Last modified",
    ],
    includePrefixPathPatterns: [],
    excludePrefixPathPatterns: [],
    expand: false,
  },
  {
    name: "Star search",
    searchBy: {
      tag: false,
      link: false,
      header: false,
      property: false,
    },
    keysOfPropertyToSearch: [],
    searchTarget: "file",
    allowFuzzySearchForSearchTarget: false,
    minFuzzyMatchScore: 0.5,
    targetExtensions: [],
    includeCurrentFile: false,
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    restoreLastInput: false,
    commandPrefix: ":s ",
    sortPriorities: ["Star", ".md", "Last opened", "Last modified"],
    includePrefixPathPatterns: [],
    excludePrefixPathPatterns: [],
    expand: false,
  },
  createDefault2HopLinkSearchCommand(),
];

export const DEFAULT_SETTINGS: Settings = {
  searchDelayMilliSeconds: 0,
  maxNumberOfSuggestions: 50,
  normalizeAccentsAndDiacritics: false,
  useSelectionWordsAsDefaultInputQuery: false,
  preventDuplicateTabs: false,
  // Appearance
  showDirectory: true,
  showDirectoryAtNewLine: false,
  showFullPathOfDirectory: false,
  showAliasesOnTop: false,
  displayAliaseAsTitle: false,
  displayDescriptionBelowTitle: false,
  showExistingFilesOnly: false,
  hideGutterIcons: false,
  hideHotkeyGuides: false,
  // Hot keys in dialog
  userAltInsteadOfModForQuickResultSelection: false,
  hotkeys: createDefaultHotkeys(),
  // Searches
  searchCommands: createPreSettingSearchCommands(),
  searchesExcludePrefix: "-",
  searchesAutoAliasTransform: {
    enabled: false,
    aliasPattern: "",
    aliasFormat: "",
  },
  // Header search
  autoPreviewInFloatingHeaderSearch: true,
  // Backlink search
  backlinkExcludePrefixPathPatterns: [],
  // In file search
  inFileContextLines: 2,
  autoPreviewInFloatingInFileSearch: false,
  inFileMaxDisplayLengthAroundMatchedWord: 64,
  // Grep
  ripgrepCommand: "rg",
  grepSearchDelayMilliSeconds: 0,
  grepExtensions: ["md"],
  maxDisplayLengthAroundMatchedWord: 64,
  includeFilenameInGrepSearch: false,
  fdCommand: "fd",
  defaultGrepFolder: "",
  // Move file to another folder
  moveFileExcludePrefixPathPatterns: [],
  moveFolderSortPriority: "Recently used",
  moveFileRecentlyUsedFilePath: "",
  moveFileMaxRecentlyUsedFolders: 10,
  // debug
  showLogAboutPerformanceInConsole: false,
  showFuzzyMatchScore: false,
};
export class AnotherQuickSwitcherSettingTab extends PluginSettingTab {
  plugin: AnotherQuickSwitcher;
  resetLock = true;
  hotkeyExpandedStatus: Record<keyof Hotkeys, boolean> = {
    main: false,
    folder: false,
    move: false,
    header: false,
    backlink: false,
    link: false,
    "in-file": false,
    grep: false,
  };

  constructor(app: App, plugin: AnotherQuickSwitcher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Another Quick Switcher - Settings" });

    this.addGeneralSettings(containerEl);
    this.addAppearanceSettings(containerEl);
    this.addHotKeysInDialogSettings(containerEl);
    this.addSearchSettings(containerEl);
    this.addHeaderSearchSettings(containerEl);
    this.addBacklinkSettings(containerEl);
    this.addInFileSettings(containerEl);
    this.addGrepSettings(containerEl);
    this.addMoveSettings(containerEl);

    this.addDebugSettings(containerEl);
  }

  private addGeneralSettings(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName("Search delay milli-seconds")
      .setDesc("If keyboard operation is slow, try increasing the value")
      .addSlider((sc) =>
        sc
          .setLimits(0, 1000, 10)
          .setValue(this.plugin.settings.searchDelayMilliSeconds)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.searchDelayMilliSeconds = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max number of suggestions")
      .addSlider((sc) =>
        sc
          .setLimits(1, 255, 1)
          .setValue(this.plugin.settings.maxNumberOfSuggestions)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxNumberOfSuggestions = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Normalize accents/diacritics")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.normalizeAccentsAndDiacritics,
        ).onChange(async (value) => {
          this.plugin.settings.normalizeAccentsAndDiacritics = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });
    if (this.plugin.settings.normalizeAccentsAndDiacritics) {
      containerEl.createEl("div", {
        text: "! If enabled, it is about 2 to 5 times slower than disabled",
        cls: "another-quick-switcher__settings__warning",
      });
    }

    new Setting(containerEl)
      .setName("Use selection words as a default input query")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.useSelectionWordsAsDefaultInputQuery,
        ).onChange(async (value) => {
          this.plugin.settings.useSelectionWordsAsDefaultInputQuery = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Prevent duplicate tabs")
      .setDesc(
        "If a file is already opened as a tab, it will not open in a new tab; instead, the existing tab will be activated. This option is enabled for three commands: 'open in new tab', 'open in new tab in background', and 'open all in new tabs'.",
      )
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.preventDuplicateTabs).onChange(
          async (value) => {
            this.plugin.settings.preventDuplicateTabs = value;
            await this.plugin.saveSettings();
          },
        );
      });
  }

  private addAppearanceSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "👁Appearance" });

    new Setting(containerEl).setName("Show directory").addToggle((tc) => {
      tc.setValue(this.plugin.settings.showDirectory).onChange(
        async (value) => {
          this.plugin.settings.showDirectory = value;
          await this.plugin.saveSettings();
          this.display();
        },
      );
    });

    if (this.plugin.settings.showDirectory) {
      new Setting(containerEl)
        .setName("Show directory at the new line")
        .setClass("another-quick-switcher__settings__nested")
        .addToggle((tc) => {
          tc.setValue(this.plugin.settings.showDirectoryAtNewLine).onChange(
            async (value) => {
              this.plugin.settings.showDirectoryAtNewLine = value;
              await this.plugin.saveSettings();
            },
          );
        });
      new Setting(containerEl)
        .setName("Show full path of directory")
        .setClass("another-quick-switcher__settings__nested")
        .addToggle((tc) => {
          tc.setValue(this.plugin.settings.showFullPathOfDirectory).onChange(
            async (value) => {
              this.plugin.settings.showFullPathOfDirectory = value;
              await this.plugin.saveSettings();
            },
          );
        });
    }

    new Setting(containerEl)
      .setName("Display alias as title on keyword match")
      .setDesc(
        "When a keyword matches an alias, display the alias as the title.",
      )
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.showAliasesOnTop).onChange(
          async (value) => {
            this.plugin.settings.showAliasesOnTop = value;
            await this.plugin.saveSettings();
          },
        );
      });

    new Setting(containerEl)
      .setName("Display the alias as the title")
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.displayAliaseAsTitle).onChange(
          async (value) => {
            this.plugin.settings.displayAliaseAsTitle = value;
            await this.plugin.saveSettings();
          },
        );
      });

    new Setting(containerEl)
      .setName("Display the 'description' property below the title")
      .setDesc(
        "When enabled, it will no longer appear in the property display area of the search results.",
      )
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.displayDescriptionBelowTitle).onChange(
          async (value) => {
            this.plugin.settings.displayDescriptionBelowTitle = value;
            await this.plugin.saveSettings();
          },
        );
      });

    new Setting(containerEl)
      .setName("Show existing files only")
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.showExistingFilesOnly).onChange(
          async (value) => {
            this.plugin.settings.showExistingFilesOnly = value;
            await this.plugin.saveSettings();
          },
        );
      });

    new Setting(containerEl).setName("Hide gutter icons").addToggle((tc) => {
      tc.setValue(this.plugin.settings.hideGutterIcons).onChange(
        async (value) => {
          this.plugin.settings.hideGutterIcons = value;
          await this.plugin.saveSettings();
        },
      );
    });

    new Setting(containerEl).setName("Hide hotkey guides").addToggle((tc) => {
      tc.setValue(this.plugin.settings.hideHotkeyGuides).onChange(
        async (value) => {
          this.plugin.settings.hideHotkeyGuides = value;
          await this.plugin.saveSettings();
        },
      );
    });
  }

  private addHotKeysInDialogSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "⌨Hot keys in dialog" });

    new Setting(containerEl)
      .setName(
        "Use `alt 1～9` instead of `ctrl/cmd 1～9` for quick result selection",
      )
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.userAltInsteadOfModForQuickResultSelection,
        ).onChange(async (value) => {
          this.plugin.settings.userAltInsteadOfModForQuickResultSelection =
            value;
          await this.plugin.saveSettings();
        });
      });

    const addHotkeyItems = (dialogKey: keyof Hotkeys, div: HTMLDivElement) => {
      if (!this.hotkeyExpandedStatus[dialogKey]) {
        return;
      }

      const addHotKeyItem = (name: string, command: string) => {
        new Setting(div)
          .setName(name)
          .setClass("another-quick-switcher__settings__dialog-hotkey-item")
          .addText((cb) => {
            const dialog = this.plugin.settings.hotkeys[dialogKey] as {
              [key: string]: Hotkey[];
            };
            return cb
              .setValue(hotkey2String(dialog[command][0]))
              .onChange(async (value: string) => {
                const hk = string2Hotkey(
                  value,
                  dialog[command][0]?.hideHotkeyGuide ?? false,
                );
                dialog[command] = hk ? [hk] : [];
                await this.plugin.saveSettings();
              });
          })
          .addToggle((cb) => {
            const dialog = this.plugin.settings.hotkeys[dialogKey] as {
              [key: string]: Hotkey[];
            };
            return cb
              .setTooltip("Show hotkey guide if enabled")
              .setValue(!dialog[command][0]?.hideHotkeyGuide)
              .onChange(async (showHotkeyGuide: boolean) => {
                dialog[command] = dialog[command][0]
                  ? [
                      {
                        ...dialog[command][0],
                        hideHotkeyGuide: !showHotkeyGuide,
                      },
                    ]
                  : [];
                await this.plugin.saveSettings();
              });
          });
      };

      const keys = Object.keys(this.plugin.settings.hotkeys[dialogKey]);
      for (const k of keys) {
        addHotKeyItem(k, k as keyof Hotkeys[keyof Hotkeys]);
      }
    };

    const addHotkeysForDialog = (
      dialogKey: keyof Hotkeys,
      dialogName: string,
    ) => {
      const div = createDiv({
        cls: "another-quick-switcher__settings__dialog-hotkey",
      });
      containerEl.append(div);

      const li = createEl("li");
      li.append(
        "You can know the keycode at ",
        createEl("a", {
          text: "keycode.info",
          href: "https://keycode.info/",
        }),
        ". (Press any key and show 'event.key')",
      );
      li.createEl("ul").createEl("li", {
        text: "For the space key, please set the value to 'Space'.",
      });

      const ul = createEl("ul");
      ul.createEl("li", {
        text: "'Ctrl a' means pressing the Ctrl key and the A key.",
      });
      ul.createEl("li", {
        text: "Use 'Mod' instead of 'Ctrl' on Windows or 'Cmd' on macOS.",
      });
      ul.append(li);

      const df = document.createDocumentFragment();
      df.append(ul);

      new Setting(div)
        .setHeading()
        .setName(dialogName)
        .setDesc(df)
        .addExtraButton((btn) =>
          btn
            .setIcon(
              this.hotkeyExpandedStatus[dialogKey]
                ? "chevron-up"
                : "chevron-down",
            )
            .setTooltip(
              this.hotkeyExpandedStatus[dialogKey] ? "fold" : "unfold",
            )
            .onClick(() => {
              this.hotkeyExpandedStatus[dialogKey] =
                !this.hotkeyExpandedStatus[dialogKey];
              this.display();
            }),
        );
      addHotkeyItems(dialogKey, div);
    };

    addHotkeysForDialog("main", "Main dialog");
    addHotkeysForDialog("folder", "Folder dialog");
    addHotkeysForDialog("header", "Header dialog");
    addHotkeysForDialog("backlink", "Backlink dialog");
    addHotkeysForDialog("link", "Link dialog");
    addHotkeysForDialog("in-file", "In File dialog");
    addHotkeysForDialog("grep", "Grep dialog");
  }

  private addSearchSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "🔍 Search commands" });

    this.plugin.settings.searchCommands.forEach((_, i) => {
      this.addSearchCommandSetting(
        containerEl,
        this.plugin.settings.searchCommands[i],
      );
    });

    new Setting(containerEl)
      .setHeading()
      .addButton((btn) => {
        btn
          .setButtonText("Add")
          .setTooltip("Add a new command")
          .setCta()
          .setClass(
            "another-quick-switcher__settings__search-command__add-button",
          )
          .onClick(async (_) => {
            this.plugin.settings.searchCommands.push(
              createDefaultSearchCommand(),
            );
            this.display();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText("Save")
          .setTooltip(
            "You must click this button to save settings before closing Obsidian",
          )
          .setCta()
          .setClass(
            "another-quick-switcher__settings__search-command__save-button",
          )
          .onClick(async (_) => {
            this.plugin.settings.searchCommands =
              this.plugin.settings.searchCommands.filter((x) => x.name);

            const invalidValues = this.plugin.settings.searchCommands
              .flatMap((x) => x.sortPriorities)
              .filter((x) => !regardAsSortPriority(x));
            if (invalidValues.length > 0) {
              // noinspection ObjectAllocationIgnored
              new Notice(
                `
Invalid sort priorities:
${invalidValues.map((x) => `- ${x}`).join("\n")}
`.trim(),
                0,
              );
              return;
            }

            await this.plugin.saveSettings();
            this.display();
            this.plugin.reloadCommands();
            // noinspection ObjectAllocationIgnored
            new Notice("Save and reload commands");
          });
      });

    new Setting(containerEl)
      .setName("Reset all search commands")
      .setClass("another-quick-switcher__settings__danger")
      .setDesc(
        "It means your customized commands will be removed. If you reset unintentionally, you can restore the search commands by closing settings and Obsidian immediately, then restart Obsidian.",
      )
      .addToggle((cb) => {
        cb.setValue(this.resetLock).onChange((lock) => {
          this.resetLock = lock;
          this.display();
        });
        if (this.resetLock) {
          cb.setTooltip(
            "Turn off the lock, if you want to reset all search commands",
          );
        }
      })
      .addButton((btn) => {
        btn
          .setButtonText("Reset")
          .setTooltip("Reset all search commands!!")
          .setDisabled(this.resetLock)
          .onClick(() => {
            this.plugin.settings.searchCommands =
              createPreSettingSearchCommands();
            this.display();
          });
        if (!this.resetLock) {
          btn.setCta();
        }
      });

    new Setting(containerEl)
      .setName("Exclude prefix")
      .setDesc(
        "Adding this at the beginning of a query excludes matching results.",
      )
      .addText((cb) => {
        cb.setValue(this.plugin.settings.searchesExcludePrefix).onChange(
          async (value) => {
            this.plugin.settings.searchesExcludePrefix = value;
            await this.plugin.saveSettings();
          },
        );
      });

    new Setting(containerEl)
      .setName("Auto alias transform")
      .setDesc(
        "Transforms a selected link candidate into an internal link with an aliase based on a regex-defined rule when using the insert to editor command.",
      )
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.searchesAutoAliasTransform.enabled,
        ).onChange(async (value) => {
          this.plugin.settings.searchesAutoAliasTransform.enabled = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (this.plugin.settings.searchesAutoAliasTransform.enabled) {
      const ex1 = String.raw`Ex: (?<name>.+) \(.+\)$`;
      new Setting(containerEl)
        .setName("Alias pattern")
        .setDesc(
          `Specifies the regex pattern to identify parts of the link candidate for transformation into an alias. ${ex1}`,
        )
        .setClass("another-quick-switcher__settings__nested")
        .addText((cb) => {
          cb.setValue(
            this.plugin.settings.searchesAutoAliasTransform.aliasPattern,
          ).onChange(async (value) => {
            this.plugin.settings.searchesAutoAliasTransform.aliasPattern =
              value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName("Alias format")
        .setDesc(
          "Defines the format for the alias after transformation, using regex-captured groups from the candidate name. Ex: $<name>",
        )
        .setClass("another-quick-switcher__settings__nested")
        .addText((cb) => {
          cb.setValue(
            this.plugin.settings.searchesAutoAliasTransform.aliasFormat,
          ).onChange(async (value) => {
            this.plugin.settings.searchesAutoAliasTransform.aliasFormat = value;
            await this.plugin.saveSettings();
          });
        });
    }
  }

  private addSearchCommandSetting(
    containerEl: HTMLElement,
    command: SearchCommand,
  ) {
    const div = createDiv({
      cls: "another-quick-switcher__settings__search-command",
    });
    containerEl.append(div);

    new Setting(div)
      .setClass("another-quick-switcher__settings__search-command__header")
      .setHeading()
      .addText((tc) => {
        const el = tc
          .setPlaceholder("Command name")
          .setValue(command.name)
          .onChange(async (value) => {
            command.name = value;
          });
        el.inputEl.setAttribute("style", "text-align: left");
        return el;
      })
      .addExtraButton((btn) => {
        btn
          .setTooltip("Delete a command (!! it will never be restored !!)")
          .setIcon("trash-2")
          .onClick(() => {
            this.plugin.settings.searchCommands.remove(command);
            this.display();
          });
        btn.extraSettingsEl.addClass(
          "another-quick-switcher__settings__search-command__header__delete",
        );
        return btn;
      })
      .addExtraButton((btn) => {
        btn
          .setIcon(command.expand ? "chevron-up" : "chevron-down")
          .setTooltip(command.expand ? "fold" : "unfold")
          .onClick(() => {
            command.expand = !command.expand;
            this.display();
          });
        btn.extraSettingsEl.addClass(
          "another-quick-switcher__settings__search-command__header__fold-button",
        );
        return btn;
      });

    if (!command.expand) {
      return;
    }

    const buttonClass =
      "another-quick-switcher__settings__search-command__search-by-button";
    const buttonEnabledClass =
      "another-quick-switcher__settings__search-command__search-by-button_enabled";
    const buttonDisabledClass =
      "another-quick-switcher__settings__search-command__search-by-button_disabled";
    new Setting(div)
      .setName("Search by")
      .setDesc("Click the button to enable/disable the search target")
      .addButton((bc) => {
        const coloring = () => {
          bc.buttonEl.removeClass(buttonEnabledClass, buttonDisabledClass);
          bc.buttonEl.addClass(
            command.searchBy.tag ? buttonEnabledClass : buttonDisabledClass,
          );
        };

        bc.setButtonText("Tag")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy.tag = !command.searchBy!.tag;
            coloring();
          });
        coloring();
        return bc;
      })
      .addButton((bc) => {
        const coloring = () => {
          bc.buttonEl.removeClass(buttonEnabledClass, buttonDisabledClass);
          bc.buttonEl.addClass(
            command.searchBy.header ? buttonEnabledClass : buttonDisabledClass,
          );
        };

        bc.setButtonText("Header")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy.header = !command.searchBy!.header;
            coloring();
          });
        coloring();
        return bc;
      })
      .addButton((bc) => {
        const coloring = () => {
          bc.buttonEl.removeClass(buttonEnabledClass, buttonDisabledClass);
          bc.buttonEl.addClass(
            command.searchBy.link ? buttonEnabledClass : buttonDisabledClass,
          );
        };

        bc.setButtonText("Link")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy.link = !command.searchBy!.link;
            coloring();
          });
        coloring();
        return bc;
      })
      .addButton((bc) => {
        const coloring = () => {
          bc.buttonEl.removeClass(buttonEnabledClass, buttonDisabledClass);
          bc.buttonEl.addClass(
            command.searchBy.property
              ? buttonEnabledClass
              : buttonDisabledClass,
          );
        };

        bc.setButtonText("Property")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy.property = !command.searchBy!.property;
            coloring();
            this.display();
          });
        coloring();

        return bc;
      });

    if (command.searchBy.property) {
      new Setting(div)
        .setName("Keys of the property to search")
        .setDesc("Multiple entries can be specified, separated by line breaks.")
        .addTextArea((tc) => {
          const el = tc
            .setValue(command.keysOfPropertyToSearch!.join("\n"))
            .onChange(async (value) => {
              command.keysOfPropertyToSearch = smartLineBreakSplit(value);
            });
          el.inputEl.className =
            "another-quick-switcher__settings__keys_of_property_to_search";

          return el;
        });
    }

    new Setting(div).setName("Search target").addDropdown((dc) => {
      dc.addOptions(mirror([...searchTargetList]))
        .setValue(command.searchTarget)
        .onChange(async (value) => {
          command.searchTarget = value as SearchTarget;
        });
    });

    new Setting(div)
      .setName('Allow fuzzy search for "Search target"')
      .addToggle((cb) => {
        cb.setValue(command.allowFuzzySearchForSearchTarget).onChange(
          async (value) => {
            command.allowFuzzySearchForSearchTarget = value as boolean;
          },
        );
      });

    new Setting(div)
      .setName("Min fuzzy match score")
      .setDesc(
        "Only show suggestion those score is more than the specific score",
      )
      .addSlider((sc) =>
        sc
          .setLimits(0, 10.0, 0.1)
          .setValue(command.minFuzzyMatchScore)
          .setDynamicTooltip()
          .onChange(async (value) => {
            command.minFuzzyMatchScore = value;
          }),
      );

    new Setting(div)
      .setName("Target extensions")
      .setDesc(
        "If set, only files whose extension equals will be suggested. If empty, all files will be suggested. It can set multi extensions using comma.",
      )
      .addTextArea((tc) =>
        tc
          .setPlaceholder("(ex: md,png,canvas)")
          .setValue(command.targetExtensions.join(","))
          .onChange(async (value) => {
            command.targetExtensions = smartCommaSplit(value);
          }),
      );

    new Setting(div).setName("Include current file").addToggle((cb) => {
      cb.setValue(command.includeCurrentFile).onChange(async (value) => {
        command.includeCurrentFile = value as boolean;
      });
    });

    new Setting(div).setName("Floating").addToggle((cb) => {
      cb.setValue(command.floating).onChange(async (value) => {
        command.floating = value as boolean;
        this.display();
      });
    });

    new Setting(div).setName("Show front matter").addToggle((cb) => {
      cb.setValue(command.showFrontMatter).onChange(async (value) => {
        command.showFrontMatter = value as boolean;
        this.display();
      });
    });

    if (command.showFrontMatter) {
      new Setting(div)
        .setName("Exclude front matter keys")
        .setDesc("It can set multi patterns by line breaks.")
        .addTextArea((tc) => {
          const el = tc
            .setValue(command.excludeFrontMatterKeys!.join("\n"))
            .onChange(async (value) => {
              command.excludeFrontMatterKeys = smartLineBreakSplit(value);
            });
          el.inputEl.className =
            "another-quick-switcher__settings__exclude_front_matter_keys";

          return el;
        });
    }

    new Setting(div)
      .setName("Default input")
      .setDesc("Default input strings when it opens the dialog")
      .addText((tc) =>
        tc
          .setValue(command.defaultInput)
          .setPlaceholder("(ex: #todo )")
          .onChange(async (value) => {
            command.defaultInput = value;
          }),
      );

    new Setting(div)
      .setName("Restore last input")
      .setDesc(
        "If enabled, this option will restore the last input, shared across all searches where it is enabled.",
      )
      .addToggle((tc) => {
        tc.setValue(command.restoreLastInput).onChange(async (value) => {
          command.restoreLastInput = value;
        });
      });

    new Setting(div)
      .setName("Command prefix")
      .setDesc(
        "For example, if it sets ':r ', a query starts with ':r ' means that search as this command",
      )
      .addText((tc) =>
        tc
          .setValue(command.commandPrefix)
          .setPlaceholder("(ex: :r )")
          .onChange(async (value) => {
            command.commandPrefix = value;
          }),
      );

    const df = document.createDocumentFragment();
    df.append(
      "Valid sort priorities refer to ",
      createEl("a", {
        text: "README",
        href: "https://github.com/tadashi-aikawa/obsidian-another-quick-switcher#sort-priorities",
      }),
    );

    new Setting(div)
      .setName("Sort priorities")
      .setDesc(df)
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("")
          .setValue(command.sortPriorities.join("\n"))
          .onChange(async (value) => {
            const priorities = smartLineBreakSplit(value);
            command.sortPriorities = priorities as SortPriority[];
          });
        el.inputEl.addClass(
          "another-quick-switcher__settings__search-command__sort-priority",
        );
        return el;
      });

    new Setting(div)
      .setName("Include prefix path patterns")
      .setDesc(
        "If set, only files whose paths start with one of the patterns will be suggested. It can set multi patterns by line breaks. <current_dir> means current directory.",
      )
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("(ex: Notes/Private)")
          .setValue(command.includePrefixPathPatterns!.join("\n"))
          .onChange(async (value) => {
            command.includePrefixPathPatterns = smartLineBreakSplit(value);
          });
        el.inputEl.className =
          "another-quick-switcher__settings__include_path_patterns";

        return el;
      });

    new Setting(div)
      .setName("Exclude prefix path patterns")
      .setDesc(
        "If set, files whose paths start with one of the patterns will not be suggested. It can set multi patterns by line breaks. <current_dir> means current directory.",
      )

      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("(ex: Notes/Private)")
          .setValue(command.excludePrefixPathPatterns!.join("\n"))
          .onChange(async (value) => {
            command.excludePrefixPathPatterns = smartLineBreakSplit(value);
          });
        el.inputEl.className =
          "another-quick-switcher__settings__exclude_path_patterns";

        return el;
      });
  }

  private addHeaderSearchSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "📒 Header search" });

    new Setting(containerEl)
      .setName("Auto preview in the floating mode")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.autoPreviewInFloatingHeaderSearch,
        ).onChange(async (value) => {
          this.plugin.settings.autoPreviewInFloatingHeaderSearch = value;
          await this.plugin.saveSettings();
        });
      });
  }

  private addBacklinkSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "🔍 Backlink search" });

    new Setting(containerEl)
      .setName('Exclude prefix path patterns for "Backlink search"')
      .setDesc(
        "If set, folders whose paths start with one of the patterns will not be suggested. It can set multi patterns by line breaks",
      )
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(
            this.plugin.settings.backlinkExcludePrefixPathPatterns.join("\n"),
          )
          .onChange(async (value) => {
            this.plugin.settings.backlinkExcludePrefixPathPatterns =
              smartLineBreakSplit(value);
            await this.plugin.saveSettings();
          });
        el.inputEl.className =
          "another-quick-switcher__settings__ignore_path_patterns";
        return el;
      });
  }

  private addInFileSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "🔍 In file search" });

    new Setting(containerEl)
      .setName("Context Lines")
      .setDesc(
        "Specifies the number of lines to display before and after the target line. For instance, setting this to '2' would display two lines before and two lines after the target line, providing context to the selected text",
      )
      .addSlider((sc) =>
        sc
          .setLimits(0, 10, 1)
          .setValue(this.plugin.settings.inFileContextLines)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.inFileContextLines = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto preview in the floating mode")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.autoPreviewInFloatingInFileSearch,
        ).onChange(async (value) => {
          this.plugin.settings.autoPreviewInFloatingInFileSearch = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Max display length around matched word")
      .setDesc(
        "Maximum display character count before or after the matched word.",
      )
      .addSlider((sc) =>
        sc
          .setLimits(1, 255, 1)
          .setValue(
            this.plugin.settings.inFileMaxDisplayLengthAroundMatchedWord,
          )
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.inFileMaxDisplayLengthAroundMatchedWord =
              value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private addGrepSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "🔍 Grep" });

    new Setting(containerEl)
      .setName("Ripgrep command")
      .setDesc("A command that can execute ripgrep")
      .addText((tc) =>
        tc
          .setValue(this.plugin.settings.ripgrepCommand)
          .onChange(async (value) => {
            this.plugin.settings.ripgrepCommand = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Grep search delay milli-seconds")
      .setDesc(
        "If set to 1 or more, the search will be executed automatically after the specified milliseconds have passed since entering a keyword. If set to 0, the search will only be executed when the hotkey is pressed.",
      )
      .addSlider((sc) =>
        sc
          .setLimits(0, 1000, 10)
          .setValue(this.plugin.settings.grepSearchDelayMilliSeconds)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.grepSearchDelayMilliSeconds = value;
            await this.plugin.saveSettings();
          }),
      );
    containerEl.createEl("div", {
      text: "! Please note that on Windows, the initial file access speed may be significantly slower.",
      cls: "another-quick-switcher__settings__warning",
    });

    new Setting(containerEl).setName("Extensions").addText((tc) =>
      tc
        .setPlaceholder("(ex: md,html,css)")
        .setValue(this.plugin.settings.grepExtensions.join(","))
        .onChange(async (value) => {
          this.plugin.settings.grepExtensions = smartCommaSplit(value);
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl)
      .setName("Default folder")
      .setDesc(
        "Default folder path for grep searches. Leave empty to use vault root. Use ./ for current directory.",
      )
      .addText((tc) =>
        tc
          .setPlaceholder("(ex: ./, folder/subfolder)")
          .setValue(this.plugin.settings.defaultGrepFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultGrepFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max display length around matched word")
      .setDesc(
        "Maximum display character count before or after the matched word.",
      )
      .addSlider((sc) =>
        sc
          .setLimits(1, 255, 1)
          .setValue(this.plugin.settings.maxDisplayLengthAroundMatchedWord)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxDisplayLengthAroundMatchedWord = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Include file name in search")
      .setDesc(
        "If enabled, file names are also included in the search target. fd is required.",
      )
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.includeFilenameInGrepSearch).onChange(
          async (value) => {
            this.plugin.settings.includeFilenameInGrepSearch = value;
            await this.plugin.saveSettings();
            this.display();
          },
        );
      });

    if (this.plugin.settings.includeFilenameInGrepSearch) {
      new Setting(containerEl)
        .setName("fd command")
        .setClass("another-quick-switcher__settings__nested")
        .setDesc("Commands that can execute fd")
        .addText((tc) =>
          tc
            .setValue(this.plugin.settings.fdCommand)
            .onChange(async (value) => {
              this.plugin.settings.fdCommand = value;
              await this.plugin.saveSettings();
            }),
        );
    }
  }

  private addMoveSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "📁 Move file to another folder" });

    new Setting(containerEl)
      .setName('Exclude prefix path patterns for "Move file to another folder"')
      .setDesc(
        "If set, folders whose paths start with one of the patterns will not be suggested. It can set multi patterns by line breaks",
      )
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(
            this.plugin.settings.moveFileExcludePrefixPathPatterns.join("\n"),
          )
          .onChange(async (value) => {
            this.plugin.settings.moveFileExcludePrefixPathPatterns =
              smartLineBreakSplit(value);
            await this.plugin.saveSettings();
          });
        el.inputEl.className =
          "another-quick-switcher__settings__ignore_path_patterns";
        return el;
      });

    new Setting(containerEl)
      .setName("Folder sort priority")
      .setDesc("How to sort folders in move dialog")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(mirror([...moveFolderSortPriorityList]))
          .setValue(this.plugin.settings.moveFolderSortPriority)
          .onChange(async (value) => {
            this.plugin.settings.moveFolderSortPriority =
              value as MoveFolderSortPriority;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Recently used folders file path")
      .setDesc("Path within vault to store recently used folders history")
      .addText((tc) => {
        tc.setPlaceholder(
          ".obsidian/plugins/obsidian-another-quick-switcher/recently-used-folders.json",
        )
          .setValue(this.plugin.settings.moveFileRecentlyUsedFilePath)
          .onChange(async (value) => {
            this.plugin.settings.moveFileRecentlyUsedFilePath = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Max recently used folders")
      .setDesc("Maximum number of recently used folders to remember")
      .addSlider((sc) => {
        sc.setLimits(5, 50, 5)
          .setValue(this.plugin.settings.moveFileMaxRecentlyUsedFolders)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.moveFileMaxRecentlyUsedFolders = value;
            await this.plugin.saveSettings();
          });
      });
  }

  private addDebugSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "Debug" });

    new Setting(containerEl)
      .setName("Show log about performance in a console")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.showLogAboutPerformanceInConsole,
        ).onChange(async (value) => {
          this.plugin.settings.showLogAboutPerformanceInConsole = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show fuzzy match score in the dialog")
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.showFuzzyMatchScore).onChange(
          async (value) => {
            this.plugin.settings.showFuzzyMatchScore = value;
            await this.plugin.saveSettings();
          },
        );
      });
  }
}

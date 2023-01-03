import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import AnotherQuickSwitcher from "./main";
import { regardAsSortPriority, SortPriority } from "./sorters";
import { smartCommaSplit, smartLineBreakSplit } from "./utils/strings";
import { Hotkey, hotkey2String, string2Hotkey } from "./keys";
import { mirror } from "./utils/collection-helper";

const searchTargetList = ["file", "backlink", "link"] as const;
export type SearchTarget = typeof searchTargetList[number];

export interface SearchCommand {
  name: string;
  searchBy: {
    tag: boolean;
    header: boolean;
    link: boolean;
  };
  searchTarget: SearchTarget;
  targetExtensions: string[];
  floating: boolean;
  showFrontMatter: boolean;
  excludeFrontMatterKeys: string[];
  defaultInput: string;
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
    "open in google": Hotkey[];
    "open first URL": Hotkey[];
    "insert to editor": Hotkey[];
    "insert all to editor": Hotkey[];
    "show backlinks": Hotkey[];
    "show links": Hotkey[];
    "navigate forward": Hotkey[];
    "navigate back": Hotkey[];
  };
  move: {
    up: Hotkey[];
    down: Hotkey[];
  };
  header: {
    up: Hotkey[];
    down: Hotkey[];
    "clear input": Hotkey[];
    "move to next hit": Hotkey[];
    "move to previous hit": Hotkey[];
    "toggle auto preview": Hotkey[];
  };
  grep: {
    search: Hotkey[];
    up: Hotkey[];
    down: Hotkey[];
    "clear input": Hotkey[];
    "clear path": Hotkey[];
    "set ./ to path": Hotkey[];
    "open in new tab": Hotkey[];
    "open in new pane (horizontal)": Hotkey[];
    "open in new pane (vertical)": Hotkey[];
    "open in new window": Hotkey[];
    "open in popup": Hotkey[];
    "open in new tab in background": Hotkey[];
    "open all in new tabs": Hotkey[];
    preview: Hotkey[];
  };
}

export interface Settings {
  searchDelayMilliSeconds: number;
  maxNumberOfSuggestions: number;
  normalizeAccentsAndDiacritics: boolean;
  // Appearance
  showDirectory: boolean;
  showDirectoryAtNewLine: boolean;
  showFullPathOfDirectory: boolean;
  showAliasesOnTop: boolean;
  showExistingFilesOnly: boolean;
  hideGutterIcons: boolean;
  hideHotkeyGuides: boolean;
  // Hotkey in search dialog
  userAltInsteadOfModForQuickResultSelection: boolean;
  hotkeys: Hotkeys;
  // Searches
  searchCommands: SearchCommand[];
  // Header search
  autoPreviewInFloatingHeaderSearch: boolean;
  // Grep
  ripgrepCommand: string;
  // Move file to another folder
  moveFileExcludePrefixPathPatterns: string[];
  // debug
  showLogAboutPerformanceInConsole: boolean;
}

const createDefaultHotkeys = (): Hotkeys => ({
  main: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "clear input": [{ modifiers: ["Mod"], key: "d" }],
    "replace input": [{ modifiers: [], key: "Tab" }],
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
    "open in google": [{ modifiers: ["Mod"], key: "g" }],
    "open first URL": [{ modifiers: ["Mod"], key: "]" }],
    "insert to editor": [{ modifiers: ["Alt"], key: "Enter" }],
    "insert all to editor": [{ modifiers: ["Alt", "Shift"], key: "Enter" }],
    "show backlinks": [{ modifiers: ["Mod"], key: "h" }],
    "show links": [{ modifiers: ["Mod"], key: "l" }],
    "navigate forward": [{ modifiers: ["Alt"], key: "ArrowRight" }],
    "navigate back": [{ modifiers: ["Alt"], key: "ArrowLeft" }],
  },
  move: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
  },
  header: {
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "clear input": [{ modifiers: ["Mod"], key: "d" }],
    "move to next hit": [{ modifiers: [], key: "Tab" }],
    "move to previous hit": [{ modifiers: ["Shift"], key: "Tab" }],
    "toggle auto preview": [{ modifiers: ["Mod"], key: "," }],
  },
  grep: {
    search: [{ modifiers: [], key: "Tab" }],
    up: [{ modifiers: ["Mod"], key: "p" }],
    down: [{ modifiers: ["Mod"], key: "n" }],
    "clear input": [{ modifiers: ["Mod"], key: "d" }],
    "clear path": [{ modifiers: ["Alt"], key: "d" }],
    "set ./ to path": [{ modifiers: ["Alt"], key: "c" }],
    "open in new tab": [{ modifiers: ["Mod"], key: "Enter" }],
    "open in new pane (horizontal)": [{ modifiers: ["Mod"], key: "-" }],
    "open in new pane (vertical)": [{ modifiers: ["Mod"], key: "i" }],
    "open in new window": [{ modifiers: ["Mod"], key: "o" }],
    "open in popup": [],
    "open in new tab in background": [{ modifiers: ["Alt"], key: "o" }],
    "open all in new tabs": [{ modifiers: ["Mod", "Shift", "Alt"], key: "o" }],
    preview: [{ modifiers: ["Mod"], key: "," }],
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
  },
  searchTarget: "file",
  targetExtensions: [],
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  commandPrefix: "",
  sortPriorities: [],
  includePrefixPathPatterns: [],
  excludePrefixPathPatterns: [],
  expand: true,
});

export const createDefaultLinkSearchCommand = (): SearchCommand => ({
  name: "Link search",
  searchBy: {
    tag: false,
    link: false,
    header: false,
  },
  searchTarget: "link",
  targetExtensions: [],
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  commandPrefix: "",
  sortPriorities: ["Last opened", "Last modified"],
  includePrefixPathPatterns: [],
  excludePrefixPathPatterns: [],
  expand: false,
});

export const createDefaultBacklinkSearchCommand = (): SearchCommand => ({
  name: "Backlink search",
  searchBy: {
    tag: false,
    link: false,
    header: false,
  },
  searchTarget: "backlink",
  targetExtensions: ["md"],
  floating: false,
  showFrontMatter: false,
  excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
  defaultInput: "",
  commandPrefix: "",
  sortPriorities: ["Last opened", "Last modified"],
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
    },
    searchTarget: "file",
    targetExtensions: [],
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    commandPrefix: ":e ",
    sortPriorities: ["Name match", "Last opened", "Last modified"],
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
    },
    searchTarget: "file",
    targetExtensions: [],
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    commandPrefix: ":f ",
    sortPriorities: [
      "Prefix name match",
      "Alphabetical",
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
    },
    searchTarget: "file",
    targetExtensions: [],
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    commandPrefix: ":l ",
    sortPriorities: [
      "Prefix name match",
      "Name match",
      "Tag match",
      "Header match",
      "Link match",
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
    },
    searchTarget: "file",
    targetExtensions: [],
    floating: false,
    showFrontMatter: false,
    excludeFrontMatterKeys: createDefaultExcludeFrontMatterKeys(),
    defaultInput: "",
    commandPrefix: ":s ",
    sortPriorities: ["Star", "Last opened", "Last modified"],
    includePrefixPathPatterns: [],
    excludePrefixPathPatterns: [],
    expand: false,
  },
  createDefaultLinkSearchCommand(),
  createDefaultBacklinkSearchCommand(),
];

export const DEFAULT_SETTINGS: Settings = {
  searchDelayMilliSeconds: 0,
  maxNumberOfSuggestions: 50,
  normalizeAccentsAndDiacritics: false,
  // Appearance
  showDirectory: true,
  showDirectoryAtNewLine: false,
  showFullPathOfDirectory: false,
  showAliasesOnTop: false,
  showExistingFilesOnly: false,
  hideGutterIcons: false,
  hideHotkeyGuides: false,
  // Hot keys in dialog
  userAltInsteadOfModForQuickResultSelection: false,
  hotkeys: createDefaultHotkeys(),
  // Searches
  searchCommands: createPreSettingSearchCommands(),
  // Header search
  autoPreviewInFloatingHeaderSearch: true,
  // Grep
  ripgrepCommand: "rg",
  // Move file to another folder
  moveFileExcludePrefixPathPatterns: [],
  // debug
  showLogAboutPerformanceInConsole: false,
};
export class AnotherQuickSwitcherSettingTab extends PluginSettingTab {
  plugin: AnotherQuickSwitcher;
  resetLock = true;
  hotkeyExpandedStatus: Record<keyof Hotkeys, boolean> = {
    main: false,
    move: false,
    header: false,
    grep: false,
  };

  constructor(app: App, plugin: AnotherQuickSwitcher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Another Quick Switcher - Settings" });

    this.addGeneralSettings(containerEl);
    this.addAppearanceSettings(containerEl);
    this.addHotKeysInDialogSettings(containerEl);
    this.addSearchSettings(containerEl);
    this.addHeaderSearchSettings(containerEl);
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
          })
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
          })
      );

    new Setting(containerEl)
      .setName("Normalize accents/diacritics")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.normalizeAccentsAndDiacritics
        ).onChange(async (value) => {
          this.plugin.settings.normalizeAccentsAndDiacritics = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });
    if (this.plugin.settings.normalizeAccentsAndDiacritics) {
      containerEl.createEl("div", {
        text: "⚠ If enabled, it is about 2 to 5 times slower than disabled",
        cls: "another-quick-switcher__settings__warning",
      });
    }
  }

  private addAppearanceSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "👁Appearance" });

    new Setting(containerEl).setName("Show directory").addToggle((tc) => {
      tc.setValue(this.plugin.settings.showDirectory).onChange(
        async (value) => {
          this.plugin.settings.showDirectory = value;
          await this.plugin.saveSettings();
          this.display();
        }
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
            }
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
            }
          );
        });
    }

    new Setting(containerEl).setName("Show aliases on top").addToggle((tc) => {
      tc.setValue(this.plugin.settings.showAliasesOnTop).onChange(
        async (value) => {
          this.plugin.settings.showAliasesOnTop = value;
          await this.plugin.saveSettings();
        }
      );
    });

    new Setting(containerEl)
      .setName("Show existing files only")
      .addToggle((tc) => {
        tc.setValue(this.plugin.settings.showExistingFilesOnly).onChange(
          async (value) => {
            this.plugin.settings.showExistingFilesOnly = value;
            await this.plugin.saveSettings();
          }
        );
      });

    new Setting(containerEl).setName("Hide gutter icons").addToggle((tc) => {
      tc.setValue(this.plugin.settings.hideGutterIcons).onChange(
        async (value) => {
          this.plugin.settings.hideGutterIcons = value;
          await this.plugin.saveSettings();
        }
      );
    });

    new Setting(containerEl).setName("Hide hotkey guides").addToggle((tc) => {
      tc.setValue(this.plugin.settings.hideHotkeyGuides).onChange(
        async (value) => {
          this.plugin.settings.hideHotkeyGuides = value;
          await this.plugin.saveSettings();
        }
      );
    });
  }

  private addHotKeysInDialogSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "⌨Hot keys in dialog" });

    new Setting(containerEl)
      .setName(
        "Use `alt 1～9` instead of `ctrl/cmd 1～9` for quick result selection"
      )
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.userAltInsteadOfModForQuickResultSelection
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
                const hk = string2Hotkey(value);
                dialog[command] = hk ? [hk] : [];
                await this.plugin.saveSettings();
              });
          });
      };

      Object.keys(this.plugin.settings.hotkeys[dialogKey]).forEach(
        (k: string) => {
          addHotKeyItem(k, k as keyof Hotkeys[keyof Hotkeys]);
        }
      );
    };

    const addHotkeysForDialog = (
      dialogKey: keyof Hotkeys,
      dialogName: string
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
        ". (Press any key and show 'event.key')"
      );

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
                : "chevron-down"
            )
            .setTooltip(
              this.hotkeyExpandedStatus[dialogKey] ? "fold" : "unfold"
            )
            .onClick(() => {
              this.hotkeyExpandedStatus[dialogKey] =
                !this.hotkeyExpandedStatus[dialogKey];
              this.display();
            })
        );
      addHotkeyItems(dialogKey, div);
    };

    addHotkeysForDialog("main", "Main dialog");
    addHotkeysForDialog("move", "Move dialog");
    addHotkeysForDialog("header", "Header dialog");
    addHotkeysForDialog("grep", "Grep dialog");
  }

  private addSearchSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "🔍 Search commands" });

    this.plugin.settings.searchCommands.forEach((_, i) => {
      this.addSearchCommandSetting(
        containerEl,
        this.plugin.settings.searchCommands[i]
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
            "another-quick-switcher__settings__search-command__add-button"
          )
          .onClick(async (_) => {
            this.plugin.settings.searchCommands.push(
              createDefaultSearchCommand()
            );
            this.display();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText("Save")
          .setTooltip(
            "You must click this button to save settings before closing Obsidian"
          )
          .setCta()
          .setClass(
            "another-quick-switcher__settings__search-command__save-button"
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
                0
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
        "It means your customized commands will be removed. If you reset unintentionally, you can restore the search commands by closing settings and Obsidian immediately, then restart Obsidian."
      )
      .addToggle((cb) => {
        cb.setValue(this.resetLock).onChange((lock) => {
          this.resetLock = lock;
          this.display();
        });
        if (this.resetLock) {
          cb.setTooltip(
            "Turn off the lock, if you want to reset all search commands"
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
  }

  private addSearchCommandSetting(
    containerEl: HTMLElement,
    command: SearchCommand
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
          "another-quick-switcher__settings__search-command__header__delete"
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
          "another-quick-switcher__settings__search-command__header__fold-button"
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
            command.searchBy!.tag ? buttonEnabledClass : buttonDisabledClass
          );
        };

        bc.setButtonText("Tag")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy!.tag = !command.searchBy!.tag;
            coloring();
          });
        coloring();
        return bc;
      })
      .addButton((bc) => {
        const coloring = () => {
          bc.buttonEl.removeClass(buttonEnabledClass, buttonDisabledClass);
          bc.buttonEl.addClass(
            command.searchBy!.header ? buttonEnabledClass : buttonDisabledClass
          );
        };

        bc.setButtonText("Header")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy!.header = !command.searchBy!.header;
            coloring();
          });
        coloring();
        return bc;
      })
      .addButton((bc) => {
        const coloring = () => {
          bc.buttonEl.removeClass(buttonEnabledClass, buttonDisabledClass);
          bc.buttonEl.addClass(
            command.searchBy!.link ? buttonEnabledClass : buttonDisabledClass
          );
        };

        bc.setButtonText("Link")
          .setClass(buttonClass)
          .onClick(async () => {
            command.searchBy!.link = !command.searchBy!.link;
            coloring();
          });
        coloring();
        return bc;
      });

    new Setting(div).setName("Search target").addDropdown((dc) => {
      dc.addOptions(mirror([...searchTargetList]))
        .setValue(command.searchTarget)
        .onChange(async (value) => {
          command.searchTarget = value as SearchTarget;
        });
    });

    new Setting(div)
      .setName("Target extensions")
      .setDesc(
        "If set, only files whose extension equals will be suggested. If empty, all files will be suggested. It can set multi extensions using comma."
      )
      .addTextArea((tc) =>
        tc
          .setPlaceholder("(ex: md,png,canvas)")
          .setValue(command.targetExtensions.join(","))
          .onChange(async (value) => {
            command.targetExtensions = smartCommaSplit(value);
          })
      );

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
          })
      );

    new Setting(div)
      .setName("Command prefix")
      .setDesc(
        "For example, if it sets ':r ', a query starts with ':r ' means that search as this command"
      )
      .addText((tc) =>
        tc
          .setValue(command.commandPrefix)
          .setPlaceholder("(ex: :r )")
          .onChange(async (value) => {
            command.commandPrefix = value;
          })
      );

    const df = document.createDocumentFragment();
    df.append(
      "Valid sort priorities refer to ",
      createEl("a", {
        text: "README",
        href: "https://github.com/tadashi-aikawa/obsidian-another-quick-switcher#sort-priorities",
      })
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
          "another-quick-switcher__settings__search-command__sort-priority"
        );
        return el;
      });

    new Setting(div)
      .setName("Include prefix path patterns")
      .setDesc(
        "If set, only files whose paths start with one of the patterns will be suggested. It can set multi patterns by line breaks. <current_dir> means current directory."
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
        "If set, files whose paths start with one of the patterns will not be suggested. It can set multi patterns by line breaks. <current_dir> means current directory."
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
          this.plugin.settings.autoPreviewInFloatingHeaderSearch
        ).onChange(async (value) => {
          this.plugin.settings.autoPreviewInFloatingHeaderSearch = value;
          await this.plugin.saveSettings();
        });
      });
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
          })
      );
  }

  private addMoveSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "📁 Move file to another folder" });

    new Setting(containerEl)
      .setName('Exclude prefix path patterns for "Move file to another folder"')
      .setDesc(
        "If set, folders whose paths start with one of the patterns will not be suggested. It can set multi patterns by line breaks"
      )
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(
            this.plugin.settings.moveFileExcludePrefixPathPatterns.join("\n")
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
  }

  private addDebugSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "Debug" });

    new Setting(containerEl)
      .setName("Show log about performance in a console")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.showLogAboutPerformanceInConsole
        ).onChange(async (value) => {
          this.plugin.settings.showLogAboutPerformanceInConsole = value;
          await this.plugin.saveSettings();
        });
      });
  }
}

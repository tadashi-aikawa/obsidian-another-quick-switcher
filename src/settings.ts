import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import AnotherQuickSwitcher from "./main";
import { mirrorMap } from "./utils/collection-helper";
import { SortPriority, sortPriorityList } from "./sorters";

const headerSearchFeatureList = [
  "navigate",
  "move to next/previous hit",
] as const;
export type HeaderSearchFeature = typeof headerSearchFeatureList[number];

export interface SearchCommand {
  name: string;
  defaultInput: string;
  commandPrefix: string;
  sortPriorities: SortPriority[];
  ignorePathPrefixPatterns: string[];
  isBacklinkSearch: boolean;
}

export interface Settings {
  searchFromHeaders: boolean;
  searchByLinks: boolean;
  searchDelayMilliSeconds: number;
  showDirectory: boolean;
  showDirectoryAtNewLine: boolean;
  showFullPathOfDirectory: boolean;
  showAliasesOnTop: boolean;
  showExistingFilesOnly: boolean;
  maxNumberOfSuggestions: number;
  normalizeAccentsAndDiacritics: boolean;
  hideGutterIcons: boolean;
  // Searches
  searchCommands: SearchCommand[];
  // Hotkey in search dialog
  userAltInsteadOfModForQuickResultSelection: boolean;
  // Back link search
  ignoreBackLinkPathPrefixPatterns: string;
  // Header search in file
  headerSearchKeyBindArrowUpDown: HeaderSearchFeature;
  headerSearchKeyBindTab: HeaderSearchFeature;
  headerSearchKeyBindVim: HeaderSearchFeature;
  headerSearchKeyBindEmacs: HeaderSearchFeature;
  // Move file to another folder
  ignoreMoveFileToAnotherFolderPrefixPatterns: string;
  // debug
  showLogAboutPerformanceInConsole: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  searchFromHeaders: true,
  searchByLinks: false,
  searchDelayMilliSeconds: 0,
  showDirectory: true,
  showDirectoryAtNewLine: false,
  showFullPathOfDirectory: false,
  showAliasesOnTop: false,
  showExistingFilesOnly: false,
  maxNumberOfSuggestions: 50,
  normalizeAccentsAndDiacritics: false,
  hideGutterIcons: false,
  userAltInsteadOfModForQuickResultSelection: false,
  // Searches
  searchCommands: [
    {
      name: "Recommended search",
      defaultInput: "",
      commandPrefix: "",
      sortPriorities: [
        "Perfect word match",
        "Prefix name match",
        "Name match",
        "Length",
        "Tag match",
        "Header match",
        "Link match",
        "Star",
        "Last opened",
        "Last modified",
      ],
      ignorePathPrefixPatterns: [],
      isBacklinkSearch: false,
    },
    {
      name: "Recent search",
      defaultInput: "",
      commandPrefix: ":r ",
      sortPriorities: [
        "Name match",
        "Tag match",
        "Header match",
        "Link match",
        "Last opened",
        "Last modified",
      ],
      ignorePathPrefixPatterns: [],
      isBacklinkSearch: false,
    },
    {
      name: "Title search",
      defaultInput: "",
      commandPrefix: ":t ",
      sortPriorities: [
        "Perfect word match",
        "Prefix name match",
        "Name match",
        "Length",
        "Last opened",
        "Last modified",
      ],
      ignorePathPrefixPatterns: [],
      isBacklinkSearch: false,
    },
    {
      name: "Star search",
      defaultInput: "",
      commandPrefix: ":s ",
      sortPriorities: ["Star", "Last opened", "Last modified"],
      ignorePathPrefixPatterns: [],
      isBacklinkSearch: false,
    },
  ],
  // Back link search
  ignoreBackLinkPathPrefixPatterns: "",
  // Header search in file
  headerSearchKeyBindArrowUpDown: "navigate",
  headerSearchKeyBindTab: "move to next/previous hit",
  headerSearchKeyBindVim: "navigate",
  headerSearchKeyBindEmacs: "navigate",
  // Move file to another folder
  ignoreMoveFileToAnotherFolderPrefixPatterns: "",
  // debug
  showLogAboutPerformanceInConsole: false,
};
export class AnotherQuickSwitcherSettingTab extends PluginSettingTab {
  plugin: AnotherQuickSwitcher;

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
    // TODO: remove
    this.addBacklinkSearchesSettings(containerEl);
    this.addHeaderSearchSettings(containerEl);
    this.addMoveSettings(containerEl);

    this.addDebugSettings(containerEl);
  }

  private addGeneralSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName("Search by headers").addToggle((tc) => {
      tc.setValue(this.plugin.settings.searchFromHeaders).onChange(
        async (value) => {
          this.plugin.settings.searchFromHeaders = value;
          await this.plugin.saveSettings();
          this.display();
        }
      );
    });
    if (this.plugin.settings.searchFromHeaders) {
      containerEl.createEl("div", {
        text: "⚠ If enabled, it is slower than disabled",
        cls: "another-quick-switcher__settings__warning",
      });
    }

    new Setting(containerEl).setName("Search by links").addToggle((tc) => {
      tc.setValue(this.plugin.settings.searchByLinks).onChange(
        async (value) => {
          this.plugin.settings.searchByLinks = value;
          await this.plugin.saveSettings();
          this.display();
        }
      );
    });
    if (this.plugin.settings.searchByLinks) {
      containerEl.createEl("div", {
        text: "⚠ If enabled, it is slower than disabled",
        cls: "another-quick-switcher__settings__warning",
      });
    }

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
  }

  private addSearchSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "🔍 Search commands" });

    this.plugin.settings.searchCommands.forEach((command, i) => {
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
              this.plugin.settings.searchCommands[i].name = value;
            });
          el.inputEl.setAttribute("style", "text-align: left");
          return el;
        })
        .addExtraButton((btn) => {
          btn
            .setTooltip("Delete a command")
            .setIcon("cross")
            .onClick(() => {
              this.plugin.settings.searchCommands.remove(command);
              this.display();
            });
          return btn;
        });
      new Setting(div)
        .setName("Default input")
        .setDesc("Default input strings when it opens the dialog")
        .addText((tc) =>
          tc
            .setValue(command.defaultInput)
            .setPlaceholder("(ex: #todo )")
            .onChange(async (value) => {
              this.plugin.settings.searchCommands[i].defaultInput = value;
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
              this.plugin.settings.searchCommands[i].commandPrefix = value;
            })
        );

      const df = document.createDocumentFragment();
      df.append(
        "Valid sort priorities refer to ",
        createEl("a", {
          text: "README",
          href: "https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/blob/master/README.md#%EF%B8%8Ffeatures",
        })
      );

      new Setting(div)
        .setName("Sort priorities")
        .setDesc(df)
        .addTextArea((tc) => {
          const el = tc
            .setPlaceholder("Sort priority")
            .setValue(command.sortPriorities.join("\n"))
            .onChange(async (value) => {
              const priorities = value.split("\n");
              this.plugin.settings.searchCommands[i].sortPriorities =
                priorities as SortPriority[];
            });
          el.inputEl.addClass(
            "another-quick-switcher__settings__search-command__sort-priority"
          );
          return el;
        });

      new Setting(div)
        .setName("Ignore prefix path patterns")
        .addTextArea((tc) => {
          const el = tc
            .setPlaceholder("Notes/Private")
            .setValue(command.ignorePathPrefixPatterns.join("\n"))
            .onChange(async (value) => {
              this.plugin.settings.searchCommands[i].ignorePathPrefixPatterns =
                value.split("\n");
            });
          el.inputEl.className =
            "another-quick-switcher__settings__ignore_path_patterns";

          return el;
        });
    });

    new Setting(containerEl)
      .addButton((btn) => {
        btn
          .setButtonText("Add a command")
          .setCta()
          .onClick(async (_) => {
            this.plugin.settings.searchCommands.push({
              name: "",
              defaultInput: "",
              commandPrefix: "",
              sortPriorities: [],
              ignorePathPrefixPatterns: [],
              isBacklinkSearch: false,
            });
            this.display();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(async (_) => {
            this.plugin.settings.searchCommands =
              this.plugin.settings.searchCommands.filter((x) => x.name);

            const invalidValues = this.plugin.settings.searchCommands
              .flatMap((x) => x.sortPriorities)
              .filter((x) => !sortPriorityList.includes(x as SortPriority));
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
  }

  private addBacklinkSearchesSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "👀 Backlink search" });

    new Setting(containerEl)
      .setName("Ignore prefix path patterns for Backlink search")
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(this.plugin.settings.ignoreBackLinkPathPrefixPatterns)
          .onChange(async (value) => {
            this.plugin.settings.ignoreBackLinkPathPrefixPatterns = value;
            await this.plugin.saveSettings();
          });
        el.inputEl.className =
          "another-quick-switcher__settings__ignore_path_patterns";
        return el;
      });
  }

  private addHeaderSearchSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "📰 Header search in file" });

    containerEl.createEl("h4", { text: "Hot keys in dialog" });

    new Setting(containerEl).setName("↑↓").addDropdown((tc) =>
      tc
        .addOptions(mirrorMap<string>([...headerSearchFeatureList], (x) => x))
        .setValue(this.plugin.settings.headerSearchKeyBindArrowUpDown)
        .onChange(async (value) => {
          this.plugin.settings.headerSearchKeyBindArrowUpDown =
            value as HeaderSearchFeature;
          await this.plugin.saveSettings();
        })
    );
    new Setting(containerEl).setName("Tab / Shift+Tab").addDropdown((tc) =>
      tc
        .addOptions(mirrorMap<string>([...headerSearchFeatureList], (x) => x))
        .setValue(this.plugin.settings.headerSearchKeyBindTab)
        .onChange(async (value) => {
          this.plugin.settings.headerSearchKeyBindTab =
            value as HeaderSearchFeature;
          await this.plugin.saveSettings();
        })
    );
    new Setting(containerEl)
      .setName("Ctrl+J / Ctrl+K (for Vimmer)")
      .addDropdown((tc) =>
        tc
          .addOptions(mirrorMap<string>([...headerSearchFeatureList], (x) => x))
          .setValue(this.plugin.settings.headerSearchKeyBindVim)
          .onChange(async (value) => {
            this.plugin.settings.headerSearchKeyBindVim =
              value as HeaderSearchFeature;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Ctrl+N / Ctrl+P (for Emacs user)")
      .addDropdown((tc) =>
        tc
          .addOptions(mirrorMap<string>([...headerSearchFeatureList], (x) => x))
          .setValue(this.plugin.settings.headerSearchKeyBindEmacs)
          .onChange(async (value) => {
            this.plugin.settings.headerSearchKeyBindEmacs =
              value as HeaderSearchFeature;
            await this.plugin.saveSettings();
          })
      );
  }

  private addMoveSettings(containerEl: HTMLElement) {
    containerEl.createEl("h3", { text: "📁 Move file to another folder" });

    new Setting(containerEl)
      .setName("Ignore prefix path patterns for Move file to another folder")
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(
            this.plugin.settings.ignoreMoveFileToAnotherFolderPrefixPatterns
          )
          .onChange(async (value) => {
            this.plugin.settings.ignoreMoveFileToAnotherFolderPrefixPatterns =
              value;
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

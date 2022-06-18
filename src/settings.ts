import { App, PluginSettingTab, Setting } from "obsidian";
import AnotherQuickSwitcher from "./main";
import { mirrorMap } from "./utils/collection-helper";

const headerSearchFeatureList = [
  "navigate",
  "move to next/previous hit",
] as const;
export type HeaderSearchFeature = typeof headerSearchFeatureList[number];

export interface Settings {
  showDirectory: boolean;
  showFullPathOfDirectory: boolean;
  showAliasesOnTop: boolean;
  showExistingFilesOnly: boolean;
  maxNumberOfSuggestions: number;
  normalizeAccentsAndDiacritics: boolean;
  hideGutterIcons: boolean;
  // Hotkey in search dialog
  userAltInsteadOfModForQuickResultSelection: boolean;
  // Normal search
  ignoreNormalPathPrefixPatterns: string;
  // Recent search
  ignoreRecentPathPrefixPatterns: string;
  // File name recent search
  ignoreFilenameRecentPathPrefixPatterns: string;
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
  showDirectory: true,
  showFullPathOfDirectory: false,
  showAliasesOnTop: false,
  showExistingFilesOnly: false,
  maxNumberOfSuggestions: 50,
  normalizeAccentsAndDiacritics: false,
  hideGutterIcons: false,
  userAltInsteadOfModForQuickResultSelection: false,
  // Normal search
  ignoreNormalPathPrefixPatterns: "",
  // Recent search
  ignoreRecentPathPrefixPatterns: "",
  // File name recent search
  ignoreFilenameRecentPathPrefixPatterns: "",
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
        .setName("Show full path of directory")
        .addToggle((tc) => {
          tc.setValue(this.plugin.settings.showFullPathOfDirectory).onChange(
            async (value) => {
              this.plugin.settings.showFullPathOfDirectory = value;
              await this.plugin.saveSettings();
              this.display();
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
      .setDesc("⚠ If enabled, it is about 2 to 5 times slower than disabled")
      .addToggle((tc) => {
        tc.setValue(
          this.plugin.settings.normalizeAccentsAndDiacritics
        ).onChange(async (value) => {
          this.plugin.settings.normalizeAccentsAndDiacritics = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName("Hide gutter icons").addToggle((tc) => {
      tc.setValue(this.plugin.settings.hideGutterIcons).onChange(
        async (value) => {
          this.plugin.settings.hideGutterIcons = value;
          await this.plugin.saveSettings();
        }
      );
    });

    containerEl.createEl("h4", { text: "Hot keys in dialog" });

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

    containerEl.createEl("h3", { text: "🔍 Normal search" });

    new Setting(containerEl)
      .setName("Ignore prefix path patterns for Normal search")
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(this.plugin.settings.ignoreNormalPathPrefixPatterns)
          .onChange(async (value) => {
            this.plugin.settings.ignoreNormalPathPrefixPatterns = value;
            await this.plugin.saveSettings();
          });
        el.inputEl.className =
          "another-quick-switcher__settings__ignore_path_patterns";
        return el;
      });

    containerEl.createEl("h3", { text: "⏱ Recent search" });

    new Setting(containerEl)
      .setName("Ignore prefix path patterns for Recent search")
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(this.plugin.settings.ignoreRecentPathPrefixPatterns)
          .onChange(async (value) => {
            this.plugin.settings.ignoreRecentPathPrefixPatterns = value;
            await this.plugin.saveSettings();
          });
        el.inputEl.className =
          "another-quick-switcher__settings__ignore_path_patterns";
        return el;
      });

    containerEl.createEl("h3", { text: "⏱ Filename recent search" });

    new Setting(containerEl)
      .setName("Ignore prefix path patterns for Filename Recent search")
      .addTextArea((tc) => {
        const el = tc
          .setPlaceholder("Prefix match patterns")
          .setValue(this.plugin.settings.ignoreFilenameRecentPathPrefixPatterns)
          .onChange(async (value) => {
            this.plugin.settings.ignoreFilenameRecentPathPrefixPatterns = value;
            await this.plugin.saveSettings();
          });
        el.inputEl.className =
          "another-quick-switcher__settings__ignore_path_patterns";
        return el;
      });

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

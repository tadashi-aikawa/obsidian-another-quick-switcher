import { App, PluginSettingTab, Setting } from "obsidian";
import AnotherQuickSwitcher from "./main";

export interface Settings {
  showDirectory: boolean;
  showExistingFilesOnly: boolean;
  maxNumberOfSuggestions: number;
  ignoreNormalPathPrefixPatterns: string;
  ignoreRecentPathPrefixPatterns: string;
  ignoreBackLinkPathPrefixPatterns: string;
}

export const DEFAULT_SETTINGS: Settings = {
  showDirectory: true,
  showExistingFilesOnly: false,
  maxNumberOfSuggestions: 50,
  ignoreNormalPathPrefixPatterns: "",
  ignoreRecentPathPrefixPatterns: "",
  ignoreBackLinkPathPrefixPatterns: "",
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
}

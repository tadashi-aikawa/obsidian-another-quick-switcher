import { App, PluginSettingTab, Setting } from "obsidian";
import SmartSearch from "./main";

export interface Settings {
  ignoreBackLinkPathPattern: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ignoreBackLinkPathPattern: "",
};

export class SmartSearchSettingTab extends PluginSettingTab {
  plugin: SmartSearch;

  constructor(app: App, plugin: SmartSearch) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Ignore backlink path pattern")
      .setDesc("A Ignore path pattern for Backlink search")
      .addText((tc) =>
        tc
          .setPlaceholder("Enter a RegExp pattern")
          .setValue(this.plugin.settings.ignoreBackLinkPathPattern)
          .onChange(async (value) => {
            this.plugin.settings.ignoreBackLinkPathPattern = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

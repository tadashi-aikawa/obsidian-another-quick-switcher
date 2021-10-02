import { App, PluginSettingTab, Setting } from "obsidian";
import AnotherQuickSwitcher from "./main";

export interface Settings {
  ignoreBackLinkPathPattern: string;
}

export const DEFAULT_SETTINGS: Settings = {
  ignoreBackLinkPathPattern: "",
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

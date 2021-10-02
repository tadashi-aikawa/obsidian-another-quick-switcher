import { Plugin } from "obsidian";
import { createCommands } from "./commands";
import { DEFAULT_SETTINGS, Settings, SmartSearchSettingTab } from "./settings";

export default class SmartSearch extends Plugin {
  settings: Settings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SmartSearchSettingTab(this.app, this));

    createCommands(this.app, this.settings).forEach((x) => this.addCommand(x));
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

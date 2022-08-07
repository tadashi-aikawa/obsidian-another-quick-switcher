import { Plugin } from "obsidian";
import { createCommands, showSearchDialog } from "./commands";
import {
  AnotherQuickSwitcherSettingTab,
  DEFAULT_SETTINGS,
  Settings,
} from "./settings";
import { AppHelper } from "./app-helper";

export default class AnotherQuickSwitcher extends Plugin {
  settings: Settings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AnotherQuickSwitcherSettingTab(this.app, this));
    this.reloadCommands();
  }

  reloadCommands() {
    const appHelper = new AppHelper(this.app);
    appHelper
      .getCommandIds(this.manifest.id)
      .forEach((x) => appHelper.removeCommand(x));
    createCommands(this.app, this.settings).forEach((x) => this.addCommand(x));
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

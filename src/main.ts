import { Plugin } from "obsidian";
import { createCommands } from "./commands";
import {
  AnotherQuickSwitcherSettingTab,
  createDefaultSearchCommand,
  DEFAULT_SETTINGS,
  Settings,
} from "./settings";
import { AppHelper } from "./app-helper";
import merge from "ts-deepmerge";

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

  async loadSettings(): Promise<void> {
    const currentSettings = await this.loadData();

    this.settings = merge.withOptions(
      { mergeArrays: false },
      DEFAULT_SETTINGS,
      currentSettings ?? {}
    );
    this.settings.searchCommands.forEach((_, i) => {
      this.settings.searchCommands[i] = merge.withOptions(
        { mergeArrays: false },
        createDefaultSearchCommand(),
        {
          ...this.settings.searchCommands[i],
        }
      );

      // @ts-ignore (v7 -> v8 backward compatibility)
      if (this.settings.searchCommands[i].searchTarget === "markdown") {
        this.settings.searchCommands[i].searchTarget = "file";
      }
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

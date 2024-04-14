import { Plugin } from "obsidian";
import { createCommands } from "./commands";
import {
  AnotherQuickSwitcherSettingTab,
  createDefaultHotkeys,
  createDefaultSearchCommand,
  DEFAULT_SETTINGS,
  Hotkeys,
  Settings,
} from "./settings";
import { AppHelper } from "./app-helper";
import merge from "ts-deepmerge";
import { Hotkey } from "./keys";

export default class AnotherQuickSwitcher extends Plugin {
  settings: Settings;
  appHelper: AppHelper;

  async onload() {
    this.appHelper = new AppHelper(this.app);
    await this.loadSettings();
    this.addSettingTab(new AnotherQuickSwitcherSettingTab(this.app, this));

    if (this.appHelper.isCacheInitialized()) {
      this.reloadCommands();
    } else {
      // Avoid referring to incorrect cache
      const cacheResolvedRef = this.app.metadataCache.on(
        "resolved",
        async () => {
          this.reloadCommands();
          this.app.metadataCache.offref(cacheResolvedRef);
        },
      );
    }
  }

  reloadCommands() {
    this.appHelper
      .getCommandIds(this.manifest.id)
      .forEach((x) => this.appHelper.removeCommand(x));
    createCommands(this.app, this.settings).forEach((x) => this.addCommand(x));
  }

  async loadSettings(): Promise<void> {
    const currentSettings = await this.loadData();

    this.settings = merge.withOptions(
      { mergeArrays: false },
      DEFAULT_SETTINGS,
      currentSettings ?? {},
    );

    this.settings.searchCommands.forEach((_, i) => {
      this.settings.searchCommands[i] = merge.withOptions(
        { mergeArrays: false },
        createDefaultSearchCommand(),
        {
          ...this.settings.searchCommands[i],
        },
      );

      // @ts-ignore (v7 -> v8 backward compatibility)
      if (this.settings.searchCommands[i].searchTarget === "markdown") {
        this.settings.searchCommands[i].searchTarget = "file";
      }
    });

    // for retrieve keys
    const defaultHotkeys = createDefaultHotkeys();
    // Clean old keys
    (Object.keys(defaultHotkeys) as (keyof Hotkeys)[]).forEach((dialogKey) => {
      Object.keys(this.settings.hotkeys[dialogKey]).forEach((k) => {
        if (!(k in defaultHotkeys[dialogKey])) {
          delete (
            this.settings.hotkeys[dialogKey] as { [key: string]: Hotkey[] }
          )[k];
        }
      });
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

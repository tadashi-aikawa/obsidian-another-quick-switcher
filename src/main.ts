import { Plugin } from "obsidian";
import merge from "ts-deepmerge";
import { AppHelper } from "./app-helper";
import { createCommands } from "./commands";
import type { Hotkey } from "./keys";
import {
  AnotherQuickSwitcherSettingTab,
  createDefaultHotkeys,
  createDefaultSearchCommand,
  DEFAULT_SETTINGS,
  type Hotkeys,
  type Settings,
} from "./settings";

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
    const commandIds = this.appHelper.getCommandIds(this.manifest.id);
    for (const x of commandIds) {
      this.appHelper.removeCommand(x);
    }

    const commands = createCommands(this.app, this.settings);
    for (const x of commands) {
      this.addCommand(x);
    }
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

      // @ts-expect-error (v7 -> v8 backward compatibility)
      if (this.settings.searchCommands[i].searchTarget === "markdown") {
        this.settings.searchCommands[i].searchTarget = "file";
      }
    });

    // for retrieve keys
    const defaultHotkeys = createDefaultHotkeys();
    // Clean old keys
    const defaultDialogKeys = Object.keys(defaultHotkeys) as (keyof Hotkeys)[];
    for (const dialogKey of defaultDialogKeys) {
      const dialogKeys = Object.keys(this.settings.hotkeys[dialogKey]);
      for (const k of dialogKeys) {
        if (!(k in defaultHotkeys[dialogKey])) {
          delete (
            this.settings.hotkeys[dialogKey] as { [key: string]: Hotkey[] }
          )[k];
        }
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

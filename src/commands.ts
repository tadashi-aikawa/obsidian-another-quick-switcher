import {
  Mode,
  AnotherQuickSwitcherModal,
} from "./ui/AnotherQuickSwitcherModal";
import { App, Command } from "obsidian";
import { Settings } from "./settings";

export function showSearchDialog(app: App, mode: Mode, settings: Settings) {
  const modal = new AnotherQuickSwitcherModal(app, mode, settings);
  modal.open();
}

export function createCommands(app: App, settings: Settings): Command[] {
  return [
    {
      id: "normal-search",
      name: "Normal search",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "p" }],
      callback: () => {
        showSearchDialog(app, "normal", settings);
      },
    },
    {
      id: "recent-search",
      name: "Recent search",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
      callback: () => {
        showSearchDialog(app, "recent", settings);
      },
    },
    {
      id: "backlink-search",
      name: "Backlink search",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "h" }],
      callback: () => {
        showSearchDialog(app, "backlink", settings);
      },
    },
  ];
}

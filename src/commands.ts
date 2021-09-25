import { Mode, SmartSearchModal } from "./ui/SmartSearchModal";
import { App, Command } from "obsidian";
import { Settings } from "./settings";

export function showSearchDialog(app: App, mode: Mode, settings: Settings) {
  const modal = new SmartSearchModal(app, mode, settings);
  modal.open();
}

export function createCommands(app: App, settings: Settings): Command[] {
  return [
    {
      id: "normal-search",
      name: "Normal search",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "p" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          showSearchDialog(app, "normal", settings);
        }
        return true;
      },
    },
    {
      id: "recent-search",
      name: "Recent search",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "e" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          showSearchDialog(app, "recent", settings);
        }
        return true;
      },
    },
    {
      id: "backlink-search",
      name: "Backlink search",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "h" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          showSearchDialog(app, "backlink", settings);
        }
        return true;
      },
    },
  ];
}

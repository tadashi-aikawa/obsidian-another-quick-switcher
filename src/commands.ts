import { Mode, SmartSearchModal } from "./ui/SmartSearchModal";
import { App, Command } from "obsidian";

export function showSearchDialog(app: App, mode: Mode) {
  const modal = new SmartSearchModal(app, mode);
  modal.open();
}

export function createCommands(app: App): Command[] {
  return [
    {
      id: "normal-search",
      name: "Normal search",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "p" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          showSearchDialog(app, "normal");
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
          showSearchDialog(app, "recent");
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
          showSearchDialog(app, "backlink");
        }
        return true;
      },
    },
  ];
}

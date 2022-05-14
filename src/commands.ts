import {
  AnotherQuickSwitcherModal,
  Mode,
} from "./ui/AnotherQuickSwitcherModal";
import { App, Command } from "obsidian";
import { Settings } from "./settings";
import { MoveModal } from "./ui/MoveModal";
import { HeaderModal } from "./ui/HeaderModal";

export function showSearchDialog(app: App, mode: Mode, settings: Settings) {
  const modal = new AnotherQuickSwitcherModal(app, mode, settings);
  modal.open();
}

export function showMoveDialog(app: App, settings: Settings) {
  if (!app.workspace.getActiveFile()) {
    return;
  }

  const modal = new MoveModal(app, settings);
  modal.open();
}

export function showHeaderDialog(
  app: App,
  settings: Settings,
  floating: boolean
) {
  if (!app.workspace.getActiveFile()) {
    return;
  }

  const modal = new HeaderModal(app, settings, floating);
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
      id: "filename-recent-search",
      name: "Filename recent search",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "f" }],
      callback: () => {
        showSearchDialog(app, "filename-recent", settings);
      },
    },
    {
      id: "star-recent-search",
      name: "Star recent search",
      hotkeys: [],
      callback: () => {
        showSearchDialog(app, "star-recent", settings);
      },
    },
    {
      id: "backlink-search",
      name: "Backlink search",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "h" }],
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }
        showSearchDialog(app, "backlink", settings);
      },
    },
    {
      id: "header-search-in-file",
      name: "Header search in file",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }
        showHeaderDialog(app, settings, false);
      },
    },
    {
      id: "header-floating-search-in-file",
      name: "Header floating search in file",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }
        showHeaderDialog(app, settings, true);
      },
    },
    {
      id: "move",
      name: "Move file to another folder",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }
        showMoveDialog(app, settings);
      },
    },
  ];
}

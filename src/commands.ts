import {
  type App,
  type Command,
  FileView,
  MarkdownView,
  Notice,
  Platform,
} from "obsidian";
import type { SearchCommand, Settings } from "./settings";
import { AnotherQuickSwitcherModal } from "./ui/AnotherQuickSwitcherModal";
import { BacklinkModal } from "./ui/BacklinkModal";
import { FolderModal } from "./ui/FolderModal";
import { GrepModal } from "./ui/GrepModal";
import { HeaderModal } from "./ui/HeaderModal";
import { InFileModal } from "./ui/InFileModal";
import { LinkModal } from "./ui/LinkModal";
import { MoveModal } from "./ui/MoveModal";
import { existsFd } from "./utils/fd";
import { existsRg } from "./utils/ripgrep";

const SEARCH_COMMAND_PREFIX = "search-command";

export function showSearchDialog(
  app: App,
  settings: Settings,
  command: SearchCommand,
) {
  const activeFileLeaf =
    app.workspace.getActiveViewOfType(FileView)?.leaf ?? null;
  const editor =
    app.workspace.getActiveViewOfType(MarkdownView)?.editor ?? null;

  const modal = new AnotherQuickSwitcherModal({
    app,
    settings,
    command,
    originFile: app.workspace.getActiveFile(),
    inputQuery: settings.useSelectionWordsAsDefaultInputQuery
      ? editor?.getSelection() || null // "" -> null
      : null,
    navigationHistories: [],
    currentNavigationHistoryIndex: 0,
    stackHistory: true,
    initialLeaf: activeFileLeaf,
  });
  modal.open();
}

export function showFolderDialog(app: App, settings: Settings) {
  const modal = new FolderModal(app, settings);
  modal.open();
}

export function showMoveDialog(app: App, settings: Settings) {
  if (!app.workspace.getActiveFile()) {
    return;
  }

  const modal = new MoveModal(app, settings);
  modal.open();
}

export async function showGrepDialog(
  app: App,
  settings: Settings,
  initialQuery?: string,
) {
  if (!Platform.isDesktop) {
    // noinspection ObjectAllocationIgnored
    new Notice("Grep is not supported on mobile.");
    return;
  }

  if (!(await existsRg(settings.ripgrepCommand))) {
    // noinspection ObjectAllocationIgnored
    new Notice(
      `"${settings.ripgrepCommand}" was not working as a ripgrep command. If you have not installed ripgrep yet, please install it.`,
    );
    return;
  }
  if (
    settings.includeFilenameInGrepSearch &&
    !(await existsFd(settings.fdCommand))
  ) {
    // noinspection ObjectAllocationIgnored
    new Notice(
      `"${settings.fdCommand}" was not working as a fd command. If you have not installed fd yet, please install it.`,
    );
    return;
  }

  const activeFileLeaf =
    app.workspace.getActiveViewOfType(FileView)?.leaf ?? null;

  const modal = new GrepModal(app, settings, activeFileLeaf, initialQuery);
  modal.open();
}

export async function showBacklinkDialog(app: App, settings: Settings) {
  if (!app.workspace.getActiveFile()) {
    return;
  }

  const activeFileLeaf =
    app.workspace.getActiveViewOfType(FileView)?.leaf ?? null;

  const modal = new BacklinkModal(app, settings, activeFileLeaf);
  await modal.init();
  modal.open();
}

export async function showLinkDialog(app: App, settings: Settings) {
  if (!app.workspace.getActiveFile()) {
    return;
  }

  const activeFileLeaf =
    app.workspace.getActiveViewOfType(FileView)?.leaf ?? null;

  const modal = new LinkModal(app, settings, activeFileLeaf);
  await modal.init();
  modal.open();
}

export async function showInFileDialog(app: App, settings: Settings) {
  if (!app.workspace.getActiveFile()) {
    return;
  }

  const modal = new InFileModal(app, settings);
  await modal.init();
  modal.open();
}

export function showHeaderDialog(
  app: App,
  settings: Settings,
  floating: boolean,
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
      id: "folder",
      name: "Reveal a folder in the file tree",
      hotkeys: [],
      callback: () => {
        showFolderDialog(app, settings);
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
    {
      id: "grep",
      name: "Grep",
      hotkeys: [],
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Platform.isDesktop;
        }

        showGrepDialog(app, settings);
      },
    },
    {
      id: "backlink",
      name: "Backlink search",
      hotkeys: [],
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }

        showBacklinkDialog(app, settings);
      },
    },
    {
      id: "link",
      name: "Link search",
      hotkeys: [],
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }

        showLinkDialog(app, settings);
      },
    },
    {
      id: "in-file-search",
      name: "In file search",
      hotkeys: [],
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveFile());
        }

        showInFileDialog(app, settings);
      },
    },
    ...settings.searchCommands.map((command) => {
      return {
        id: `${SEARCH_COMMAND_PREFIX}_${command.name
          .replace(/ /g, "-")
          .toLowerCase()}`,
        name: command.name,
        hotkeys: [],
        callback: () => {
          showSearchDialog(app, settings, command);
        },
      };
    }),
  ];
}

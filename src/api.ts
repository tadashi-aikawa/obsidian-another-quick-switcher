import { type App, FileView, type TFile } from "obsidian";
import type { SearchCommand, Settings } from "./settings";
import { AnotherQuickSwitcherModal } from "./ui/AnotherQuickSwitcherModal";

/**
 * Public API for Another Quick Switcher plugin.
 * This API allows external scripts (e.g., Templater) to programmatically
 * open the file picker dialog and retrieve the selected file(s).
 *
 * @example
 * ```javascript
 * // In Templater
 * const aqs = app.plugins.plugins['obsidian-another-quick-switcher'];
 * const files = await aqs.api.pickFile("Recent search");
 * if (files) {
 *   // files is TFile[]
 *   console.log(files.map(f => f.path));
 * }
 * ```
 */
export class AnotherQuickSwitcherAPI {
  constructor(
    private app: App,
    private settings: Settings,
  ) {}

  /**
   * Opens the file picker dialog with the specified search command and returns the selected file(s).
   *
   * @param commandName - The name of the search command to use (e.g., "Recent search", "File name search").
   *                      This must match a command name defined in Another Quick Switcher settings.
   * @param option - Optional parameters:
   *                 - `query`: An initial search query to pre-fill in the dialog's input box.
   * @returns A promise that resolves to:
   *          - `TFile[]` if file(s) are selected (single selection returns array with one element)
   *          - `null` if the dialog is cancelled
   * @throws {Error} If the specified command name is not found in settings
   *
   * @example
   * ```javascript
   * const files = await api.pickFile("Recent search");
   * if (files) {
   *   // User selected file(s)
   *   for (const file of files) {
   *     console.log(file.path);
   *   }
   * } else {
   *   // User cancelled
   * }
   * ```
   */
  async pickFile(
    commandName: string,
    option?: { query?: string },
  ): Promise<TFile[] | null> {
    const { query } = option ?? {};

    const command = this.findCommand(commandName);
    if (!command) {
      throw new Error(
        `Search command "${commandName}" not found. Available commands: ${this.getAvailableCommandNames().join(", ")}`,
      );
    }

    const activeFileLeaf =
      this.app.workspace.getActiveViewOfType(FileView)?.leaf ?? null;

    const modal = new AnotherQuickSwitcherModal({
      app: this.app,
      settings: this.settings,
      command,
      originFile: this.app.workspace.getActiveFile(),
      inputQuery: query ?? null,
      navigationHistories: [],
      currentNavigationHistoryIndex: 0,
      stackHistory: false,
      initialLeaf: activeFileLeaf,
    });

    return modal.openAndGetValue();
  }

  /**
   * Returns the list of available search command names.
   *
   * @returns Array of command names that can be used with `pickFile()`
   */
  getAvailableCommandNames(): string[] {
    return this.settings.searchCommands
      .filter((cmd) => cmd.name.trim().length > 0)
      .map((cmd) => cmd.name);
  }

  private findCommand(name: string): SearchCommand | undefined {
    return this.settings.searchCommands.find(
      (cmd) => cmd.name.trim() === name.trim(),
    );
  }
}

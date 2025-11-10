import { type App, type Command, Notice } from "obsidian";
import type { UnsafeApp } from "src/app-helper";
import { saveJson } from "src/apputils/io";
import { createInstructions, hotkey2String } from "src/keys";
import type { Hotkeys, Settings } from "src/settings";
import { maxReducer, sorter } from "src/utils/collection-helper";
import { microFuzzy } from "src/utils/strings";
import { now } from "src/utils/times";
import { isPresent } from "src/utils/types";
import { AbstractSuggestionModal } from "./AbstractSuggestionModal";

export type HistoricalCommand = Command & {
  lastUsed?: number;
  /* Display at the very top as the highest priorit */
  topPriority?: boolean;
};

type CommandId = string;
export interface CommandHistoryMap {
  lastUsedMap: { [id: CommandId]: number };
  queryUsedMap: { [query: string]: CommandId };
}

export class CommandQuickSwitcher extends AbstractSuggestionModal<HistoricalCommand> {
  query = "";
  app: UnsafeApp;

  constructor(
    app: App,
    private commands: HistoricalCommand[],
    private lastUsedMap: CommandHistoryMap["lastUsedMap"],
    private queryUsedMap: CommandHistoryMap["queryUsedMap"],
    private commandHistoryPath: string,
    public settings: Settings,
  ) {
    super(app);
    this.app = app as UnsafeApp;

    this.setHotkeys();
  }

  toKey(item: HistoricalCommand): string {
    return item.id;
  }

  getSuggestions(query: string): HistoricalCommand[] {
    this.query = query;
    return this.commands
      .map((command) => ({
        command:
          this.queryUsedMap[query] === command.id
            ? { ...command, topPriority: true }
            : command,
        results: query
          .split(" ")
          .filter(isPresent)
          .map((q) => microFuzzy(command.name.toLowerCase(), q.toLowerCase())),
      }))
      .filter(({ results }) => results.every((r) => r.type !== "none"))
      .map(({ command, results }) => ({
        command,
        result: results.reduce(maxReducer((x) => x.score)),
      }))
      .filter(({ result }) => result.type !== "none")
      .filter(
        ({ result }) =>
          !query || result.type !== "fuzzy" || result.score > 0.25,
      )
      .toSorted(sorter(({ result }) => result.score, "desc"))
      .toSorted(sorter(({ command }) => command.lastUsed ?? 0, "desc"))
      .toSorted(
        sorter(
          ({ result }) =>
            result.type === "includes" || result.type === "starts-with",
          "desc",
        ),
      )
      .toSorted(sorter(({ command }) => command.lastUsed != null, "desc"))
      .toSorted(sorter(({ command }) => command.topPriority ?? false, "desc"))
      .map(({ command }) => command);
  }

  renderSuggestion(item: HistoricalCommand, el: HTMLElement): void {
    const recordEl = createDiv({
      cls: [
        "another-quick-switcher__command-palette__item",
        item.lastUsed
          ? "another-quick-switcher__command-palette__item-lastused"
          : "",
        item.topPriority
          ? "another-quick-switcher__command-palette__item-top-priority"
          : "",
      ],
    });

    recordEl.appendChild(
      createDiv({
        text: item.name,
      }),
    );

    const hotkeys = this.app.hotkeyManager.getHotkeys(item.id);
    if (hotkeys) {
      const keysDiv = createDiv({
        cls: ["another-quick-switcher__command-palette__item__keys"],
      });
      for (const hk of hotkeys) {
        keysDiv.appendChild(
          createEl("kbd", {
            text: hotkey2String(hk),
            cls: ["another-quick-switcher__command-palette__item__key"],
          }),
        );
      }

      recordEl.appendChild(keysDiv);
    }

    el.appendChild(recordEl);
  }

  async onChooseSuggestion(item: HistoricalCommand) {
    item.callback?.() ?? item.checkCallback?.(false);

    this.lastUsedMap[item.id] = now();
    this.queryUsedMap[this.query] = item.id;
    await saveJson(
      this.commandHistoryPath,
      { lastUsedMap: this.lastUsedMap, queryUsedMap: this.queryUsedMap },
      {
        overwrite: true,
      },
    );
  }

  private registerKeys(
    key: keyof Hotkeys["command"],
    handler: () => void | Promise<void>,
  ) {
    for (const x of this.settings.hotkeys.command[key] ?? []) {
      this.scope.register(x.modifiers, x.key.toUpperCase(), (evt) => {
        evt.preventDefault();
        handler();
        return false;
      });
    }
  }

  private setHotkeys() {
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Escape")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "Home")!);
    this.scope.unregister(this.scope.keys.find((x) => x.key === "End")!);

    if (!this.settings.hideHotkeyGuides) {
      this.setInstructions([
        { command: "[↵]", purpose: "run" },
        { command: "[↑]", purpose: "up" },
        { command: "[↓]", purpose: "down" },
        ...createInstructions(this.settings.hotkeys.move),
      ]);
    }

    this.registerKeys("up", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    this.registerKeys("down", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
    });

    this.registerKeys("copy command id", async () => {
      const item = this.getSelectedItem();
      if (!item) {
        return;
      }

      await navigator.clipboard.writeText(item.id);
      new Notice(`Copied command ID to clipboard: ${item.id}`);
      this.close();
    });

    this.registerKeys("dismiss", async () => {
      this.close();
    });
  }
}

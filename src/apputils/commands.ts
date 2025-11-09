import type { Command } from "obsidian";
import type { UnsafeApp } from "src/app-helper";

declare let app: UnsafeApp;

/**
 * Retrieve a list of available commands.
 */
export function getAvailableCommands(): Command[] {
  return Object.values(app.commands.commands).filter(
    (x) => !x.checkCallback || x.checkCallback(true),
  );
}

/**
 * Find a command by its command ID.
 */
export function findCommandById(commandId: string): Command | null {
  return app.commands.commands[commandId] ?? null;
}

/**
 * Execute a command by its command ID.
 */
export function runCommandById(commandId: string): boolean {
  return app.commands.executeCommandById(commandId);
}

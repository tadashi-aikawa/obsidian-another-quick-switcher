import type { UnsafeApp } from "src/app-helper";
import { map } from "src/utils/guard";

declare let app: UnsafeApp;

/**
 * Check whether the specified path (file or directory) exists.
 *
 * ```ts
 * await exists("Notes/hoge.md")
 * // true
 */
export function exists(path: string): Promise<boolean> {
  return app.vault.adapter.exists(path);
}

/**
 * Retrieve the contents of a file and return null if the provided path does not exist.
 *
 * ```ts
 * await loadFile("Notes/Obsidian.md")
 * //  "Obsidian is Great\nagain"
 * ```
 */
export async function loadFile(path: string): Promise<string | null> {
  if (!(await exists(path))) {
    return null;
  }
  return app.vault.adapter.read(path);
}

/**
 * Load JSON file
 * ```ts
 * await loadJson("settings.json")
 * // { sync: true }
 * ```
 */
export async function loadJson<T>(path: string): Promise<T | null> {
  return map(await loadFile(path), (content) => JSON.parse(content) as T);
}

/**
 * Write data to a file.
 * ```ts
 * await saveFile("Notes/Obsidian.md", "Great editor")
 * await saveFile("Notes/Obsidian.md", "Great editor", { overwrite: true }) // Allow overwriting the file
 * ```
 */
export async function saveFile(
  path: string,
  data: string,
  option?: { overwrite?: boolean },
): Promise<void> {
  if (!option?.overwrite && (await exists(path))) {
    throw new Error(
      `Cannot overwrite because the file already exists: ${path}`,
    );
  }
  app.vault.adapter.write(path, data);
}

/**
 * Write a JSON file.
 * ```ts
 * await saveJson("settings.json", { sync: true })
 * await saveJson("settings.json", { sync: true }, { overwrite: true }) // Allow overwriting the file
 * ```
 */
export async function saveJson<T>(
  path: string,
  data: T,
  option?: { overwrite?: boolean },
): Promise<void> {
  await saveFile(path, JSON.stringify(data), option);
}

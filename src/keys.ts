import { Instruction, Modifier, Platform } from "obsidian";
import { equalsAsSet } from "./utils/collection-helper";

export const MOD = Platform.isMacOS ? "Cmd" : "Ctrl";
export const ALT = Platform.isMacOS ? "Option" : "Alt";

export const quickResultSelectionModifier = (
  userAltInsteadOfModForQuickResultSelection: boolean
) => (userAltInsteadOfModForQuickResultSelection ? ALT : MOD);

export type Hotkey = { modifiers: Modifier[]; key: string };

export function hotkey2String(hotKey?: Hotkey): string {
  if (!hotKey) {
    return "";
  }
  const mods = hotKey.modifiers.join(" ");
  return mods ? `${mods} ${hotKey.key}` : hotKey.key;
}

export function string2Hotkey(hotKey: string): Hotkey | null {
  const keys = hotKey.split(" ");
  if (keys.length === 1) {
    return keys[0] === "" ? null : { modifiers: [], key: keys[0] };
  }
  return {
    modifiers: keys.slice(0, -1) as Modifier[],
    key: keys.at(-1) as Modifier,
  };
}

export function createInstructions(hotkeysByComand: {
  [key: string]: Hotkey[];
}): Instruction[] {
  return Object.keys(hotkeysByComand)
    .filter((x) => hotkeysByComand[x].length > 0)
    .map((x) => createInstruction(x, hotkeysByComand[x][0]))
    .filter((x) => x !== null) as Instruction[];
}

function createInstruction(
  commandName: string,
  hotKey?: Hotkey
): Instruction | null {
  if (!hotKey) {
    return null;
  }
  const mods = hotKey.modifiers
    .map((x) => (x === "Mod" ? MOD : x === "Alt" ? ALT : x))
    .join(" ");
  const key =
    hotKey.key === "Enter"
      ? "↵"
      : hotKey.key === "ArrowUp"
      ? "↑"
      : hotKey.key === "ArrowDown"
      ? "↓"
      : hotKey.key;
  const command = mods ? `[${mods} ${key}]` : `[${key}]`;
  return { command, purpose: commandName };
}

export function equalsAsHotkey(
  hotkey: Hotkey,
  keyDownEvent: KeyboardEvent
): boolean {
  const hk: Hotkey = { modifiers: [], key: keyDownEvent.key };
  if (keyDownEvent.shiftKey) {
    hk.modifiers.push("Shift");
  }
  if (keyDownEvent.altKey) {
    hk.modifiers.push("Alt");
  }
  if (keyDownEvent.ctrlKey) {
    hk.modifiers.push(Platform.isMacOS ? "Ctrl" : "Mod");
  }
  if (keyDownEvent.metaKey) {
    hk.modifiers.push(Platform.isMacOS ? "Mod" : "Meta");
  }

  return (
    hotkey.key.toLowerCase() === hk.key.toLowerCase() &&
    equalsAsSet(hotkey.modifiers, hk.modifiers)
  );
}

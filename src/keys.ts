import { type Instruction, type Modifier, Platform } from "obsidian";
import { equalsAsSet } from "./utils/collection-helper";

export const MOD = Platform.isMacOS ? "Cmd" : "Ctrl";
export const ALT = Platform.isMacOS ? "Option" : "Alt";

export const quickResultSelectionModifier = (
  userAltInsteadOfModForQuickResultSelection: boolean,
) => (userAltInsteadOfModForQuickResultSelection ? ALT : MOD);

export type Hotkey = {
  modifiers: Modifier[];
  key: string;
  hideHotkeyGuide?: boolean;
};

export function hotkey2String(hotkey?: Hotkey): string {
  if (!hotkey) {
    return "";
  }
  const mods = hotkey.modifiers.join(" ");
  return mods ? `${mods} ${hotkey.key}` : hotkey.key;
}

export function string2Hotkey(
  hotKey: string,
  hideHotkeyGuide: boolean,
): Hotkey | null {
  const keys = hotKey.split(" ");
  if (keys.length === 1) {
    return keys[0] === ""
      ? null
      : { modifiers: [], key: keys[0], hideHotkeyGuide };
  }
  return {
    modifiers: keys.slice(0, -1) as Modifier[],
    key: keys.at(-1) as Modifier,
    hideHotkeyGuide,
  };
}

export function createInstructions(hotkeysByCommand: {
  [key: string]: Hotkey[];
}): Instruction[] {
  return Object.keys(hotkeysByCommand)
    .filter((x) => hotkeysByCommand[x].length > 0)
    .map((x) => createInstruction(x, hotkeysByCommand[x][0]))
    .filter((x) => x !== null) as Instruction[];
}

export function createInstruction(
  commandName: string,
  hotkey?: Hotkey,
): Instruction | null {
  if (!hotkey || hotkey.hideHotkeyGuide) {
    return null;
  }
  const mods = hotkey.modifiers
    .map((x) => (x === "Mod" ? MOD : x === "Alt" ? ALT : x))
    .join(" ");
  const key =
    hotkey.key === "Enter"
      ? "↵"
      : hotkey.key === "ArrowUp"
        ? "↑"
        : hotkey.key === "ArrowDown"
          ? "↓"
          : hotkey.key === "Escape"
            ? "ESC"
            : hotkey.key;
  const command = mods ? `[${mods} ${key}]` : `[${key}]`;
  return { command, purpose: commandName };
}

export function equalsAsHotkey(
  hotkey: Hotkey,
  keyDownEvent: KeyboardEvent,
): boolean {
  const hk: Hotkey = {
    modifiers: [],
    key: normalizeHotkeyEventKey(keyDownEvent.key),
  };
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

function normalizeHotkeyEventKey(key: string): string {
  return key === " " ? "Space" : key;
}

export function normalizeKey(hotkey: string): string {
  return hotkey === "Space" ? " " : hotkey;
}

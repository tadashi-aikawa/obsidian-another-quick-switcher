import { Platform } from "obsidian";

export const MOD = Platform.isMacOS ? "cmd" : "ctrl";
export const quickResultSelectionModifier = (
  userAltInsteadOfModForQuickResultSelection: boolean
) => (userAltInsteadOfModForQuickResultSelection ? "alt" : MOD);

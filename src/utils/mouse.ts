import { Platform } from "obsidian";
import type { LeafType } from "../app-helper";

export function isModifierClick(evt: MouseEvent): boolean {
  return evt.ctrlKey || (Platform.isMacOS && evt.metaKey);
}

export function toLeafType(evt: MouseEvent): LeafType {
  return isModifierClick(evt) ? "new-tab" : "same-tab";
}

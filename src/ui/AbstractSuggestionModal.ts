import { SuggestModal } from "obsidian";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";

export abstract class AbstractSuggestionModal<T>
  extends SuggestModal<T>
  implements UnsafeModalInterface<T>
{
  selectedItemMap: { [key: string]: T } = {};
  abstract toKey(item: T): string;

  // unofficial
  isOpen: boolean;
  updateSuggestions: () => unknown;
  chooser: UnsafeModalInterface<T>["chooser"];
  scope: UnsafeModalInterface<T>["scope"];

  getItems(): T[] | null {
    return this.chooser.values ?? null;
  }

  getSelectedItem(): T | null {
    return this.getItems()?.[this.chooser.selectedItem] ?? null;
  }

  getSelectedElement(): HTMLElement | null {
    return (
      (this.chooser.suggestions?.[this.chooser.selectedItem] as HTMLElement) ??
      null
    );
  }

  getSelected(): { item: T | null; element: HTMLElement | null } {
    return {
      item: this.getSelectedItem(),
      element: this.getSelectedElement(),
    };
  }

  selectNextItem(): void {
    this.chooser.setSelectedItem(this.chooser.selectedItem + 1);
  }

  getCheckedItems(): T[] {
    return Object.values(this.selectedItemMap);
  }

  async actionMultiItems(
    action: (item: T, mode: "select" | "check") => Promise<unknown> | unknown,
    actionIfItemNotSelected?: () => Promise<void> | unknown,
  ): Promise<void> {
    const items = this.getCheckedItems();
    if (items.length > 0) {
      for (const item of items) {
        await action(item, "check");
      }
      return;
    }

    const item = this.getSelectedItem();
    if (!item) {
      if (actionIfItemNotSelected) {
        await actionIfItemNotSelected();
      }
      return;
    }

    action(item, "select");
  }

  async toggleCheckedItem(option?: { moveNext?: boolean }) {
    const { item, element } = this.getSelected();
    if (!item || !element) {
      return;
    }

    const path = this.toKey(item);
    if (this.selectedItemMap[path]) {
      delete this.selectedItemMap[path];
    } else {
      this.selectedItemMap[path] = item;
    }

    // Clear element
    element.empty();
    this.renderSuggestion(item, element as HTMLElement);

    if (option?.moveNext) {
      this.selectNextItem();
    }
  }

  checkAll(): void {
    this.selectedItemMap = {};
    for (const item of this.chooser.values ?? []) {
      const path = this.toKey(item);
      this.selectedItemMap[path] = item;
    }
    this.updateSuggestions();
  }

  uncheckAll(): void {
    this.selectedItemMap = {};
    this.updateSuggestions();
  }
}

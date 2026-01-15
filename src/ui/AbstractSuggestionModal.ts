import { SuggestModal } from "obsidian";
import type { AppHelper } from "src/app-helper";
import type { UnsafeModalInterface } from "./UnsafeModalInterface";

export abstract class AbstractSuggestionModal<T>
  extends SuggestModal<T>
  implements UnsafeModalInterface<T>
{
  appHelper: AppHelper;

  // unofficial
  isOpen: boolean;
  updateSuggestions: () => unknown;
  chooser: UnsafeModalInterface<T>["chooser"];
  scope: UnsafeModalInterface<T>["scope"];

  getItems(): T[] | null {
    return this.chooser.values ?? null;
  }

  // ╭─────────────────────────────────────────────────────────╮
  // │                      Multi select                       │
  // ╰─────────────────────────────────────────────────────────╯

  selectedItemMap: { [key: string]: T } = {};
  protected checkedCountEl?: HTMLDivElement;
  abstract toKey(item: T): string;

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

  protected scheduleRecentHistoryRestore(snapshot: string[] | null) {
    if (!snapshot) {
      return;
    }
    const restore = () => this.appHelper.restoreLastOpenFilesSnapshot(snapshot);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        setTimeout(restore, 0);
      });
      return;
    }
    setTimeout(restore, 0);
  }

  protected buildRecentHistoryForFinalOpen(
    snapshot: string[] | null,
    basePath: string | null,
    finalPath: string,
  ): string[] | null {
    if (!snapshot) {
      return null;
    }
    // Keep the pre-dialog file right after the chosen file, skipping preview-only entries.
    const next = snapshot.filter(
      (path) => path !== finalPath && path !== basePath,
    );
    if (basePath && basePath !== finalPath) {
      next.unshift(basePath);
    }
    next.unshift(finalPath);
    return next;
  }

  selectNextItem(): void {
    this.chooser.setSelectedItem(this.chooser.selectedItem + 1);
  }

  getCheckedItems(): T[] {
    return Object.values(this.selectedItemMap);
  }

  protected renderCheckedCountBadge(
    cls: string,
    containerEl: HTMLElement,
  ): void {
    this.checkedCountEl?.remove();
    this.checkedCountEl = createDiv({
      cls: [
        "another-quick-switcher__checked-count-badge",
        "another-quick-switcher__checked-count-badge--hidden",
        cls,
      ],
    });
    containerEl.appendChild(this.checkedCountEl);
    this.updateCheckedCountBadge();
  }

  protected updateCheckedCountBadge(): void {
    if (!this.checkedCountEl) {
      return;
    }
    const count = Object.keys(this.selectedItemMap).length;
    if (count === 0) {
      this.checkedCountEl.classList.add(
        "another-quick-switcher__checked-count-badge--hidden",
      );
      this.checkedCountEl.textContent = "";
      return;
    }
    this.checkedCountEl.classList.remove(
      "another-quick-switcher__checked-count-badge--hidden",
    );
    this.checkedCountEl.textContent = String(count);
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
    this.updateCheckedCountBadge();

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
    this.updateCheckedCountBadge();
  }

  uncheckAll(): void {
    this.selectedItemMap = {};
    this.updateSuggestions();
    this.updateCheckedCountBadge();
  }

  // ╭─────────────────────────────────────────────────────────╮
  // │             Enable scroll on floating modal             │
  // ╰─────────────────────────────────────────────────────────╯

  private floatingModalBg?: HTMLElement;
  private floatingWheelHandler?: (evt: WheelEvent) => void;
  private lastPreviewScrollAt = 0;

  private getScrollElementFromActiveLeaf(): HTMLElement | null {
    const markdownView = this.appHelper.getMarkdownViewInActiveLeaf();
    if (!markdownView) {
      return null;
    }

    return markdownView.getMode() === "preview"
      ? markdownView.contentEl.querySelector<HTMLElement>(
          ".markdown-preview-view",
        )
      : markdownView.contentEl.querySelector<HTMLElement>(".cm-scroller");
  }

  protected scrollActiveLeafByPage(direction: "up" | "down") {
    const scrollEl = this.getScrollElementFromActiveLeaf();
    if (!scrollEl) {
      return;
    }

    const step = Math.max(80, Math.floor(scrollEl.clientHeight * 0.25));
    const now = Date.now();
    const isRapidRepeat = now - this.lastPreviewScrollAt <= 120;
    this.lastPreviewScrollAt = now;
    const prefersReduceMotion = activeWindow.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollEl.scrollBy({
      top: direction === "down" ? step : -step,
      left: 0,
      behavior: prefersReduceMotion || isRapidRepeat ? "auto" : "smooth",
    });
  }

  //hoge
  enableFloatingModalWheelScroll() {
    const modalBg =
      activeWindow.activeDocument.querySelector<HTMLElement>(".modal-bg");
    if (!modalBg) {
      return;
    }

    const findScrollElFromPoint = (evt: WheelEvent): HTMLElement | null => {
      const elements = activeWindow.activeDocument.elementsFromPoint(
        evt.clientX,
        evt.clientY,
      );
      for (const element of elements) {
        if (element.closest(".modal, .prompt, .modal-bg")) {
          continue;
        }

        const scrollCandidate = element.closest<HTMLElement>(
          ".markdown-preview-view, .cm-scroller",
        );
        if (!scrollCandidate) {
          continue;
        }

        if (
          scrollCandidate.classList.contains("cm-scroller") &&
          !scrollCandidate.closest(".markdown-source-view")
        ) {
          continue;
        }

        return scrollCandidate;
      }
      return null;
    };

    const handler = (evt: WheelEvent) => {
      if (this.modalEl?.contains(evt.target as Node)) {
        return;
      }

      const scrollEl =
        findScrollElFromPoint(evt) ?? this.getScrollElementFromActiveLeaf();
      if (!scrollEl) {
        return;
      }

      if (evt.deltaX === 0 && evt.deltaY === 0) {
        return;
      }

      scrollEl.scrollBy({
        left: evt.deltaX,
        top: evt.deltaY,
        behavior: "auto",
      });
    };

    modalBg.addEventListener("wheel", handler, { passive: true });
    this.floatingModalBg = modalBg;
    this.floatingWheelHandler = handler;
  }

  disableFloatingModalWheelScroll() {
    if (this.floatingModalBg && this.floatingWheelHandler) {
      this.floatingModalBg.removeEventListener(
        "wheel",
        this.floatingWheelHandler,
      );
    }
    this.floatingModalBg = undefined;
    this.floatingWheelHandler = undefined;
  }
}

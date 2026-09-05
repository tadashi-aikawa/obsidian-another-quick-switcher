import { Platform, type SuggestModal } from "obsidian";
import type { AppHelper } from "../app-helper";
import { createCrossIcon } from "./icons";

/**
 * Adds a small button at the left edge of the input on mobile, which clears
 * the query, or closes the modal when the query is already empty (the same
 * behavior as the dismiss button of the core Quick switcher). Mobile has no
 * ESC key, so Obsidian soft-locks when a picker shows no results without it.
 * https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/331
 */
export function addMobileDismissButton(modal: SuggestModal<unknown>): void {
  if (!Platform.isMobile) {
    return;
  }

  modal.modalEl.addClass("another-quick-switcher__mobile-dismissable");

  const buttonEl = createEl("button", {
    // clickable-icon exempts it from the `.is-tablet button:not(.clickable-icon)`
    // padding of Obsidian core and gives it the standard icon-button look
    cls: ["another-quick-switcher__mobile-dismiss-button", "clickable-icon"],
    attr: { type: "button", "aria-label": "Clear input or dismiss" },
  });
  buttonEl.appendChild(createCrossIcon());
  buttonEl.addEventListener("click", () => {
    // GrepModal replaces the visible input with a clone of inputEl,
    // so look up the live element instead of using modal.inputEl directly
    const inputEl =
      modal.modalEl.querySelector<HTMLInputElement>("input.prompt-input") ??
      modal.inputEl;
    if (inputEl.value === "") {
      modal.close();
      return;
    }
    inputEl.value = "";
    inputEl.dispatchEvent(new Event("input"));
    inputEl.focus();
  });

  (modal.inputEl.parentElement ?? modal.modalEl).appendChild(buttonEl);
}

type SetFloatingModalOption = {
  allowNonMarkdownReposition?: boolean;
};

export function setFloatingModal(
  appHelper: AppHelper,
  option: SetFloatingModalOption = {},
) {
  activeWindow.activeDocument
    .querySelector(".modal-bg")
    ?.addClass("another-quick-switcher__floating-modal-bg");

  const promptEl =
    activeWindow.activeDocument.querySelector<HTMLElement>(".prompt");
  promptEl?.addClass("another-quick-switcher__floating-prompt");

  const fileView = appHelper.getFileViewInActiveLeaf();

  if (!fileView || !promptEl) {
    return;
  }

  const promptDataset = promptEl.dataset as DOMStringMap & {
    aqsFloatingAnchorY?: string;
    aqsFloatingPositioned?: string;
  };
  const markdownView = appHelper.getMarkdownViewInActiveLeaf();
  let anchorContentEl: Element | null;

  if (markdownView) {
    const viewState = fileView.getState?.();
    const selector =
      viewState?.mode === "preview" ? ".markdown-preview-sizer" : ".cm-sizer";
    anchorContentEl = fileView.contentEl.querySelector(selector);
    if (!anchorContentEl) {
      return;
    }
  } else if (
    option.allowNonMarkdownReposition ||
    promptDataset.aqsFloatingPositioned !== "true"
  ) {
    anchorContentEl = fileView.contentEl;
  } else {
    return;
  }

  const windowWidth = activeWindow.innerWidth;
  const windowHeight = activeWindow.innerHeight;

  const modalEl = activeWindow.activeDocument.querySelector(
    ".another-quick-switcher__floating-prompt",
  );
  if (!modalEl) {
    console.error("Unexpected error.");
    return;
  }

  const { width: modalWidth, height: modalHeight } =
    modalEl.getBoundingClientRect();
  const { x: contentX, width: contentWidth } =
    anchorContentEl.getBoundingClientRect();
  const { y: leafY } = fileView.containerEl.getBoundingClientRect();
  const promptY =
    promptDataset.aqsFloatingAnchorY != null
      ? Number(promptDataset.aqsFloatingAnchorY)
      : promptEl.getBoundingClientRect().y;
  promptDataset.aqsFloatingAnchorY = String(promptY);

  const contentXEnd = contentX + contentWidth;
  const left =
    windowWidth - contentXEnd - 30 > modalWidth
      ? contentXEnd - 30
      : contentX - modalWidth - 30 > 0
        ? contentX - modalWidth
        : windowWidth - modalWidth - 30;
  const top = Math.min(windowHeight - modalHeight - 10, leafY + promptY);

  promptEl.setAttribute("style", `left: ${left}px; top: ${top}px`);
  promptDataset.aqsFloatingPositioned = "true";
}

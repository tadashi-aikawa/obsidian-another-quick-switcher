import type { AppHelper } from "../app-helper";

export function setFloatingModal(appHelper: AppHelper) {
  activeWindow.activeDocument
    .querySelector(".modal-bg")
    ?.addClass("another-quick-switcher__floating-modal-bg");

  const promptEl = activeWindow.activeDocument.querySelector(".prompt");
  promptEl?.addClass("another-quick-switcher__floating-prompt");

  const fileView = appHelper.getFileViewInActiveLeaf();

  if (fileView) {
    const windowWidth = activeWindow.innerWidth;
    const windowHeight = activeWindow.innerHeight;

    const modalEl = activeWindow.activeDocument.querySelector(
      ".another-quick-switcher__floating-prompt",
    );
    if (!modalEl) {
      console.error("Unexpected error.");
      return;
    }

    const viewState = fileView.getState?.();
    const selector =
      viewState?.mode === "preview" ? ".markdown-preview-sizer" : ".cm-sizer";
    const editorContentEl =
      fileView.contentEl.querySelector(selector) ?? fileView.contentEl;

    const { width: modalWidth, height: modalHeight } =
      modalEl.getBoundingClientRect();
    const { x: contentX, width: contentWidth } =
      editorContentEl.getBoundingClientRect();
    const { y: leafY } = fileView.containerEl.getBoundingClientRect();
    const promptDataset = (promptEl as HTMLElement).dataset as DOMStringMap & {
      aqsFloatingAnchorY?: string;
    };
    const promptY =
      promptDataset.aqsFloatingAnchorY != null
        ? Number(promptDataset.aqsFloatingAnchorY)
        : promptEl!.getBoundingClientRect().y;
    promptDataset.aqsFloatingAnchorY = String(promptY);

    const contentXEnd = contentX + contentWidth;
    const left =
      windowWidth - contentXEnd - 30 > modalWidth
        ? contentXEnd - 30
        : contentX - modalWidth - 30 > 0
          ? contentX - modalWidth
          : windowWidth - modalWidth - 30;
    const top = Math.min(windowHeight - modalHeight - 10, leafY + promptY);

    promptEl?.setAttribute("style", `left: ${left}px; top: ${top}px`);
  }
}

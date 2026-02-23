import type { AppHelper } from "../app-helper";

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

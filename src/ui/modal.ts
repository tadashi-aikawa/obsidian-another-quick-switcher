import { AppHelper } from "../app-helper";

export function setFloatingModal(appHelper: AppHelper, modalOffsetWidth: number, modalOffsetHeight: number) {
  activeWindow.activeDocument
    .querySelector(".modal-bg")
    ?.addClass("another-quick-switcher__floating-modal-bg");

  const promptEl = activeWindow.activeDocument.querySelector(".prompt");
  promptEl?.addClass("another-quick-switcher__floating-prompt");

  const fileView = appHelper.getFileViewInActiveLeaf();

  if (fileView) {
    const windowWidth = activeWindow.innerWidth;
    const windowHeight = activeWindow.innerHeight;
    const modalWidth = modalOffsetWidth;
    const modalHeight = modalOffsetHeight;
    const {
      x: leafX,
      y: leafY,
      width: leafWidth,
    } = fileView.containerEl.getBoundingClientRect();
    const { y: promptY } = promptEl!.getBoundingClientRect();

    const left = Math.min(
      windowWidth - modalWidth - 30,
      leafX + leafWidth / 1.5
    );
    const top = Math.min(windowHeight - modalHeight - 10, leafY + promptY);

    promptEl?.setAttribute("style", `left: ${left}px; top: ${top}px`);
  }
}
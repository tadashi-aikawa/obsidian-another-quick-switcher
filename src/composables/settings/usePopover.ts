type RegisterCleanup = (cleanup: () => void) => void;

type PopoverOptions = {
  wrapperClass?: string;
  contentClass?: string;
  openClass?: string;
  spacing?: number;
  closeDelayMs?: number;
};

type PopoverControls = {
  createPopover: (
    triggerEl: HTMLElement,
    contentEl: HTMLElement,
  ) => DocumentFragment;
};

export const usePopover = (
  registerCleanup: RegisterCleanup,
  options: PopoverOptions = {},
): PopoverControls => {
  const {
    wrapperClass = "another-quick-switcher__settings__popup",
    contentClass = "another-quick-switcher__settings__popup__content",
    openClass = "is-open",
    spacing = 6,
    closeDelayMs = 80,
  } = options;

  const createPopover = (
    triggerEl: HTMLElement,
    contentEl: HTMLElement,
  ): DocumentFragment => {
    const df = document.createDocumentFragment();
    const wrapper = createDiv({
      cls: wrapperClass,
    });

    const popover = createDiv({
      cls: contentClass,
    });
    popover.append(contentEl);

    document.body.append(popover);
    wrapper.append(triggerEl);

    let isOpen = false;
    let pinned = false;
    let isHovering = false;
    let isFocused = false;
    let hoverCloseTimer: number | null = null;

    const onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!wrapper.contains(target) && !popover.contains(target)) {
        pinned = false;
        updateOpenState();
        document.removeEventListener(
          "pointerdown",
          onDocumentPointerDown,
          true,
        );
      }
    };

    const updatePosition = () => {
      const rect = triggerEl.getBoundingClientRect();
      const top = rect.bottom + spacing + window.scrollY;
      let left = rect.left + window.scrollX;
      const viewportWidth = document.documentElement.clientWidth;
      const minLeft = window.scrollX + 8;
      const maxLeft = window.scrollX + viewportWidth - popover.offsetWidth - 8;
      if (Number.isFinite(maxLeft)) {
        left = Math.min(Math.max(left, minLeft), maxLeft);
      }
      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    };

    const onWindowChange = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    const openPopover = () => {
      if (isOpen) {
        return;
      }
      isOpen = true;
      popover.style.display = "block";
      popover.style.visibility = "hidden";
      updatePosition();
      popover.style.visibility = "visible";
      window.addEventListener("resize", onWindowChange);
      window.addEventListener("scroll", onWindowChange, true);
    };

    const closePopover = () => {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      popover.style.display = "none";
      popover.style.visibility = "";
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };

    const updateOpenState = () => {
      const shouldOpen = pinned || isHovering || isFocused;
      if (shouldOpen) {
        if (hoverCloseTimer != null) {
          window.clearTimeout(hoverCloseTimer);
          hoverCloseTimer = null;
        }
        wrapper.addClass(openClass);
        openPopover();
      } else {
        wrapper.removeClass(openClass);
        closePopover();
      }
      triggerEl.setAttribute("aria-expanded", String(shouldOpen));
    };

    triggerEl.setAttribute("aria-expanded", "false");
    triggerEl.setAttribute("aria-haspopup", "dialog");

    const isPointerOver = () =>
      wrapper.matches(":hover") || popover.matches(":hover");
    const scheduleHoverClose = () => {
      if (hoverCloseTimer != null) {
        window.clearTimeout(hoverCloseTimer);
      }
      hoverCloseTimer = window.setTimeout(() => {
        isHovering = isPointerOver();
        updateOpenState();
      }, closeDelayMs);
    };
    const handleEnter = () => {
      isHovering = true;
      updateOpenState();
    };
    const handleLeave = () => {
      scheduleHoverClose();
    };

    wrapper.addEventListener("mouseenter", handleEnter);
    wrapper.addEventListener("mouseleave", handleLeave);
    popover.addEventListener("mouseenter", handleEnter);
    popover.addEventListener("mouseleave", handleLeave);
    triggerEl.addEventListener("focus", () => {
      isFocused = true;
      updateOpenState();
    });
    triggerEl.addEventListener("blur", () => {
      isFocused = false;
      scheduleHoverClose();
    });
    triggerEl.addEventListener("click", (event) => {
      event.preventDefault();
      pinned = !pinned;
      updateOpenState();
      if (pinned) {
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
      } else {
        document.removeEventListener(
          "pointerdown",
          onDocumentPointerDown,
          true,
        );
      }
    });

    registerCleanup(() => {
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
      if (hoverCloseTimer != null) {
        window.clearTimeout(hoverCloseTimer);
      }
      popover.remove();
    });

    df.append(wrapper);
    return df;
  };

  return { createPopover };
};

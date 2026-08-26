/**
 * A setting turned off by the setting it depends on. It is a class instead of
 * the inline `display` style, so that the global setting filter, which owns
 * that style, cannot show a setting this class has hidden.
 */
export const DEPENDENCY_HIDDEN_CLASS =
  "another-quick-switcher__settings__dependency-hidden";

type ConditionalTarget = {
  el: HTMLElement;
  isVisible: () => boolean;
};

/**
 * Shows/hides settings that depend on another setting, without rebuilding the
 * settings tab. Rebuilding loses the scroll position of the settings window.
 */
export const useConditionalVisibility = () => {
  const targets: ConditionalTarget[] = [];

  const apply = (target: ConditionalTarget) => {
    target.el.classList.toggle(DEPENDENCY_HIDDEN_CLASS, !target.isVisible());
  };

  /**
   * Registers an element shown only while `isVisible` returns true.
   */
  const addConditionalTarget = (el: HTMLElement, isVisible: () => boolean) => {
    const target = { el, isVisible };
    targets.push(target);
    apply(target);
  };

  /**
   * Re-evaluates the visibility of every registered element. Call it from the
   * `onChange` of a setting that other settings depend on.
   */
  const refresh = () => {
    for (const target of targets) {
      apply(target);
    }
  };

  return { addConditionalTarget, refresh };
};

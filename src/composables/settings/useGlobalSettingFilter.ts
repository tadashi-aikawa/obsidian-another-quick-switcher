import { smartWhitespaceSplit } from "../../utils/strings";

const nestedClassName = "another-quick-switcher__settings__nested";
const searchCommandContainerClass =
  "another-quick-switcher__settings__search-command";
const dialogHotkeyContainerClass =
  "another-quick-switcher__settings__dialog-hotkey";

const getInputValue = (el: HTMLInputElement): string => {
  if (
    el.type === "checkbox" ||
    el.type === "range" ||
    el.type === "button" ||
    el.type === "submit" ||
    el.type === "color"
  ) {
    return "";
  }
  return el.value ?? "";
};

const getSettingSearchText = (settingEl: HTMLElement): string => {
  const name =
    settingEl.querySelector<HTMLElement>(".setting-item-name")?.textContent ??
    "";
  const desc =
    settingEl.querySelector<HTMLElement>(".setting-item-description")
      ?.textContent ?? "";
  const inputValues = Array.from(
    settingEl.querySelectorAll("input, textarea, select"),
  )
    .map((el) => {
      if (el instanceof HTMLInputElement) {
        return getInputValue(el);
      }
      if (el instanceof HTMLTextAreaElement) {
        return el.value ?? "";
      }
      if (el instanceof HTMLSelectElement) {
        return el.value ?? "";
      }
      return "";
    })
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [name, desc, ...inputValues].join(" ").trim();
};

const findPreviousElement = (
  orderedElements: HTMLElement[],
  startIndex: number,
  predicate: (el: HTMLElement) => boolean,
): HTMLElement | null => {
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    const el = orderedElements[i];
    if (predicate(el)) {
      return el;
    }
  }
  return null;
};

export const applyGlobalSettingFilter = (
  containerEl: HTMLElement,
  query: string,
) => {
  const queryTokens = smartWhitespaceSplit(query).map((token) =>
    token.toLowerCase(),
  );
  const isActive = queryTokens.length > 0;

  const settingItems = Array.from(
    containerEl.querySelectorAll<HTMLElement>(".setting-item"),
  );
  const sectionHeadings = Array.from(
    containerEl.querySelectorAll<HTMLElement>("h3"),
  );
  const orderedElements = Array.from(
    containerEl.querySelectorAll<HTMLElement>("h3, .setting-item"),
  );

  if (!isActive) {
    for (const item of settingItems) {
      item.toggle(true);
    }
    for (const heading of sectionHeadings) {
      heading.toggle(true);
    }

    containerEl
      .querySelectorAll<HTMLElement>(
        `.${searchCommandContainerClass}, .${dialogHotkeyContainerClass}`,
      )
      .forEach((container) => {
        container.toggle(true);
      });

    return;
  }

  const matchedItems = new Set<HTMLElement>();
  for (const item of settingItems) {
    const searchText = getSettingSearchText(item).toLowerCase();
    if (queryTokens.every((token) => searchText.includes(token))) {
      matchedItems.add(item);
    }
  }

  const matchedSectionHeadings = new Set<HTMLElement>();
  for (const heading of sectionHeadings) {
    const headingText = (heading.textContent ?? "").toLowerCase();
    if (queryTokens.every((token) => headingText.includes(token))) {
      matchedSectionHeadings.add(heading);
    }
  }

  const visibleItems = new Set<HTMLElement>(matchedItems);

  for (const heading of matchedSectionHeadings) {
    const index = orderedElements.indexOf(heading);
    if (index === -1) {
      continue;
    }
    for (let i = index + 1; i < orderedElements.length; i += 1) {
      const el = orderedElements[i];
      if (el.tagName === "H3") {
        break;
      }
      if (el.classList.contains("setting-item")) {
        visibleItems.add(el);
      }
    }
  }

  const matchedHeadingItems = Array.from(matchedItems).filter((item) =>
    item.classList.contains("setting-item-heading"),
  );
  for (const headingItem of matchedHeadingItems) {
    const searchCommandContainer = headingItem.closest<HTMLElement>(
      `.${searchCommandContainerClass}`,
    );
    const dialogHotkeyContainer = headingItem.closest<HTMLElement>(
      `.${dialogHotkeyContainerClass}`,
    );
    const container = searchCommandContainer ?? dialogHotkeyContainer;
    if (!container) {
      continue;
    }
    container
      .querySelectorAll<HTMLElement>(".setting-item")
      .forEach((item) => {
        visibleItems.add(item);
      });
  }

  for (const item of matchedItems) {
    const index = orderedElements.indexOf(item);
    if (index === -1) {
      continue;
    }

    const parentHeading = findPreviousElement(
      orderedElements,
      index,
      (el) =>
        el.tagName === "H3" || el.classList.contains("setting-item-heading"),
    );
    if (parentHeading && parentHeading.tagName !== "H3") {
      visibleItems.add(parentHeading);
    }

    if (item.classList.contains(nestedClassName)) {
      const parentSetting = findPreviousElement(
        orderedElements,
        index,
        (el) =>
          el.classList.contains("setting-item") &&
          !el.classList.contains(nestedClassName),
      );
      if (parentSetting) {
        visibleItems.add(parentSetting);
      }
    }
  }

  const visibleHeadings = new Set<HTMLElement>(matchedSectionHeadings);
  let currentHeading: HTMLElement | null = null;
  for (const el of orderedElements) {
    if (el.tagName === "H3") {
      currentHeading = el;
      continue;
    }
    if (currentHeading && visibleItems.has(el)) {
      visibleHeadings.add(currentHeading);
    }
  }

  for (const item of settingItems) {
    item.toggle(visibleItems.has(item));
  }
  for (const heading of sectionHeadings) {
    heading.toggle(visibleHeadings.has(heading));
  }

  containerEl
    .querySelectorAll<HTMLElement>(`.${searchCommandContainerClass}`)
    .forEach((container) => {
    const hasVisibleItem = Array.from(
      container.querySelectorAll<HTMLElement>(".setting-item"),
    ).some((item) => visibleItems.has(item));
    container.toggle(hasVisibleItem);
  });

  containerEl
    .querySelectorAll<HTMLElement>(`.${dialogHotkeyContainerClass}`)
    .forEach((container) => {
    const hasVisibleItem = Array.from(
      container.querySelectorAll<HTMLElement>(".setting-item"),
    ).some((item) => visibleItems.has(item));
    container.toggle(hasVisibleItem);
  });
};

import type { Setting, SettingGroup } from "obsidian";

/**
 * A setting hidden by the filter of its group. It is a class instead of the
 * inline `display` style, so that the global setting filter, which owns that
 * style, cannot show a setting this filter has hidden.
 */
export const FILTER_HIDDEN_CLASS =
  "another-quick-switcher__settings__filter-hidden";

export const useFilterSetting = (
  group: SettingGroup,
  option?: {
    /**
     * Called after the query of this filter changes. The global setting filter
     * has to run again, because a setting it had hidden while this filter was
     * also hiding it stays hidden otherwise.
     */
    onQueryChange?: () => void;
  },
) => {
  const filterTargets: {
    settingEl: HTMLElement;
    getSearchText: () => string;
  }[] = [];
  let latestQuery = "";

  const applyFilter = (query: string) => {
    latestQuery = query;
    const normalizedQuery = query.trim().toLowerCase();
    const shouldShowAll = normalizedQuery.length === 0;
    for (const target of filterTargets) {
      const searchText = target.getSearchText().toLowerCase();
      const isMatch = shouldShowAll || searchText.includes(normalizedQuery);
      target.settingEl.classList.toggle(FILTER_HIDDEN_CLASS, !isMatch);
    }
  };

  const addFilterTarget = (
    element: HTMLElement,
    getSearchText: () => string,
  ) => {
    filterTargets.push({ settingEl: element, getSearchText });
    applyFilter(latestQuery);
  };

  const addFilterableSetting = (
    name: string,
    desc: string | DocumentFragment | null,
    build: (setting: Setting) => void,
  ) => {
    const searchText = name.trim();
    group.addSetting((setting) => {
      setting.setName(name);
      if (desc) {
        setting.setDesc(desc);
      }
      build(setting);
      addFilterTarget(setting.settingEl, () => searchText);
    });
  };

  group.addSearch((sc) => {
    sc.setPlaceholder("Filter settings").onChange((value) => {
      applyFilter(value);
      option?.onQueryChange?.();
    });
  });

  return { addFilterableSetting };
};

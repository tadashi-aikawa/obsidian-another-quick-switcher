import { SuggestionItem } from "../matcher";
import { uniqFlatMap } from "../utils/collection-helper";
import { ALIAS, FOLDER, TAG } from "./icons";

interface Elements {
  itemDiv: HTMLDivElement;
  descriptionDiv?: HTMLDivElement;
}

export function createElements(
  item: SuggestionItem,
  options: { showDirectory: boolean }
): Elements {
  const itemDiv = createDiv({
    cls: [
      "another-quick-switcher__item",
      item.phantom ? "another-quick-switcher__phantom_item" : "",
    ],
  });

  const entryDiv = createDiv({
    cls: "another-quick-switcher__item__entry",
  });

  const fileDiv = createDiv({
    cls: "another-quick-switcher__item__file",
    text: item.file.basename,
  });
  entryDiv.appendChild(fileDiv);

  if (options.showDirectory) {
    const directoryDiv = createDiv({
      cls: "another-quick-switcher__item__directory",
    });
    directoryDiv.insertAdjacentHTML("beforeend", FOLDER);
    directoryDiv.appendText(` ${item.file.parent.name}`);
    entryDiv.appendChild(directoryDiv);
  }

  itemDiv.appendChild(entryDiv);

  // reasons..
  const aliases = item.matchResults.filter((res) => res.alias);
  const tags = item.matchResults.filter((res) => res.type === "tag");

  if (aliases.length === 0 && tags.length === 0) {
    return { itemDiv };
  }

  const descriptionDiv = createDiv({
    cls: "another-quick-switcher__item__reasons",
  });

  if (aliases.length > 0) {
    const aliasDiv = createDiv({
      cls: "another-quick-switcher__item__reason",
    });
    uniqFlatMap(aliases, (x) => x.meta ?? []).forEach((x) => {
      const aliasSpan = createSpan({
        cls: "another-quick-switcher__item__reason__alias",
      });
      aliasSpan.insertAdjacentHTML("beforeend", ALIAS);
      aliasSpan.appendText(x);
      aliasDiv.appendChild(aliasSpan);
    });
    descriptionDiv.appendChild(aliasDiv);
  }

  if (tags.length > 0) {
    const tagsDiv = createDiv({
      cls: "another-quick-switcher__item__reason",
    });
    uniqFlatMap(tags, (x) => x.meta ?? []).forEach((x) => {
      const tagsSpan = createSpan({
        cls: "another-quick-switcher__item__reason__tag",
      });
      tagsSpan.insertAdjacentHTML("beforeend", TAG);
      tagsSpan.appendText(x.replace("#", ""));
      tagsDiv.appendChild(tagsSpan);
    });
    descriptionDiv.appendChild(tagsDiv);
  }

  return {
    itemDiv,
    descriptionDiv,
  };
}

import { describe, expect, test } from "@jest/globals";
import type { TFile } from "obsidian";
import type { SuggestionItem } from "./matcher";
import { sort } from "./sorters";

const createItem = (
  path: string,
  frontMatter?: SuggestionItem["frontMatter"],
): SuggestionItem => {
  const name = path.split("/").pop() ?? path;
  const basename = name.replace(/\.[^.]+$/, "");
  const extension = name.split(".").pop() ?? "";
  return {
    file: {
      path,
      basename,
      name,
      extension,
      stat: { mtime: 0, ctime: 0 },
    } as unknown as TFile,
    tags: [],
    aliases: [],
    headers: [],
    links: [],
    frontMatter,
    matchResults: [],
    phantom: false,
    starred: false,
    tokens: [],
  };
};

describe("sort (property value)", () => {
  test("sorts by property value desc and keeps missing values last", () => {
    const items = [
      createItem("b.md", { updated: "2025-01-01" }),
      createItem("c.md", { updated: "2026-01-11" }),
      createItem("a.md"),
    ];

    const sorted = sort([...items], ["@updated:desc"], {});

    expect(sorted.map((item) => item.file.path)).toStrictEqual([
      "c.md",
      "b.md",
      "a.md",
    ]);
  });

  test("sorts by first array element in asc order", () => {
    const items = [
      createItem("b.md", { rank: [2, 1] }),
      createItem("a.md", { rank: [1, 3] }),
    ];

    const sorted = sort([...items], ["@rank:asc"], {});

    expect(sorted.map((item) => item.file.path)).toStrictEqual([
      "a.md",
      "b.md",
    ]);
  });
});

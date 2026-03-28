import { describe, expect, test } from "@jest/globals";
import type { TFile } from "obsidian";
import { type SuggestionItem, stampMatchResults } from "./matcher";

const createItem = (
  path: string,
  frontMatter?: SuggestionItem["frontMatter"],
): SuggestionItem => {
  const name = path.split("/").pop() ?? path;
  const basename = name.replace(/\.[^.]+$/, "");
  return {
    file: {
      path,
      basename,
      name,
      extension: name.split(".").pop() ?? "",
      stat: { mtime: 0, ctime: 0 },
      parent: { path: path.replace(/\/[^/]+$/, "") },
    } as unknown as TFile,
    tags: [],
    aliases: [],
    headers: [],
    links: [],
    frontMatter,
    matchResults: [],
    phantom: false,
    starred: false,
    tokens: basename.split(" "),
  };
};

const defaultOptions = {
  searchByTags: false,
  searchByHeaders: false,
  searchByLinks: false,
  keysOfPropertyToSearch: [],
  isNormalizeAccentsDiacritics: false,
  fuzzyTarget: false,
  minFuzzyScore: 0,
  excludePrefix: "-",
};

describe("property query (@key:value)", () => {
  test("@key:value matches when property value contains the query", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["@status:done"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("property");
    expect(result.matchResults[0].meta).toEqual(["status"]);
  });

  test("@key:value matches partial value", () => {
    const item = createItem("note.md", { status: "in progress" });
    const result = stampMatchResults(item, ["@status:prog"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("property");
  });

  test("@key:value returns not found when value does not match", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["@status:pending"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("@key:value returns not found when key does not exist", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(
      item,
      ["@nonexistent:value"],
      defaultOptions,
    );
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("@key:value matches array property values", () => {
    const item = createItem("note.md", { tags: ["alpha", "beta"] });
    const result = stampMatchResults(item, ["@tags:alpha"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("property");
    expect(result.matchResults[0].frontMatterRanges?.tags).toBeDefined();
  });

  test("@key:value returns not found when frontMatter is undefined", () => {
    const item = createItem("note.md");
    const result = stampMatchResults(item, ["@status:done"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("-@key:value excludes matched items", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["-@status:done"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("-@key:value passes items that do not match", () => {
    const item = createItem("note.md", { status: "pending" });
    const result = stampMatchResults(item, ["-@status:done"], defaultOptions);
    expect(result.matchResults).toHaveLength(0);
  });
});

describe("property query (@key: value check)", () => {
  test("@key: matches when property has a non-null value", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["@status:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("property");
    expect(result.matchResults[0].meta).toEqual(["status"]);
  });

  test("@key: matches when property value is 0", () => {
    const item = createItem("note.md", { count: 0 });
    const result = stampMatchResults(item, ["@count:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("property");
  });

  test("@key: matches when property value is false", () => {
    const item = createItem("note.md", { archived: false });
    const result = stampMatchResults(item, ["@archived:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("property");
  });

  test("@key: returns not found when property value is null", () => {
    const item = createItem("note.md", { status: null });
    const result = stampMatchResults(item, ["@status:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("@key: returns not found when key does not exist", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["@nonexistent:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("@key: returns not found when frontMatter is undefined", () => {
    const item = createItem("note.md");
    const result = stampMatchResults(item, ["@category:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });
});

describe("@ without colon falls through to normal search", () => {
  test("@home matches file named @home.md as normal name search", () => {
    const item = createItem("@home.md");
    const result = stampMatchResults(item, ["@home"], defaultOptions);
    expect(result.matchResults.some((r) => r.type !== "not found")).toBe(true);
  });
});

describe("empty key (@:value, @:)", () => {
  test("@:value returns not found", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["@:value"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });

  test("@: returns not found", () => {
    const item = createItem("note.md", { status: "done" });
    const result = stampMatchResults(item, ["@:"], defaultOptions);
    expect(result.matchResults).toHaveLength(1);
    expect(result.matchResults[0].type).toBe("not found");
  });
});

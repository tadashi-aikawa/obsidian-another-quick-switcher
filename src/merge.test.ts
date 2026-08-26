import { describe, expect, test } from "@jest/globals";
import { merge } from "ts-deepmerge";

describe("ts-deepmerge", () => {
  test("preserves nested settings while replacing arrays", () => {
    const result = merge.withOptions(
      { mergeArrays: false },
      {
        search: { enabled: true, target: "file" },
        extensions: ["md"],
      },
      {
        search: { target: "backlink" },
        extensions: ["canvas"],
      },
    );

    expect(result).toStrictEqual({
      search: { enabled: true, target: "backlink" },
      extensions: ["canvas"],
    });
  });

  test("preserves resolved and unresolved links for the same source", () => {
    const result = merge(
      { "source.md": { "resolved.md": 1 } },
      { "source.md": { "unresolved.md": 2 } },
    );

    expect(result).toStrictEqual({
      "source.md": {
        "resolved.md": 1,
        "unresolved.md": 2,
      },
    });
  });

  test.each([
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
  ])("ignores unsafe key %s from persisted data", (unsafeKey) => {
    const persistedData = JSON.parse(
      `{"safe":"value","${unsafeKey}":"overridden"}`,
    ) as Record<string, unknown>;

    const result = merge({ enabled: true }, persistedData);

    expect(result).toStrictEqual({ enabled: true, safe: "value" });
    expect(Object.keys(result)).not.toContain(unsafeKey);
    expect(`${result}`).toBe("[object Object]");
  });
});

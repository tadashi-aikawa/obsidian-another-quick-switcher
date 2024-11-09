import { expect, test } from "@jest/globals";
import { autoAliasTransform } from "./transformer";

test.each<
  [
    Parameters<typeof autoAliasTransform>[0],
    Parameters<typeof autoAliasTransform>[1],
    Parameters<typeof autoAliasTransform>[2],
    ReturnType<typeof autoAliasTransform>,
  ]
>([
  // match
  ["title (alias)", String.raw`(?<name>.+) \(.+\)$`, "$<name>", "title"],
  [
    "title (a1) subtitle (a2)",
    String.raw`(?<name>.+) \(.+\)$`,
    "$<name>",
    "title (a1) subtitle",
  ],
  [
    "title (alias)",
    String.raw`(?<name>.+) \((?<alias>.+)\)$`,
    "$<name>,$<alias>",
    "title,alias",
  ],
  // doesn't match
  [
    "title [alias]",
    String.raw`(?<name>.+) \(.+\)$`,
    "$<name>",
    "title [alias]",
  ],
] as const)("autoAliasTransform", (input, pattern, format, expected) => {
  expect(autoAliasTransform(input, pattern, format)).toBe(expected);
});

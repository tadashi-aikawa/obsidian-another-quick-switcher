import { describe, expect, test } from "@jest/globals";
import {
  DEPENDENCY_HIDDEN_CLASS,
  useConditionalVisibility,
} from "./useConditionalVisibility";

// jsdomを使わない環境のため、classListのtoggleだけを持つ最小のダミー要素を使う
const createElement = () => {
  const classes = new Set<string>();
  return {
    classes,
    el: {
      classList: {
        toggle: (cls: string, force: boolean) => {
          if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
        },
      },
    } as unknown as HTMLElement,
  };
};

describe("useConditionalVisibility", () => {
  test("登録時点の述語の結果を即座に反映する", () => {
    const { addConditionalTarget } = useConditionalVisibility();
    const shown = createElement();
    const hidden = createElement();

    addConditionalTarget(shown.el, () => true);
    addConditionalTarget(hidden.el, () => false);

    expect(shown.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(false);
    expect(hidden.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(true);
  });

  test("refreshで登録済みの全要素を再評価する", () => {
    const { addConditionalTarget, refresh } = useConditionalVisibility();
    let enabled = false;
    const target1 = createElement();
    const target2 = createElement();
    addConditionalTarget(target1.el, () => enabled);
    addConditionalTarget(target2.el, () => !enabled);

    enabled = true;
    refresh();
    expect(target1.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(false);
    expect(target2.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(true);

    enabled = false;
    refresh();
    expect(target1.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(true);
    expect(target2.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(false);
  });

  test("インスタンスごとに登録が独立している", () => {
    const first = useConditionalVisibility();
    const second = useConditionalVisibility();
    const target = createElement();
    first.addConditionalTarget(target.el, () => false);

    target.classes.delete(DEPENDENCY_HIDDEN_CLASS);
    second.refresh();

    expect(target.classes.has(DEPENDENCY_HIDDEN_CLASS)).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { setFloatingModal } from "./modal";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FixtureOption = {
  markdownView: boolean;
  allowNonMarkdownReposition?: boolean;
  hasMarkdownSizer?: boolean;
  fileStateMode?: "preview" | "source";
  positionedBeforeCall?: boolean;
};

function createFixture(option: FixtureOption) {
  const modalBg = {
    classes: [] as string[],
    addClass(cls: string) {
      this.classes.push(cls);
    },
  };
  const prompt = {
    classes: [] as string[],
    style: "",
    dataset: {} as DOMStringMap & { aqsFloatingAnchorY?: string },
    addClass(cls: string) {
      this.classes.push(cls);
    },
    getBoundingClientRect: () => ({ x: 0, y: 120, width: 80, height: 40 }),
    setAttribute: (name: string, value: string) => {
      if (name === "style") {
        prompt.style = value;
      }
    },
  };
  if (option.positionedBeforeCall) {
    prompt.dataset.aqsFloatingPositioned = "true";
    prompt.style = "left: 10px; top: 20px";
  }
  const modalEl = {
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 200 }),
  };
  const markdownSizerRect: Rect = { x: 300, y: 0, width: 400, height: 400 };
  const fileContentRect: Rect = { x: 100, y: 0, width: 300, height: 400 };
  const markdownSizer = {
    getBoundingClientRect: () => markdownSizerRect,
  };
  const contentEl = {
    querySelector: (selector: string) => {
      if (!option.hasMarkdownSizer) {
        return null;
      }
      if (selector === ".markdown-preview-sizer" || selector === ".cm-sizer") {
        return markdownSizer;
      }
      return null;
    },
    getBoundingClientRect: () => fileContentRect,
  };
  const fileView = {
    getState: () => ({ mode: option.fileStateMode ?? "preview" }),
    contentEl,
    containerEl: {
      getBoundingClientRect: () => ({ x: 0, y: 50, width: 800, height: 600 }),
    },
  };
  const appHelper = {
    getFileViewInActiveLeaf: () => fileView,
    getMarkdownViewInActiveLeaf: () => (option.markdownView ? {} : null),
  };
  const activeDocument = {
    querySelector: (selector: string) => {
      switch (selector) {
        case ".modal-bg":
          return modalBg;
        case ".prompt":
          return prompt;
        case ".another-quick-switcher__floating-prompt":
          return modalEl;
        default:
          return null;
      }
    },
  };
  (globalThis as any).activeWindow = {
    innerWidth: 1000,
    innerHeight: 800,
    activeDocument,
  };

  setFloatingModal(appHelper as any, {
    allowNonMarkdownReposition: option.allowNonMarkdownReposition,
  });

  return { modalBg, prompt };
}

describe("setFloatingModal", () => {
  const originalActiveWindow = (globalThis as any).activeWindow;

  beforeEach(() => {
    (globalThis as any).activeWindow = undefined;
  });

  afterEach(() => {
    (globalThis as any).activeWindow = originalActiveWindow;
  });

  test("repositions in markdown view when markdown sizer exists", () => {
    const { prompt } = createFixture({
      markdownView: true,
      hasMarkdownSizer: true,
      fileStateMode: "preview",
    });
    expect(prompt.style).toBe("left: 670px; top: 170px");
    expect(prompt.dataset.aqsFloatingAnchorY).toBe("120");
    expect(prompt.dataset.aqsFloatingPositioned).toBe("true");
  });

  test("does not reposition in non-markdown view by default when already positioned", () => {
    const { prompt } = createFixture({
      markdownView: false,
      hasMarkdownSizer: false,
      positionedBeforeCall: true,
    });
    expect(prompt.style).toBe("left: 10px; top: 20px");
  });

  test("repositions once in non-markdown view when not yet positioned", () => {
    const { prompt } = createFixture({
      markdownView: false,
      hasMarkdownSizer: false,
    });
    expect(prompt.style).toBe("left: 370px; top: 170px");
    expect(prompt.dataset.aqsFloatingPositioned).toBe("true");
  });

  test("repositions in non-markdown view only when explicitly allowed", () => {
    const { prompt } = createFixture({
      markdownView: false,
      hasMarkdownSizer: false,
      allowNonMarkdownReposition: true,
      positionedBeforeCall: true,
    });
    expect(prompt.style).toBe("left: 370px; top: 170px");
  });

  test("always adds floating classes even when reposition is skipped", () => {
    const { modalBg, prompt } = createFixture({
      markdownView: false,
      hasMarkdownSizer: false,
    });
    expect(modalBg.classes).toContain(
      "another-quick-switcher__floating-modal-bg",
    );
    expect(prompt.classes).toContain("another-quick-switcher__floating-prompt");
  });
});

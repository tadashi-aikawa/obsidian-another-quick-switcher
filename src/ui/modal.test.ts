import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

// obsidianパッケージは型定義のみでランタイム実装がないため、
// modal.tsのimport(Platform)を解決できるよう仮想モックを与える
jest.mock("obsidian", () => ({ Platform: { isMobile: false } }), {
  virtual: true,
});

import { createCrossIcon } from "./icons";
import { addMobileDismissButton, setFloatingModal } from "./modal";
// このファイルはjest.mockのホイストのためbabel変換が挟まる。imported bindingを
// 型注釈に使うと変換に失敗するため、型はローカルに書く
import { StubElement, serializeIcon } from "./test-helpers/obsidian-dom-stub";

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

type FakeButtonEl = {
  tag: string;
  classes: string[];
  attrs: Record<string, string>;
  children: unknown[];
  listeners: Record<string, () => void>;
  appendChild(node: unknown): void;
  addEventListener(type: string, listener: () => void): void;
};

function createDismissFixture(option: { initialInputValue?: string } = {}) {
  const createdEls: FakeButtonEl[] = [];
  (globalThis as any).createSvg = (
    tag: string,
    o?: { attr?: Record<string, string> },
  ) => new StubElement(tag, o);
  (globalThis as any).createEl = (
    tag: string,
    o?: {
      cls?: string | string[];
      attr?: Record<string, string>;
    },
  ) => {
    const el: FakeButtonEl = {
      tag,
      classes: o?.cls ? (Array.isArray(o.cls) ? o.cls : [o.cls]) : [],
      attrs: o?.attr ?? {},
      children: [],
      listeners: {},
      appendChild(node: unknown) {
        this.children.push(node);
      },
      addEventListener(type: string, listener: () => void) {
        this.listeners[type] = listener;
      },
    };
    createdEls.push(el);
    return el;
  };

  const inputContainer = {
    children: [] as unknown[],
    appendChild(node: unknown) {
      this.children.push(node);
    },
  };
  const dispatchedEvents: string[] = [];
  let focusedCount = 0;
  // GrepModalではmodal.inputElがDOM上のクローンに差し替えられるため、
  // 「見えているinput」と「modal.inputElに残る古いinput」を別オブジェクトにして
  // クリック処理が前者を操作することを検証できるようにする
  const visibleInputEl = {
    value: option.initialInputValue ?? "",
    dispatchEvent(evt: Event) {
      dispatchedEvents.push(evt.type);
    },
    focus() {
      focusedCount++;
    },
  };
  const staleInputEl = {
    value: "stale",
    parentElement: inputContainer,
    dispatchEvent() {
      throw new Error("stale inputEl must not be used");
    },
    focus() {
      throw new Error("stale inputEl must not be used");
    },
  };
  const modalEl = {
    classes: [] as string[],
    children: [] as unknown[],
    addClass(cls: string) {
      this.classes.push(cls);
    },
    appendChild(node: unknown) {
      this.children.push(node);
    },
    querySelector(selector: string) {
      return selector === "input.prompt-input" ? visibleInputEl : null;
    },
  };
  let closedCount = 0;
  const modal = {
    modalEl,
    inputEl: staleInputEl,
    close() {
      closedCount++;
    },
  };

  addMobileDismissButton(modal as any);

  return {
    modal,
    modalEl,
    visibleInputEl,
    staleInputEl,
    inputContainer,
    createdEls,
    dispatchedEvents,
    getClosedCount: () => closedCount,
    getFocusedCount: () => focusedCount,
  };
}

describe("addMobileDismissButton", () => {
  const obsidianMock = jest.requireMock("obsidian") as {
    Platform: { isMobile: boolean };
  };
  const originalCreateEl = (globalThis as any).createEl;

  afterEach(() => {
    obsidianMock.Platform.isMobile = false;
    (globalThis as any).createEl = originalCreateEl;
  });

  test("does nothing on desktop", () => {
    obsidianMock.Platform.isMobile = false;
    const { modalEl, inputContainer, createdEls } = createDismissFixture();
    expect(createdEls).toHaveLength(0);
    expect(modalEl.classes).toHaveLength(0);
    expect(inputContainer.children).toHaveLength(0);
  });

  test("adds a dismiss button into the input container on mobile", () => {
    obsidianMock.Platform.isMobile = true;
    const { modalEl, inputContainer, createdEls } = createDismissFixture();

    expect(modalEl.classes).toContain(
      "another-quick-switcher__mobile-dismissable",
    );
    expect(createdEls).toHaveLength(1);

    const buttonEl = createdEls[0];
    // アクセシビリティ確保のため、divでなく本物のbutton要素にする
    expect(buttonEl.tag).toBe("button");
    expect(buttonEl.attrs.type).toBe("button");
    expect(buttonEl.attrs["aria-label"]).toBe("Clear input or dismiss");
    expect(buttonEl.classes).toContain(
      "another-quick-switcher__mobile-dismiss-button",
    );
    // is-tabletでbutton:not(.clickable-icon)に付く強制paddingを回避する
    expect(buttonEl.classes).toContain("clickable-icon");
    // CROSSアイコンがSVG要素として差し込まれる
    expect(buttonEl.children.map(serializeIcon)).toEqual([
      serializeIcon(createCrossIcon()),
    ]);
    expect(inputContainer.children).toEqual([buttonEl]);
    expect(modalEl.children).toHaveLength(0);
  });

  test("closes the modal when clicked while the input is empty", () => {
    obsidianMock.Platform.isMobile = true;
    const { createdEls, dispatchedEvents, getClosedCount } =
      createDismissFixture({ initialInputValue: "" });

    createdEls[0].listeners.click();

    expect(getClosedCount()).toBe(1);
    expect(dispatchedEvents).toHaveLength(0);
  });

  test("clears the input without closing when clicked while the input has a query", () => {
    obsidianMock.Platform.isMobile = true;
    const {
      createdEls,
      visibleInputEl,
      staleInputEl,
      dispatchedEvents,
      getClosedCount,
      getFocusedCount,
    } = createDismissFixture({ initialInputValue: "hoge" });

    createdEls[0].listeners.click();

    expect(getClosedCount()).toBe(0);
    // 見えているinput(GrepModalではクローン)側が操作される
    expect(visibleInputEl.value).toBe("");
    expect(staleInputEl.value).toBe("stale");
    // 候補リストを再描画させるためinputイベントを発火する
    expect(dispatchedEvents).toEqual(["input"]);
    expect(getFocusedCount()).toBe(1);
  });

  test("clears first and closes on the second click", () => {
    obsidianMock.Platform.isMobile = true;
    const { createdEls, visibleInputEl, getClosedCount } = createDismissFixture(
      {
        initialInputValue: "hoge",
      },
    );

    createdEls[0].listeners.click();
    expect(visibleInputEl.value).toBe("");
    expect(getClosedCount()).toBe(0);

    createdEls[0].listeners.click();
    expect(getClosedCount()).toBe(1);
  });
});

import type { TextAreaComponent, TextComponent } from "obsidian";

export const TextComponentEvent = {
  onChange(
    component: TextComponent,
    handler: (value: string) => void,
    option?: { className?: string; style?: string },
  ): TextComponent {
    component.inputEl.addEventListener("change", async (ev) => {
      if (!(ev.target instanceof HTMLInputElement)) {
        return;
      }

      handler(ev.target.value);
    });
    if (option?.className) {
      component.inputEl.className = option.className;
    }
    if (option?.style) {
      component.inputEl.setAttribute("style", option.style);
    }
    return component;
  },
};

export const TextAreaComponentEvent = {
  onChange(
    component: TextAreaComponent,
    handler: (value: string) => void,
    option?: { className?: string },
  ): TextAreaComponent {
    component.inputEl.addEventListener("change", async (ev) => {
      if (!(ev.target instanceof HTMLTextAreaElement)) {
        return;
      }

      handler(ev.target.value);
    });
    if (option?.className) {
      component.inputEl.className = option.className;
    }
    return component;
  },
};

import { Plugin } from "obsidian";
import { Mode, SmartSearchModal } from "./ui/SmartSearchModal";

export default class SmartSearch extends Plugin {
  async onload() {
    console.log("loading plugin");

    this.addCommand({
      id: "normal-search",
      name: "Normal search",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "p" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          this.showSearchDialog("normal");
        }
        return true;
      },
    });

    this.addCommand({
      id: "recent-search",
      name: "Recent search",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "e" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          this.showSearchDialog("recent");
        }
        return true;
      },
    });
  }

  showSearchDialog(mode: Mode) {
    const modal = new SmartSearchModal(this.app, mode);
    modal.open();
  }
}

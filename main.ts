import { Plugin } from "obsidian";
import { SmartSearchModal } from "./ui/SmartSearchModal";

export default class SmartSearch extends Plugin {
  async onload() {
    console.log("loading plugin");

    this.addCommand({
      id: "search",
      name: "Search",
      hotkeys: [{ modifiers: ["Ctrl"], key: "p" }],
      checkCallback: (checking: boolean) => {
        if (!checking) {
          this.showList();
        }
        return true;
      },
    });
  }

  showList() {
    const modal = new SmartSearchModal(this.app);
    modal.open();
  }
}

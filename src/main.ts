import { Plugin } from "obsidian";
import { createCommands } from "./commands";

export default class SmartSearch extends Plugin {
  async onload() {
    console.log("loading plugin");

    createCommands(this.app).forEach(this.addCommand);
  }
}

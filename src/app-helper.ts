import {
  App,
  getLinkpath,
  LinkCache,
  MarkdownView,
  TFile,
  TFolder,
} from "obsidian";
import { flatten, uniq } from "./utils/collection-helper";
import { basename, dirname, extname } from "./utils/path";

export class AppHelper {
  constructor(private app: App) {}

  getFolders(): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((x) => x instanceof TFolder) as TFolder[];
  }

  findFirstLinkOffset(file: TFile, linkFile: TFile): number {
    const fileCache = this.app.metadataCache.getFileCache(file);
    const links = fileCache.links ?? [];
    const embeds = fileCache.embeds ?? [];

    return [...links, ...embeds].find((x: LinkCache) => {
      const toLinkFilePath = this.app.metadataCache.getFirstLinkpathDest(
        x.link,
        file.path
      )?.path;
      return toLinkFilePath === linkFile.path;
    }).position.start.offset;
  }

  // noinspection FunctionWithMultipleLoopsJS
  createBacklinksMap(): Record<string, Set<string>> {
    const backLinksMap: Record<string, Set<string>> = {};

    for (const [filePath, linkMap] of Object.entries(
      this.app.metadataCache.resolvedLinks
    ) as [string, Record<string, number>][]) {
      for (const linkPath of Object.keys(linkMap)) {
        if (!backLinksMap[linkPath]) {
          backLinksMap[linkPath] = new Set();
        }
        backLinksMap[linkPath].add(filePath);
      }
    }

    return backLinksMap;
  }

  openMarkdownFile(file: TFile, newLeaf: boolean, offset: number = 0) {
    const leaf = this.app.workspace.getLeaf(newLeaf);

    leaf
      .openFile(file, this.app.workspace.activeLeaf?.getViewState())
      .then(() => {
        this.app.workspace.setActiveLeaf(leaf, true, true);
        const viewOfType = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (viewOfType) {
          const editor = viewOfType.editor;
          const pos = editor.offsetToPos(offset);
          editor.setCursor(pos);
          editor.scrollIntoView({ from: pos, to: pos }, true);
        }
      });
  }

  searchPhantomFiles(): TFile[] {
    return uniq(
      flatten(
        Object.values(this.app.metadataCache.unresolvedLinks).map(Object.keys)
      )
    ).map((x) => this.createPhantomFile(x));
  }

  insertLinkToActiveFileBy(file: TFile) {
    const activeMarkdownView =
      this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeMarkdownView) {
      return;
    }

    const linkText = this.app.fileManager.generateMarkdownLink(
      file,
      activeMarkdownView.file.path
    );

    const editor = activeMarkdownView.editor;
    editor.replaceSelection(linkText);
  }

  async createMarkdown(linkText: string): Promise<TFile | null> {
    const linkPath = this.getPathToBeCreated(linkText);
    if (await this.exists(linkPath)) {
      return null;
    }

    const dir = dirname(linkPath);
    if (!(await this.exists(dir))) {
      await this.app.vault.createFolder(dir);
    }

    return this.app.vault.create(linkPath, "");
  }

  exists(normalizedPath: string): Promise<boolean> {
    return this.app.vault.adapter.exists(normalizedPath);
  }

  private getPathToBeCreated(linkText: string): string {
    let linkPath = getLinkpath(linkText);
    if (extname(linkPath) !== ".md") {
      linkPath += ".md";
    }

    if (linkPath.includes("/")) {
      return linkPath;
    }

    const parent = this.app.fileManager.getNewFileParent("").path;
    return `${parent}/${linkPath}`;
  }

  // TODO: Use another interface instead of TFile
  private createPhantomFile(linkText: string): TFile {
    const linkPath = this.getPathToBeCreated(linkText);

    return {
      path: linkPath,
      name: basename(linkPath),
      vault: this.app.vault,
      extension: "md",
      basename: basename(linkPath, ".md"),
      parent: {
        name: basename(dirname(linkPath)),
        path: dirname(linkPath),
        vault: this.app.vault,
        // XXX: From here, Untrusted properties
        children: [],
        parent: undefined,
        isRoot: () => true,
      },
      stat: {
        mtime: 0,
        ctime: 0,
        size: 0,
      },
    };
  }
}

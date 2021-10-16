import { App, getLinkpath, LinkCache, MarkdownView, TFile } from "obsidian";
import { flatten, uniq } from "./utils/collection-helper";
import { basename, dirname, extname } from "./utils/path";

export class AppHelper {
  constructor(private app: App) {}

  findFirstLinkOffset(file: TFile, linkFile: TFile): number {
    return this.app.metadataCache
      .getFileCache(file)
      .links.find((x: LinkCache) => {
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
      .openFile(file, this.app.workspace.activeLeaf.getViewState())
      .then(() => {
        this.app.workspace.setActiveLeaf(leaf, true, true);
        const editor =
          this.app.workspace.getActiveViewOfType(MarkdownView).editor;
        editor.setCursor(editor.offsetToPos(offset));
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
    const activeFilePath = this.app.workspace.getActiveFile()?.path;
    if (!activeFilePath) {
      return;
    }

    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!editor) {
      return;
    }

    const linkText = this.app.fileManager.generateMarkdownLink(
      file,
      activeFilePath
    );
    editor.replaceRange(linkText, editor.getCursor("from"));
  }

  private getPathToBeCreated(linkText: string): string {
    let linkPath = getLinkpath(linkText);
    if (!extname(linkPath)) {
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
    const ext = extname(linkPath);

    return {
      path: linkPath,
      name: basename(linkPath),
      vault: this.app.vault,
      extension: ext.replace(".", ""),
      basename: basename(linkPath, ext),
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

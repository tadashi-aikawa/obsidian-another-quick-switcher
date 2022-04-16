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

interface UnsafeAppInterface {
  internalPlugins: {
    plugins: {
      starred: {
        instance: {
          items: { path: string }[];
        };
      };
    };
  };
}

export class AppHelper {
  private unsafeApp: App & UnsafeAppInterface;

  constructor(app: App) {
    this.unsafeApp = app as any;
  }

  getFolders(): TFolder[] {
    return this.unsafeApp.vault
      .getAllLoadedFiles()
      .filter((x) => x instanceof TFolder) as TFolder[];
  }

  findFirstLinkOffset(file: TFile, linkFile: TFile): number {
    const fileCache = this.unsafeApp.metadataCache.getFileCache(file);
    const links = fileCache?.links ?? [];
    const embeds = fileCache?.embeds ?? [];

    return [...links, ...embeds].find((x: LinkCache) => {
      const toLinkFilePath = this.unsafeApp.metadataCache.getFirstLinkpathDest(
        x.link,
        file.path
      )?.path;
      return toLinkFilePath === linkFile.path;
    })!.position.start.offset;
  }

  // noinspection FunctionWithMultipleLoopsJS
  createBacklinksMap(): Record<string, Set<string>> {
    const backLinksMap: Record<string, Set<string>> = {};

    for (const [filePath, linkMap] of Object.entries(
      this.unsafeApp.metadataCache.resolvedLinks
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

  openMarkdownFile(
    file: TFile,
    option: { newLeaf?: boolean; offset?: number } = {}
  ) {
    const { newLeaf, offset } = { ...{ newLeaf: false, offset: 0 }, ...option };

    const leaf = this.unsafeApp.workspace.getLeaf(newLeaf);

    leaf
      .openFile(file, this.unsafeApp.workspace.activeLeaf?.getViewState())
      .then(() => {
        this.unsafeApp.workspace.setActiveLeaf(leaf, true, true);
        const viewOfType =
          this.unsafeApp.workspace.getActiveViewOfType(MarkdownView);
        if (viewOfType) {
          const editor = viewOfType.editor;
          const pos = editor.offsetToPos(offset);
          editor.setCursor(pos);
          editor.scrollIntoView({ from: pos, to: pos }, true);
        }
      });
  }

  getStarredFilePaths(): string[] {
    return this.unsafeApp.internalPlugins.plugins.starred.instance.items.map(
      (x) => x.path
    );
  }

  searchPhantomFiles(): TFile[] {
    return uniq(
      flatten(
        Object.values(this.unsafeApp.metadataCache.unresolvedLinks).map(
          Object.keys
        )
      )
    ).map((x) => this.createPhantomFile(x));
  }

  insertLinkToActiveFileBy(file: TFile) {
    const activeMarkdownView =
      this.unsafeApp.workspace.getActiveViewOfType(MarkdownView);
    if (!activeMarkdownView) {
      return;
    }

    const linkText = this.unsafeApp.fileManager.generateMarkdownLink(
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
      await this.unsafeApp.vault.createFolder(dir);
    }

    return this.unsafeApp.vault.create(linkPath, "");
  }

  exists(normalizedPath: string): Promise<boolean> {
    return this.unsafeApp.vault.adapter.exists(normalizedPath);
  }

  private getPathToBeCreated(linkText: string): string {
    let linkPath = getLinkpath(linkText);
    if (extname(linkPath) !== ".md") {
      linkPath += ".md";
    }

    if (linkPath.includes("/")) {
      return linkPath;
    }

    const parent = this.unsafeApp.fileManager.getNewFileParent("").path;
    return `${parent}/${linkPath}`;
  }

  // TODO: Use another interface instead of TFile
  private createPhantomFile(linkText: string): TFile {
    const linkPath = this.getPathToBeCreated(linkText);

    // @ts-ignore
    // @ts-ignore
    return {
      path: linkPath,
      name: basename(linkPath),
      vault: this.unsafeApp.vault,
      extension: "md",
      basename: basename(linkPath, ".md"),
      parent: {
        name: basename(dirname(linkPath)),
        path: dirname(linkPath),
        vault: this.unsafeApp.vault,
        // XXX: From here, Untrusted properties
        children: [],
        // @ts-ignore
        parent: null,
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

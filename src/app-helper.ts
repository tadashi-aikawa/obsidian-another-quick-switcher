import {
  type App,
  type CacheItem,
  type CachedMetadata,
  type Editor,
  type EditorPosition,
  FileView,
  type HeadingCache,
  type LinkCache,
  MarkdownView,
  type Pos,
  type ReferenceCache,
  type TAbstractFile,
  type TFile,
  TFolder,
  type Vault,
  View,
  type ViewState,
  type Workspace,
  type WorkspaceLeaf,
  getLinkpath,
} from "obsidian";
import merge from "ts-deepmerge";
import { ExhaustiveError } from "./errors";
import { autoAliasTransform } from "./transformer";
import {
  flatten,
  groupBy,
  mapKeys,
  mapValues,
  uniq,
} from "./utils/collection-helper";
import { basename, dirname, extname, normalizePath } from "./utils/path";
import { excludeFormat } from "./utils/strings";

type BookmarkItem =
  | { type: "file"; path: string }
  | { type: "group"; items: BookmarkItem[] };

interface UnsafeAppInterface {
  internalPlugins: {
    getEnabledPluginById(
      id: keyof UnsafeAppInterface["internalPlugins"]["plugins"],
    ): boolean;
    plugins: {
      bookmarks: {
        instance: {
          getBookmarks(): BookmarkItem[];
        };
      };
      "file-explorer": {
        instance: {
          revealInFolder(folder: TFolder): unknown;
        };
      };
    };
  };
  commands: {
    removeCommand(id: string): void;
    commands: { [commandId: string]: any };
  };
  plugins: {
    plugins: {
      "obsidian-hover-editor"?: {
        spawnPopover(
          initiatingEl?: HTMLElement,
          onShowCallback?: () => unknown,
        ): WorkspaceLeaf;
      };
    };
  };
  vault: Vault & {
    config: {
      newFileLocation?: "root" | "current" | "folder";
      newFileFolderPath?: string;
      useMarkdownLinks?: boolean;
    };
    adapter: {
      basePath: string;
    };
  };
  workspace: Workspace & {
    openPopoutLeaf(): WorkspaceLeaf;
  };
  openWithDefaultApp(path: string): unknown;
  showInFolder(path: string): void;
  viewRegistry: {
    getTypeByExtension(ext: string): string;
  };
  metadataCache: {
    getBacklinksForFile(file: TFile): { data: Map<string, LinkCache[]> };
    initialized: boolean;
  };
}

interface UnSafeLayoutChild {
  id: string;
  type: "tabs";
}
interface UnSafeLayout {
  id: string;
  type: "split";
  children: UnSafeLayoutChild[];
  direction: "horizontal" | "vertical";
  width: number;
  collapsed?: boolean;
}
interface UnsafeLayouts {
  active: string;
  left: UnSafeLayout;
  main: UnSafeLayout;
  right: UnSafeLayout;
}
interface UnsafeCanvasView extends View {
  canvas: UnsafeCanvas;
  requestSave(): unknown;
}

type UnsafeCardLayout = { x: number; y: number; width: number; height: number };
interface UnsafeCanvas {
  posCenter(): { x: number; y: number };
  createFileNode(args: {
    file: TFile;
    pos: { x: number; y: number };
    subpath?: unknown | undefined;
    size?: unknown | undefined;
    position?: unknown | undefined;
    save?: unknown | undefined;
    focus?: unknown | undefined;
  }): UnsafeCardLayout;
}

// From Obsidian 1.4.x
export interface FrontMatterLinkCache
  extends Omit<ReferenceCache, keyof CacheItem> {
  key: string;
}
export type UnsafeLinkCache = LinkCache | FrontMatterLinkCache;
export function isFrontMatterLinkCache(
  x: UnsafeLinkCache,
): x is FrontMatterLinkCache {
  return (x as any).position == null;
}
export type UnsafeCachedMetadata = CachedMetadata & {
  frontmatterLinks?: FrontMatterLinkCache[];
};

export type CaptureState = {
  leaf?: WorkspaceLeaf;
  restore(): Promise<void> | void;
};

export type LeafType =
  | "same-tab"
  | "new-tab"
  | "new-tab-background"
  | "new-pane-vertical"
  | "new-pane-horizontal"
  | "new-window"
  | "popup";
type OpenFileOption = {
  leafType: LeafType;
  offset?: number;
  line?: number;
  inplace?: boolean;
  preventDuplicateTabs?: boolean;
  leafPriorToSameTab?: WorkspaceLeaf;
};

export class AppHelper {
  private unsafeApp: App & UnsafeAppInterface;

  constructor(app: App) {
    this.unsafeApp = app as any;
  }

  getActiveFile(): TFile | null {
    return this.unsafeApp.workspace.getActiveFile();
  }

  getViewInActiveLeaf(): View | null {
    return this.unsafeApp.workspace.getActiveViewOfType(View);
  }

  getFileViewInActiveLeaf(): FileView | null {
    return this.unsafeApp.workspace.getActiveViewOfType(FileView);
  }

  getActiveFileLeaf(): WorkspaceLeaf | null {
    return this.getFileViewInActiveLeaf()?.leaf ?? null;
  }

  getMarkdownViewInActiveLeaf(): MarkdownView | null {
    return this.unsafeApp.workspace.getActiveViewOfType(MarkdownView);
  }

  getCanvasViewInActiveLeaf(): UnsafeCanvasView | null {
    return this.getViewInActiveLeaf() as UnsafeCanvasView;
  }

  getCurrentEditor(): Editor | null {
    return this.getMarkdownViewInActiveLeaf()?.editor ?? null;
  }

  getCurrentDirPath(): string {
    return this.getActiveFile()?.parent?.path ?? "";
  }

  getCurrentOffset(): number | null {
    const editor = this.getCurrentEditor();
    if (!editor) {
      return null;
    }

    const cursor = this.getCurrentEditor()?.getCursor();
    if (!cursor) {
      return null;
    }

    return editor.posToOffset(cursor);
  }

  getHeadersInActiveFile(): HeadingCache[] {
    const activeFile = this.getActiveFile();
    if (!activeFile) {
      return [];
    }

    return (
      this.unsafeApp.metadataCache.getFileCache(activeFile)?.headings ?? []
    );
  }

  getFolders(): TFolder[] {
    return this.unsafeApp.vault
      .getAllLoadedFiles()
      .filter((x) => x instanceof TFolder) as TFolder[];
  }

  getLayout(): UnsafeLayouts {
    // WARNING: unsafe cast
    return this.unsafeApp.workspace.getLayout() as any as UnsafeLayouts;
  }

  getLeftSideBarWidth(): number {
    return this.getLayout().left.collapsed ? 0 : this.getLayout().left.width;
  }

  getRightSideBarWidth(): number {
    return this.getLayout().right.collapsed ? 0 : this.getLayout().right.width;
  }

  async findExternalLinkUrls(file: TFile): Promise<string[]> {
    const content = await this.unsafeApp.vault.read(file);
    const matches = Array.from(content.matchAll(/https?:\/\/[^ \n)]+/g));
    return matches.map((x) => x[0]);
  }

  findFirstLinkOffset(file: TFile, linkFile: TFile): number {
    const fileCache = this.unsafeApp.metadataCache.getFileCache(
      file,
    ) as UnsafeCachedMetadata | null;
    const links = fileCache?.links ?? [];
    const frontmatterLinks = fileCache?.frontmatterLinks ?? [];
    const embeds = fileCache?.embeds ?? [];

    const first = [...links, ...frontmatterLinks, ...embeds].find(
      (x: UnsafeLinkCache) => {
        const firstLinkPath = this.isPhantomFile(linkFile)
          ? this.getPathToBeCreated(x.link)
          : this.unsafeApp.metadataCache.getFirstLinkpathDest(
              getLinkpath(x.link),
              file.path,
            )?.path;
        return firstLinkPath === linkFile.path;
      },
    );

    if (!first || isFrontMatterLinkCache(first)) {
      return 0;
    }

    return first.position.start.offset;
  }

  findFirstHeaderOffset(file: TFile, header: string): number | null {
    const cache = this.unsafeApp.metadataCache.getFileCache(file);
    if (!cache) {
      return null;
    }

    const target = cache.headings?.find(
      (x) => excludeFormat(x.heading) === excludeFormat(header),
    );
    return target?.position.start.offset ?? null;
  }

  getBacklinksByFilePathInActiveFile(): Record<
    string,
    UnsafeLinkCache[]
  > | null {
    const f = this.getActiveFile();
    if (!f) {
      return null;
    }

    // INFO: There seems to be room for performance improvement
    return Object.fromEntries(
      this.unsafeApp.metadataCache.getBacklinksForFile(f).data,
    );
  }

  // noinspection FunctionWithMultipleLoopsJS
  /**
   * Includes phantom files
   */
  createBacklinksMap(): Record<string, Set<string>> {
    const backLinksMap: Record<string, Set<string>> = {};

    const unresolvedLinks = mapValues(
      this.unsafeApp.metadataCache.unresolvedLinks,
      (innerMap) => mapKeys(innerMap, (x) => this.getPathToBeCreated(x)),
    );

    for (const [filePath, linkMap] of Object.entries(
      merge(this.unsafeApp.metadataCache.resolvedLinks, unresolvedLinks),
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

  /**
   * @return {"<relative path from root>: UnsafeLinkCache"}
   */
  createLinksMap(file: TFile): Record<string, UnsafeLinkCache> {
    const cache = this.unsafeApp.metadataCache.getFileCache(
      file,
    ) as UnsafeCachedMetadata;
    return mapValues(
      groupBy(
        [
          ...(cache?.embeds ?? []),
          ...(cache?.links ?? []),
          ...(cache?.frontmatterLinks ?? []),
        ],
        (x) => this.linkText2Path(x.link) ?? this.getPathToBeCreated(x.link),
      ),
      (caches) => caches[0],
    );
  }

  getLinksByFilePathInActiveFile(): Record<string, UnsafeLinkCache[]> | null {
    const file = this.getActiveFile();
    if (!file) {
      return null;
    }

    const cache = this.unsafeApp.metadataCache.getFileCache(
      file,
    ) as UnsafeCachedMetadata;
    return groupBy(
      [
        ...(cache?.embeds ?? []),
        ...(cache?.links ?? []),
        ...(cache?.frontmatterLinks ?? []),
      ],
      (x) => this.linkText2Path(x.link) ?? this.getPathToBeCreated(x.link),
    );
  }

  /**
   * Moves the cursor to the specified position.
   * @param to The position to move to, either as a Pos object or an offset.
   * @param editor The editor to move in, defaults to the current editor.
   * @param fromPos The position from which the jump is made, used for Vim jump list.
   */
  async moveTo(
    to: Pos | number,
    editor?: Editor,
    editorPosition?: EditorPosition,
  ) {
    const isToOffset = typeof to === "number";

    const activeFile = this.getActiveFile();
    const activeLeaf = this.unsafeApp.workspace.activeLeaf;
    if (!activeFile || !activeLeaf) {
      return;
    }

    const subView = this.getMarkdownViewInActiveLeaf()?.currentMode;
    if (!subView) {
      return;
    }

    const targetEditor = editor ?? this.getCurrentEditor();
    if (!targetEditor) {
      return;
    }

    const line = isToOffset ? targetEditor.offsetToPos(to).line : to.start.line;

    if (editorPosition) {
      this.addToJumpList(targetEditor, editorPosition, { line, ch: 0 });
    }

    targetEditor.setCursor(
      targetEditor.offsetToPos(isToOffset ? to : to.start.offset),
    );
    await activeLeaf.openFile(activeFile, {
      eState: {
        line,
      },
      active: false,
    });
  }

  getFileByPath(path: string): TFile | null {
    const abstractFile = this.unsafeApp.vault.getAbstractFileByPath(path);
    if (!abstractFile) {
      return null;
    }

    return abstractFile as TFile;
  }

  getFilePathsInActiveWindow(): string[] {
    return this.unsafeApp.workspace
      .getLeavesOfType("markdown")
      .filter(
        (x) =>
          x.getContainer() ===
          this.unsafeApp.workspace.activeLeaf?.getContainer(),
      )
      .map((x) => x.getViewState().state!.file as string);
  }

  captureState(initialLeaf: WorkspaceLeaf | null): CaptureState {
    const currentLeaf = this.unsafeApp.workspace.getLeaf();
    const newLeaf = this.unsafeApp.workspace.getLeaf();
    const newState = newLeaf.getViewState();
    const newEState = newLeaf.getEphemeralState();

    const unsafeApp = this.unsafeApp;
    return {
      leaf: newLeaf,
      async restore() {
        if (!newLeaf) {
          return;
        }

        if (!initialLeaf || initialLeaf.getViewState().pinned) {
          newLeaf.detach();
        } else {
          await newLeaf.setViewState(
            {
              ...newState,
              active: newLeaf === currentLeaf,
              popstate: true,
            } as ViewState,
            newEState,
          );

          if (newLeaf !== currentLeaf) {
            unsafeApp.workspace.setActiveLeaf(currentLeaf!, { focus: true });
          }
        }

        this.leaf = undefined;
      },
    };
  }

  // https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/284#event-17898469302
  captureStateInFile(initialLeaf: WorkspaceLeaf | null): CaptureState {
    const leaf = this.unsafeApp.workspace.getMostRecentLeaf()!;
    const state = leaf.getViewState();
    const eState = leaf.getEphemeralState();

    const unsafeApp = this.unsafeApp;
    return {
      async restore() {
        await leaf.setViewState(
          {
            ...state,
            active: true,
            popstate: true,
          } as ViewState,
          eState,
        );
        unsafeApp.workspace.setActiveLeaf(leaf!, { focus: true });
        this.leaf = undefined;
      },
    };
  }

  getOpenState(leaf: WorkspaceLeaf, file: TFile) {
    let type = this.unsafeApp.viewRegistry.getTypeByExtension(file.extension);
    if (
      leaf.view instanceof FileView &&
      leaf.view.canAcceptExtension(file.extension)
    ) {
      type = leaf.view.getViewType();
    }
    return { type, state: { file: file.path } };
  }

  findLeaf(file: TFile): WorkspaceLeaf | undefined {
    return this.unsafeApp.workspace
      .getLeavesOfType("markdown")
      .find((x) => x.getViewState().state!.file === file.path);
  }

  async openFile(
    file: TFile,
    option: Partial<OpenFileOption> = {},
    captureState?: CaptureState,
  ) {
    const opt: OpenFileOption = {
      ...{ leafType: "same-tab", inplace: false },
      ...option,
    };

    const priorLeaf = option?.preventDuplicateTabs
      ? this.findLeaf(file)
      : undefined;

    let leaf: WorkspaceLeaf | undefined;
    let background = false;
    switch (opt.leafType) {
      case "same-tab":
        leaf =
          option.leafPriorToSameTab ??
          captureState?.leaf ??
          this.unsafeApp.workspace.getLeaf();
        break;
      case "new-tab":
        leaf = priorLeaf ?? this.unsafeApp.workspace.getLeaf(true);
        break;
      case "new-tab-background":
        leaf = priorLeaf ?? this.unsafeApp.workspace.getLeaf(true);
        background = true;
        break;
      case "new-pane-horizontal":
        leaf = this.unsafeApp.workspace.getLeaf("split", "horizontal");
        break;
      case "new-pane-vertical":
        leaf = this.unsafeApp.workspace.getLeaf("split", "vertical");
        break;
      case "new-window":
        leaf = this.unsafeApp.workspace.openPopoutLeaf();
        break;
      case "popup": {
        const hoverEditorInstance =
          this.unsafeApp.plugins.plugins["obsidian-hover-editor"];
        leaf =
          hoverEditorInstance?.spawnPopover() ??
          this.unsafeApp.workspace.getLeaf(true);
        break;
      }
      default:
        throw new ExhaustiveError(opt.leafType);
    }

    if (opt.inplace && opt.leafType === "same-tab") {
      await leaf.setViewState({
        ...leaf.getViewState(),
        active: !background,
        popstate: true,
        ...this.getOpenState(leaf, file),
      } as ViewState);
    } else {
      await leaf.openFile(file, {
        ...leaf.getViewState(),
        active: !background,
      });
    }

    if (leaf.view instanceof MarkdownView) {
      const markdownView = leaf.view;
      if (opt.offset != null) {
        this.moveTo(opt.offset, markdownView.editor);
      } else if (opt.line != null) {
        const p = { line: opt.line, offset: 0, col: 0 };
        this.moveTo({ start: p, end: p }, markdownView.editor);
      }
    }
  }

  openFileInDefaultApp(file: TFile): void {
    this.unsafeApp.openWithDefaultApp(file.path);
  }

  openFolderInDefaultApp(folder: TFolder): void {
    this.unsafeApp.openWithDefaultApp(folder.path);
  }

  openInSystemExplorer(entry: TAbstractFile): void {
    this.unsafeApp.showInFolder(entry.path);
  }

  closeFile(file: TFile): void {
    const targetLeaves = this.unsafeApp.workspace
      .getLeavesOfType("markdown")
      .filter((x) => x.getViewState().state?.file === file.path);

    for (const leaf of targetLeaves) {
      leaf.detach();
    }
  }

  // FIXME: function name
  getStarredFilePaths(): string[] {
    return this.unsafeApp.internalPlugins.plugins.bookmarks.instance
      .getBookmarks()
      .map((x) => (x.type === "file" ? x.path : undefined))
      .filter((x) => x !== undefined) as string[];
  }

  searchPhantomFiles(): TFile[] {
    return uniq(
      flatten(
        Object.values(this.unsafeApp.metadataCache.unresolvedLinks).map(
          Object.keys,
        ),
      ),
    ).map((x) => this.createPhantomFile(x));
  }

  insertStringToActiveFile(str: string) {
    const activeMarkdownView =
      this.unsafeApp.workspace.getActiveViewOfType(MarkdownView);
    if (!activeMarkdownView) {
      return;
    }

    const editor = activeMarkdownView.editor;
    editor.replaceSelection(str);
  }

  /**
   * Insert a link to the active file.
   * @param file The file to be linked.
   */
  insertLinkToActiveFileBy(
    file: TFile,
    opts?: {
      phantom?: boolean;
      displayedString?: string;
      aliasTranformer?: { pattern: string; format: string };
    },
  ) {
    const activeMarkdownView =
      this.unsafeApp.workspace.getActiveViewOfType(MarkdownView);
    if (!activeMarkdownView?.file) {
      return;
    }

    let linkText = this.unsafeApp.fileManager.generateMarkdownLink(
      file,
      activeMarkdownView.file.path,
    );

    const displayedString = opts?.displayedString;
    const transformer = opts?.aliasTranformer;

    // Force to recreate link text
    if (this.unsafeApp.vault.config.useMarkdownLinks) {
      const { text, link } = Array.from(
        linkText.matchAll(/\[(?<text>[^\]]+)]\((?<link>.+)\)/g),
      )[0].groups!;

      let dispTxt = displayedString ?? text;
      if (transformer) {
        dispTxt = autoAliasTransform(
          dispTxt,
          transformer.pattern,
          transformer.format,
        );
      }

      linkText = `[${dispTxt}](${link})`;
    } else {
      const text = Array.from(linkText.matchAll(/\[\[(?<text>[^\]]+)]]/g))[0]
        .groups?.text!;

      let dispTxt = displayedString ?? text;
      if (transformer) {
        dispTxt = autoAliasTransform(
          dispTxt,
          transformer.pattern,
          transformer.format,
        );
      }

      linkText = text === dispTxt ? `[[${text}]]` : `[[${text}|${dispTxt}]]`;
      if (opts?.phantom) {
        const phantomLinkText = linkText
          .replace("[[", "")
          .replace("]]", "")
          .split("|")
          .map((x) => x.replace(/.*\/([^\]]+)/, "$1"))
          .unique()
          .join("|");
        linkText = `[[${phantomLinkText}]]`;
      }
    }

    const editor = activeMarkdownView.editor;
    editor.replaceSelection(
      // XXX: dirty hack
      linkText.endsWith(".excalidraw]]")
        ? `!${linkText}`
        : // ![[hoge.pdf]] -> [[hoge.pdf]]
          linkText.endsWith(".pdf]]")
          ? linkText.replace("!", "")
          : linkText,
    );
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

  isPopWindow(): boolean {
    // XXX: Hacky implementation!!
    return !fish(".modal-bg");
  }

  removeCommand(commandId: string) {
    this.unsafeApp.commands.removeCommand(commandId);
  }

  getCommandIds(manifestId: string): string[] {
    return Object.keys(this.unsafeApp.commands.commands).filter((x) =>
      x.startsWith(manifestId),
    );
  }

  getNormalizeVaultRootPath(): string {
    return normalizePath(this.unsafeApp.vault.adapter.basePath);
  }

  getPathToBeCreated(linkText: string): string {
    let linkPath = getLinkpath(linkText);
    if (extname(linkPath) !== ".md") {
      linkPath += ".md";
    }

    if (linkPath.includes("/")) {
      return linkPath;
    }

    switch (this.unsafeApp.vault.config.newFileLocation) {
      case "root":
        return `/${linkPath}`;
      case "current":
        return `${this.getActiveFile()?.parent?.path ?? ""}/${linkPath}`;
      case "folder":
        return `${this.unsafeApp.vault.config.newFileFolderPath}/${linkPath}`;
      default:
        // Normally, same as the "root"
        return `/${linkPath}`;
    }
  }

  linkText2Path(linkText: string): string | null {
    const activeFile = this.getActiveFile();
    if (!activeFile) {
      return null;
    }

    return (
      this.unsafeApp.metadataCache.getFirstLinkpathDest(
        linkText,
        activeFile.path,
      )?.path ?? null
    );
  }

  isPhantomFile(file: TFile): boolean {
    return file.stat.ctime === 0;
  }

  isActiveLeafCanvas(): boolean {
    return this.getViewInActiveLeaf()?.getViewType() === "canvas";
  }

  // XXX: not strict
  isCacheInitialized(): boolean {
    return this.unsafeApp.metadataCache.initialized;
  }

  addFileToCanvas(
    file: TFile,
    offset: { x: number; y: number } = { x: 0, y: 0 },
  ): UnsafeCardLayout {
    const unsafeView = this.getCanvasViewInActiveLeaf()!;
    const { x, y } = unsafeView.canvas.posCenter();
    return unsafeView.canvas.createFileNode({
      file,
      pos: { x: x + offset.x, y: y + offset.y },
    });
  }

  enableFileExplorer(): boolean {
    return this.unsafeApp.internalPlugins.getEnabledPluginById("file-explorer");
  }

  revealInFolder(folder: TFolder): void {
    this.unsafeApp.internalPlugins.plugins[
      "file-explorer"
    ].instance.revealInFolder(folder);
  }

  // TODO: Use another interface instead of TFile
  createPhantomFile(linkText: string): TFile {
    const linkPath = this.getPathToBeCreated(linkText);

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

  // Unsafe
  private addToJumpList(
    editor: Editor,
    editorPosition: EditorPosition,
    to: EditorPosition,
  ) {
    const cm = (editor as any).cm?.cm;
    const jumpList = cm?.constructor?.Vim?.getVimGlobalState_?.()?.jumpList;
    if (!jumpList) {
      return;
    }

    jumpList.add(cm, editorPosition, to);
  }
}

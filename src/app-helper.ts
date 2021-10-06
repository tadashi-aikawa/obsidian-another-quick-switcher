import { App, getLinkpath, LinkCache, MarkdownView, TFile } from "obsidian";
import path from "path";
import { flatten, uniq } from "./utils/collection-helper";

export function findFirstLinkOffset(
  app: App,
  file: TFile,
  linkFile: TFile
): number {
  return app.metadataCache
    .getFileCache(file)
    .links.find(
      (x: LinkCache) =>
        app.metadataCache.getFirstLinkpathDest(x.link, file.path).path ===
        linkFile.path
    ).position.start.offset;
}

// noinspection FunctionWithMultipleLoopsJS
export function createBacklinksMap(app: App): Record<string, Set<string>> {
  const backLinksMap: Record<string, Set<string>> = {};

  for (const [filePath, linkMap] of Object.entries(
    app.metadataCache.resolvedLinks
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

export function searchPhantomFiles(app: App): TFile[] {
  return uniq(
    flatten(Object.values(app.metadataCache.unresolvedLinks).map(Object.keys))
  ).map((x) => createPhantomFile(app, x));
}

export function openFile(
  app: App,
  file: TFile,
  newLeaf: boolean,
  offset: number = 0
) {
  const leaf = app.workspace.getLeaf(newLeaf);

  leaf.openFile(file, app.workspace.activeLeaf.getViewState()).then(() => {
    app.workspace.setActiveLeaf(leaf, true, newLeaf);
    const editor = app.workspace.getActiveViewOfType(MarkdownView).editor;
    editor.setCursor(editor.offsetToPos(offset));
  });
}

function getPathToBeCreated(app: App, linkText: string): string {
  let linkPath = getLinkpath(linkText);
  if (!path.extname(linkPath)) {
    linkPath += ".md";
  }

  if (linkPath.includes("/")) {
    return linkPath;
  }

  const parent = app.fileManager.getNewFileParent("").path;
  return `${parent}/${linkPath}`;
}

// TODO: Use another interface instead of TFile
function createPhantomFile(app: App, linkText: string): TFile {
  const linkPath = getPathToBeCreated(app, linkText);
  const ext = path.extname(linkPath);

  return {
    path: linkPath,
    name: path.basename(linkPath),
    vault: app.vault,
    extension: ext.replace(".", ""),
    basename: path.basename(linkPath, ext),
    parent: {
      name: path.dirname(linkPath).split("/").pop(),
      path: path.dirname(linkPath),
      vault: app.vault,
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

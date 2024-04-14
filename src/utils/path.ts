import type { TFile } from "obsidian";

export function basename(path: string, ext?: string): string {
  const name = path.match(/.+[\\/]([^\\/]+)[\\/]?$/)?.[1] ?? path;
  return ext && name.endsWith(ext) ? name.replace(ext, "") : name;
}

export function extname(path: string): string {
  const ext = basename(path).split(".").slice(1).pop();
  return ext ? `.${ext}` : "";
}

export function dirname(path: string): string {
  return path.match(/(.+)[\\/].+$/)?.[1] ?? ".";
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function normalizeRelativePath(path: string, base: string): string {
  const sep = /[\\/]/;
  let es: string[] = [];
  path.split(sep).forEach((x, i) => {
    if (i === 0 && x === ".") {
      es = base.split("/");
      return;
    }

    if (x === "..") {
      if (i === 0) {
        es = base.split("/");
      }
      es = dirname(es.join("/"))
        .split("/")
        .filter((x) => x !== ".");
      return;
    }

    es = [...es, x];
  });

  const r = es.filter((x) => x !== "").join("/");
  return base[0] === "/" ? `/${r}` : r;
}

export function isExcalidraw(file: TFile | undefined): boolean {
  if (!file) {
    return false;
  }

  return (
    file.path.endsWith(".excalidraw.md") ||
    // old version
    file.path.endsWith(".excalidraw")
  );
}

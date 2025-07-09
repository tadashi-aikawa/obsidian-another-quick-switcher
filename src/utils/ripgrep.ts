import { execFile } from "child_process";

type Result = BeginResult | EndResult | MatchResult;
interface BeginResult {
  type: "begin";
}
interface EndResult {
  type: "end";
}

export interface MatchResult {
  type: "match";
  data: {
    path: {
      text: string;
    };
    lines: {
      text: string;
    };
    line_number: number;
    absolute_offset: number;
    submatches: {
      match: {
        text: string;
      };
      start: number;
      end: number;
    }[];
  };
}

export interface RgError {
  type: "error";
  errorType: "regex_parse_error" | "other";
  message: string;
}

export type RgResult = MatchResult[] | RgError;

export async function existsRg(cmd: string): Promise<boolean> {
  return new Promise((resolve, _) => {
    execFile(cmd, ["--version"], (error, _stdout, _stderr) => {
      if (error) {
        console.dir(error);
      }
      resolve(!error);
    });
  });
}

export async function rg(
  cmd: string,
  ...args: string[]
): Promise<RgResult> {
  return new Promise((resolve, _) => {
    execFile(
      cmd,
      ["--json", ...args],
      { maxBuffer: 1024 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          // Check if it's a regex parse error
          if (error.message.includes('regex parse error')) {
            resolve({
              type: "error",
              errorType: "regex_parse_error",
              message: error.message,
            });
            return;
          }
          
          console.error('ripgrep error:', error);
          resolve([]);
          return;
        }
        
        const results = stdout
          .split("\n")
          .filter((x: string) => x)
          .map((x: string) => {
            try {
              return JSON.parse(x) as Result;
            } catch (e) {
              console.warn('JSON parse error for line:', x);
              return null;
            }
          })
          .filter((x: Result | null) => x !== null && x.type === "match") as MatchResult[];
        resolve(results);
      },
    );
  });
}

/**
 * Search for files by filename using ripgrep with AND logic for multiple queries
 */
export async function rgFiles(
  cmd: string,
  queries: string[],
  searchPath: string,
  extensions: string[],
): Promise<string[]> {
  return new Promise((resolve, _) => {
    // Use --files to get all files first
    const filesArgs = [
      "--files",
      ...extensions.flatMap((x) => ["-t", x]),
      searchPath,
    ].filter((x) => x);

    execFile(
      cmd,
      filesArgs,
      { maxBuffer: 1024 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error('ripgrep files error:', error);
          resolve([]);
          return;
        }
        
        let files = stdout.split("\n").filter((x: string) => x);

        // Apply AND search for each query
        for (const query of queries) {
          if (!query.trim()) continue;

          files = files.filter((filePath) => {
            const basename = filePath.split("/").pop() || "";
            return basename.toLowerCase().includes(query.toLowerCase());
          });
        }

        resolve(files);
      },
    );
  });
}

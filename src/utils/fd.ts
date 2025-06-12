import { execFile } from "child_process";

export async function existsFd(cmd: string): Promise<boolean> {
  return new Promise((resolve, _) => {
    execFile(cmd, ["--version"], (error, _stdout, _stderr) => {
      if (error) {
        console.dir(error);
      }
      resolve(!error);
    });
  });
}

export async function fd(cmd: string, ...args: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { maxBuffer: 100 * 1024 * 1024 },
      (_, stdout, _stderr) => {
        if (_stderr) {
          reject(_stderr);
          return;
        }
        const results = stdout.split("\n").filter((x: string) => x);
        resolve(results);
      },
    );
  });
}

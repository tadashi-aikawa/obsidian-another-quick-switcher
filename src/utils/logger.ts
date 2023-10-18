import { Settings } from "../settings";

function buildLogMessage(message: string, msec: number) {
  return `${message}: ${Math.round(msec)}[ms]`;
}

export class Logger {
  private constructor(private settings: Settings) {}

  static of(settings: Settings): Logger {
    return new Logger(settings);
  }

  showDebugLog(message: string, startTs: number): void {
    if (this.settings.showLogAboutPerformanceInConsole) {
      console.log(buildLogMessage(message, performance.now() - startTs));
    }
  }
}

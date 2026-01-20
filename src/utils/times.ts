/**
 * Returns the current time in seconds since the Unix epoch.
 */
export function now(): number {
  return Math.ceil(Date.now() / 1000);
}

export type RelativeUpdatedPeriodUnit =
  | "minute"
  | "hour"
  | "day"
  | "month"
  | "year";

export interface RelativeUpdatedPeriodInfo {
  text: string;
  unit: RelativeUpdatedPeriodUnit;
}

export function formatRelativeUpdatedPeriod(
  baseMs: number,
  nowMs = Date.now(),
): RelativeUpdatedPeriodInfo {
  const diffMs = Math.max(0, nowMs - baseMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (diffMs < minuteMs) {
    return { text: "1m", unit: "minute" };
  }

  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return { text: `${Math.max(1, minutes)}m`, unit: "minute" };
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return { text: `${Math.max(1, hours)}h`, unit: "hour" };
  }

  if (diffMs < monthMs) {
    const days = Math.floor(diffMs / dayMs);
    return { text: `${Math.max(1, days)}d`, unit: "day" };
  }

  if (diffMs < yearMs) {
    const months = Math.floor(diffMs / monthMs);
    const clampedMonths = Math.min(11, Math.max(1, months));
    return { text: `${clampedMonths}M`, unit: "month" };
  }

  const years = Math.floor(diffMs / yearMs);
  return { text: `${Math.max(1, years)}Y`, unit: "year" };
}

/**
 * Returns the current time in seconds since the Unix epoch.
 */
export function now(): number {
  return Math.ceil(Date.now() / 1000);
}

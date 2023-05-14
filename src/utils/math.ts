/**
 * @example
 * ```typescript
 * round(34.5678, 2)
 *   // -> 34.56
 * round(0.1234, 1)
 *   // -> 0.1
 * ```
 */
export function round(n: number, decimalPlace: number): number {
  const x = 10 ** decimalPlace;
  return Math.round(n * x) / x;
}

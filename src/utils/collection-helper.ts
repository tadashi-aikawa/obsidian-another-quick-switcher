/**
 * Use as compareFn in sort
 */
export const sorter = <T, U extends number | string>(
  toOrdered: (t: T) => U,
  order: "asc" | "desc" = "asc"
) => {
  return (a: T, b: T) =>
    order === "asc"
      ? toOrdered(a) > toOrdered(b)
        ? 1
        : toOrdered(b) > toOrdered(a)
        ? -1
        : 0
      : toOrdered(a) < toOrdered(b)
      ? 1
      : toOrdered(b) < toOrdered(a)
      ? -1
      : 0;
};

export const groupBy = <T>(
  values: T[],
  toKey: (t: T) => string
): { [key: string]: T[] } =>
  values.reduce(
    (prev, cur, _1, _2, k = toKey(cur)) => (
      (prev[k] || (prev[k] = [])).push(cur), prev
    ),
    {} as { [key: string]: T[] }
  );

export const keyBy = <T>(
  values: T[],
  toKey: (t: T) => string
): { [key: string]: T } =>
  values.reduce(
    (prev, cur, _1, _2, k = toKey(cur)) => ((prev[k] = cur), prev),
    {} as { [key: string]: T }
  );

export function flatten<T>(matrix: T[][]): T[] {
  return [].concat(...matrix);
}

export function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

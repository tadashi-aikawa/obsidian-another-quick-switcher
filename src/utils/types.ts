export function isPresent<T>(arg: T | null | undefined): arg is T {
  return arg != null;
}

export type FrontmatterProperty =
  | string
  | number
  | string[]
  | number[]
  | boolean
  | null;

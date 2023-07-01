export function isPresent<T>(arg: T | null | undefined): arg is T {
  return arg != null;
}

export function autoAliasTransform(
  input: string,
  pattern: string,
  format: string,
): string {
  const _pattern = new RegExp(pattern);

  const match = (value: string) =>
    _pattern ? Boolean(value.match(_pattern)) : false;
  const replaceByPattern = (value: string) =>
    _pattern ? value.replace(_pattern, format) : value;

  return match(input) ? replaceByPattern(input) : input;
}

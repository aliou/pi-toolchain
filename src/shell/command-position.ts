/**
 * Find the position of a command name in the source string, starting
 * from `searchFrom`. Matches on word boundary to avoid matching inside
 * paths or URLs.
 */
export function findCommandPosition(
  source: string,
  name: string,
  searchFrom: number,
): number {
  let pos = searchFrom;
  while (pos < source.length) {
    const idx = source.indexOf(name, pos);
    if (idx === -1) return -1;

    // Check word boundaries: char before must be start-of-string or
    // a shell delimiter, char after must be end-of-string or delimiter.
    const before = idx > 0 ? source[idx - 1] : undefined;
    const after =
      idx + name.length < source.length ? source[idx + name.length] : undefined;

    const validBefore =
      before === undefined || /[\s;|&(]/.test(before) || before === "\n";
    const validAfter =
      after === undefined || /[\s;|&)]/.test(after) || after === "\n";

    if (validBefore && validAfter) return idx;

    pos = idx + 1;
  }
  return -1;
}

// skills/code-review/scripts/pr-ref.ts
//
// Pure PR-argument matching for pr-context.ts. No I/O — unit-testable.
//
// Accepted forms:
//   https://github.com/<owner>/<repo>/pull/<N>   (full URL, trailing path ok)
//   <owner>/<repo>#<N>                            (shorthand)
//   #<N>                                          (current repo)
//   <N>                                           (current repo)

export type PrRef =
  | { kind: "url" | "short"; owner: string; repo: string; number: number }
  | { kind: "num"; number: number };

export function matchPrRef(arg: string): PrRef | null {
  const url = arg.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (url && url[1] && url[2] && url[3]) {
    return { kind: "url", owner: url[1], repo: url[2], number: Number(url[3]) };
  }

  const short = arg.match(/^([^/\s]+)\/([^/\s]+)#(\d+)$/);
  if (short && short[1] && short[2] && short[3]) {
    return { kind: "short", owner: short[1], repo: short[2], number: Number(short[3]) };
  }

  // Bare number and #N both resolve against the current repo (done by caller).
  const num = arg.match(/^#?(\d+)$/);
  if (num && num[1]) {
    return { kind: "num", number: Number(num[1]) };
  }

  return null;
}

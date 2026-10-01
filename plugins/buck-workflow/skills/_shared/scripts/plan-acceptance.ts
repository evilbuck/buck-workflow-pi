/** Body acceptance boxes; only lowercase [x] is verified. */
export function planAcceptanceCriteria(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const heading = lines.findIndex((line) => /^## Acceptance criteria\s*$/.test(line));
  if (heading < 0) return [];
  const tail = lines.slice(heading + 1);
  const end = tail.findIndex((line) => /^##\s/.test(line));
  return (end < 0 ? tail : tail.slice(0, end)).filter((line) => /^\s*[-*]\s+\[[ xX]\]/.test(line));
}

export function unphasedCloseout(text: string): { closeEligible: boolean; openAcceptanceLines: string[] } {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const status = frontmatter?.[1].match(/^status:\s*(.*?)\s*$/m)?.[1];
  const openAcceptanceLines = planAcceptanceCriteria(text).filter((line) => !/^\s*[-*]\s+\[x\]/.test(line));
  return { closeEligible: status === "completed" && openAcceptanceLines.length === 0, openAcceptanceLines };
}

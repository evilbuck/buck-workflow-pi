function toPigLatinWord(word: string): string {
  const match = /^([^aeiouAEIOU]*)(.*)$/.exec(word);
  if (!match) return word;
  const [, cluster, rest] = match;
  if (cluster === "") return `${word}way`;
  if (rest === "") return `${word}ay`;
  return `${rest}${cluster}ay`;
}

export function toPigLatin(text: string): string {
  return text.replace(/[A-Za-z]+/g, toPigLatinWord);
}

/** OMP custom-tool factory. Discovered via package.json `omp.tools` and `tools/`. */
export default function pigLatinTool(pi: {
  zod: { object: (shape: Record<string, unknown>) => unknown; string: () => { describe: (s: string) => unknown } };
}) {
  return {
    name: "pig_latin",
    label: "Pig Latin",
    description: "Encode English text as Pig Latin and return the result.",
    loadMode: "essential" as const,
    approval: "read" as const,
    parameters: pi.zod.object({
      text: pi.zod.string().describe("English text to encode"),
    }),
    async execute(_toolCallId: string, params: { text: string }) {
      const encoded = toPigLatin(params.text);
      return {
        content: [{ type: "text", text: encoded }],
        details: { encoded },
      };
    },
  };
}

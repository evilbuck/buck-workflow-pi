export interface PrBodyInput {
  issueNumber: number;
  issueTitle: string;
  branch: string;
  diffSummary: string;
  buildArtifact: string;
  reviewArtifact: string;
}

export function generatePrBody(input: PrBodyInput): string {
  if (!input.diffSummary.trim()) {
    return `## Issue
Fixes #${input.issueNumber}: ${input.issueTitle}

## What changed
No changes detected — this PR is empty.

## Verification
_No diff to verify._

## Follow-ups
_None._
`;
  }

  return `## Issue
Fixes #${input.issueNumber}: ${input.issueTitle}

## What changed
${input.diffSummary}

## Verification
${input.buildArtifact || "_No build artifact provided._"}

${input.reviewArtifact || "_No review artifact provided._"}

## Follow-ups
_None._
`;
}

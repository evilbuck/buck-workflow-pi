export const reviewPayload = {
  id: 101,
  node_id: "PRR_kwDOReview101",
  user: { login: "reviewer" },
  body: "Please add a null check in parseArgs.",
  state: "CHANGES_REQUESTED",
  html_url: "https://github.com/acme/widgets/pull/42#pullrequestreview-101",
  commit_id: "aaa111",
  submitted_at: "2026-09-10T10:00:00Z",
};

export const inlineCommentPayload = {
  id: 201,
  node_id: "PRRC_kwDOInline201",
  user: { login: "reviewer" },
  body: "This can throw when input is empty.",
  path: "src/parse.ts",
  line: 12,
  original_line: 12,
  original_commit_id: "aaa111",
  html_url: "https://github.com/acme/widgets/pull/42#discussion_r201",
  created_at: "2026-09-10T10:01:00Z",
  updated_at: "2026-09-10T10:01:00Z",
  in_reply_to_id: null,
};

export const editedInlineCommentPayload = {
  ...inlineCommentPayload,
  body: "This can throw when input is empty. Also handle whitespace.",
  updated_at: "2026-09-10T11:00:00Z",
};

export const outdatedInlineCommentPayload = {
  ...inlineCommentPayload,
  id: 202,
  node_id: "PRRC_kwDOInline202",
  line: null,
  original_line: 12,
  body: "Old line comment",
  html_url: "https://github.com/acme/widgets/pull/42#discussion_r202",
};

export const conversationCommentPayload = {
  id: 301,
  node_id: "IC_kwDOConv301",
  user: { login: "maintainer" },
  body: "Please keep the change scoped to parseArgs.",
  html_url: "https://github.com/acme/widgets/pull/42#issuecomment-301",
  created_at: "2026-09-10T10:05:00Z",
  updated_at: "2026-09-10T10:05:00Z",
};

export const reviewThreadsGraphql = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: "PRRT_kwDOThread1",
              isResolved: true,
              isOutdated: false,
              comments: {
                nodes: [
                  {
                    id: "PRRC_kwDOInline201",
                    body: "This can throw when input is empty.",
                    path: "src/parse.ts",
                    line: 12,
                    author: { login: "reviewer" },
                    url: "https://github.com/acme/widgets/pull/42#discussion_r201",
                    createdAt: "2026-09-10T10:01:00Z",
                    updatedAt: "2026-09-10T10:01:00Z",
                  },
                ],
              },
            },
            {
              id: "PRRT_kwDOThread2",
              isResolved: false,
              isOutdated: true,
              comments: {
                nodes: [
                  {
                    id: "PRRC_kwDOInline202",
                    body: "Old line comment",
                    path: "src/parse.ts",
                    line: null,
                    author: { login: "reviewer" },
                    url: "https://github.com/acme/widgets/pull/42#discussion_r202",
                    createdAt: "2026-09-10T09:00:00Z",
                    updatedAt: "2026-09-10T09:00:00Z",
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
};

export const checkRollupSuccess = {
  name: "required-ci",
  status: "COMPLETED",
  conclusion: "SUCCESS",
};

export const checkRollupPending = {
  name: "required-ci",
  status: "IN_PROGRESS",
  conclusion: null,
};

export const checkRollupFailure = {
  name: "required-ci",
  status: "COMPLETED",
  conclusion: "FAILURE",
};

export const mergeabilityMergeable = {
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
};

export const mergeabilityConflict = {
  mergeable: "CONFLICTING",
  mergeStateStatus: "DIRTY",
};

export const autoMergeEnabled = {
  enabledAt: "2026-09-10T12:00:00Z",
  mergeMethod: "SQUASH",
};

export const pullRequestOpen = {
  number: 42,
  url: "https://github.com/acme/widgets/pull/42",
  state: "OPEN",
  isDraft: false,
  headRefName: "feat/parse",
  baseRefName: "main",
  headRefOid: "bbb222",
  baseRefOid: "ccc333",
  reviewDecision: "REVIEW_REQUIRED",
  autoMergeRequest: null,
  commits: { nodes: [{ commit: { oid: "bbb222", statusCheckRollup: { state: "SUCCESS", contexts: { nodes: [checkRollupSuccess] } } } }] },
};

export const pullRequestMerged = {
  ...pullRequestOpen,
  state: "MERGED",
  merged: true,
  mergeCommit: { oid: "ddd444" },
  mergedAt: "2026-09-10T13:00:00Z",
};

export const pullRequestClosed = {
  ...pullRequestOpen,
  state: "CLOSED",
  merged: false,
};

export const repositoryMergeCapabilities = {
  squashMergeAllowed: true,
  rebaseMergeAllowed: true,
  mergeCommitAllowed: true,
  autoMergeAllowed: true,
};

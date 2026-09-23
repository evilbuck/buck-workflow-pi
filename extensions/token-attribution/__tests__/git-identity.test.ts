import { describe, expect, it } from "vitest";
import { resolveGitIdentity, type GitRunner } from "../git-identity.js";

function runner(outputs: Record<string, string | Error>): GitRunner {
  return async (args) => {
    const key = args.join(" ");
    const result = outputs[key];
    if (result instanceof Error) throw result;
    if (result === undefined) throw new Error(`unexpected git call: ${key}`);
    return result;
  };
}

describe("resolveGitIdentity", () => {
  it("uses the shared origin as project identity while preserving each worktree branch", async () => {
    const common = {
      "remote get-url origin": "git@github.com:evilbuck/buck-workflow-pi.git\n",
      "rev-parse --show-toplevel": "/repo/worktree\n",
      "rev-parse --git-common-dir": "/repo/main/.git\n",
    };

    const feature = await resolveGitIdentity("/repo/worktree", runner({
      ...common,
      "rev-parse --abbrev-ref HEAD": "feature/token-attribution\n",
    }));
    const main = await resolveGitIdentity("/repo/main", runner({
      ...common,
      "rev-parse --show-toplevel": "/repo/main\n",
      "rev-parse --abbrev-ref HEAD": "main\n",
    }));

    expect(feature).toEqual({
      projectKey: "git@github.com:evilbuck/buck-workflow-pi.git",
      branch: "feature/token-attribution",
      worktreeRoot: "/repo/worktree",
      detached: false,
    });
    expect(main.projectKey).toBe(feature.projectKey);
    expect(main.branch).toBe("main");
  });

  it("falls back to cwd with no branch outside git", async () => {
    const identity = await resolveGitIdentity("/tmp/plain", async () => {
      throw new Error("not a git repository");
    });

    expect(identity).toEqual({
      projectKey: "/tmp/plain",
      branch: null,
      worktreeRoot: "/tmp/plain",
      detached: false,
    });
  });

  it("names detached heads by short commit", async () => {
    const identity = await resolveGitIdentity("/repo/worktree", runner({
      "rev-parse --show-toplevel": "/repo/worktree\n",
      "rev-parse --git-common-dir": "/repo/main/.git\n",
      "remote get-url origin": "https://example.test/repo.git\n",
      "rev-parse --abbrev-ref HEAD": "HEAD\n",
      "rev-parse --short HEAD": "abc1234\n",
    }));

    expect(identity.branch).toBe("detached/abc1234");
    expect(identity.detached).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { redactRemoteCredentials } from "../token-attribution/git-identity.js";
import { resolveRememberIdentity, type SqlGitRunner } from "./identity.js";

function runner(outputs: Record<string, string | null>): SqlGitRunner {
  return async (args) => {
    const key = args.slice(2).join(" ");
    return key in outputs ? outputs[key]! : null;
  };
}

describe("resolveRememberIdentity", () => {
  it("returns email, origin, branch, and commit when every query succeeds", async () => {
    const identity = await resolveRememberIdentity("/cwd", runner({
      "config user.email": "you@example.test",
      "remote get-url origin": "https://example.test/acme/project.git",
      "rev-parse --abbrev-ref HEAD": "main",
      "rev-parse HEAD": "298c503bb9edb4fa87c26cb7f7d1fda99643e66fd1",
    }));
    expect(identity).toEqual({
      email: "you@example.test",
      origin: "https://example.test/acme/project.git",
      branch: "main",
      commit: "298c503bb9edb4fa87c26cb7f7d1fda99643e66fd1",
    });
  });

  it("fails closed when email is missing", async () => {
    await expect(resolveRememberIdentity("/cwd", runner({
      "config user.email": null,
      "remote get-url origin": "git@github.com:acme/project.git",
    }))).rejects.toThrow(/user.email/);
  });

  it("fails closed when origin is missing", async () => {
    await expect(resolveRememberIdentity("/cwd", runner({
      "config user.email": "you@example.test",
      "remote get-url origin": null,
    }))).rejects.toThrow(/origin/);
  });

  it("stores detached HEAD as null branch and null commit", async () => {
    const identity = await resolveRememberIdentity("/cwd", runner({
      "config user.email": "you@example.test",
      "remote get-url origin": "git@github.com:acme/project.git",
      "rev-parse --abbrev-ref HEAD": "HEAD",
      "rev-parse HEAD": "298c503bb9edb4fa87c26cb7f7d1fda99643e66fd1",
    }));
    expect(identity.branch).toBeNull();
    expect(identity.commit).toBeNull();
  });

  it("redacts embedded credentials in URL-form origins", async () => {
    const identity = await resolveRememberIdentity("/cwd", runner({
      "config user.email": "you@example.test",
      "remote get-url origin": "https://alice:bob@example.test/acme/project.git",
      "rev-parse --abbrev-ref HEAD": "main",
      "rev-parse HEAD": "298c503bb9edb4fa87c26cb7f7d1fda99643e66fd1",
    }));
    expect(identity.origin).toBe("https://example.test/acme/project.git");
    expect(identity.origin).not.toContain("alice");
    expect(identity.origin).not.toContain("bob");
  });

  it("passes scp-style remotes through unchanged", () => {
    expect(redactRemoteCredentials("git@github.com:acme/project.git")).toBe("git@github.com:acme/project.git");
  });
});
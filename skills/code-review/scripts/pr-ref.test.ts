import { describe, expect, test } from "vitest";
import { matchPrRef } from "./pr-ref.js";

describe("matchPrRef", () => {
  test("parses full GitHub URL", () => {
    expect(matchPrRef("https://github.com/octocat/hello-world/pull/42")).toEqual({
      kind: "url",
      owner: "octocat",
      repo: "hello-world",
      number: 42,
    });
  });

  test("parses URL with trailing path", () => {
    expect(matchPrRef("https://github.com/a/b/pull/7/files")).toEqual({
      kind: "url",
      owner: "a",
      repo: "b",
      number: 7,
    });
  });

  test("parses http URL", () => {
    expect(matchPrRef("http://github.com/a/b/pull/7")).toEqual({
      kind: "url",
      owner: "a",
      repo: "b",
      number: 7,
    });
  });

  test("parses owner/repo#N shorthand", () => {
    expect(matchPrRef("octocat/hello-world#42")).toEqual({
      kind: "short",
      owner: "octocat",
      repo: "hello-world",
      number: 42,
    });
  });

  test("parses bare number as current-repo ref", () => {
    expect(matchPrRef("42")).toEqual({ kind: "num", number: 42 });
  });

  test("parses #N as current-repo ref", () => {
    expect(matchPrRef("#42")).toEqual({ kind: "num", number: 42 });
  });

  test("rejects garbage", () => {
    for (const bad of [
      "",
      "abc",
      "owner/repo",
      "#",
      "#abc",
      "github.com/a/b/pull/1",
      "https://github.com/a",
      "a/b#x",
      "12#3",
      "a/b/c#1",
    ]) {
      expect(matchPrRef(bad), `expected null for ${JSON.stringify(bad)}`).toBeNull();
    }
  });
});

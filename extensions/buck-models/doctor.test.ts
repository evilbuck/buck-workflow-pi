import { describe, expect, it } from "vitest";
import {
  buildDoctorReport,
  resolveEffectiveActive,
  type DoctorLoad,
} from "./doctor.js";
import type { BuckModelsConfig } from "../omp-models.js";

function profile(stages: BuckModelsConfig["profiles"][string]["stages"]): BuckModelsConfig["profiles"][string] {
  return { stages };
}

function config(
  active: string,
  profiles: Record<string, BuckModelsConfig["profiles"][string]>,
): BuckModelsConfig {
  return { active, profiles };
}

const available = new Set(["provider/here", "provider/ok", "global/alpha"]);

describe("/buck-models --doctor active resolution", () => {
  it("honors a nonblank project active even when global also has one", () => {
    const load: DoctorLoad = {
      project: config("work", { work: profile({ build: { models: [{ id: "x" }], thinking: "off" } }) }),
      global: config("global-active", { "global-active": profile({}) }),
      invalidPath: null,
      availableIds: available,
    };
    expect(resolveEffectiveActive(load)).toMatchObject({
      name: "work",
      source: "project",
      health: "ok",
    });
  });

  it("falls through to a nonblank global active when project is blank", () => {
    const load: DoctorLoad = {
      project: config(" ", {}),
      global: config("portable", { portable: profile({}) }),
      invalidPath: null,
      availableIds: available,
    };
    expect(resolveEffectiveActive(load)).toMatchObject({
      name: "portable",
      source: "global",
      health: "ok",
    });
  });

  it("uses the sole configured profile when both actives are blank", () => {
    const load: DoctorLoad = {
      project: config("", {}),
      global: config("", { Default: profile({}) }),
      invalidPath: null,
      availableIds: available,
    };
    expect(resolveEffectiveActive(load)).toMatchObject({
      name: "Default",
      source: "global",
      health: "ok",
    });
  });

  it("reports unknown when the configured active name has no profile in either scope", () => {
    const load: DoctorLoad = {
      project: config("ghost", {}),
      global: config("", { other: profile({}) }),
      invalidPath: null,
      availableIds: available,
    };
    expect(resolveEffectiveActive(load)).toMatchObject({
      name: "ghost",
      source: "project",
      health: "unknown",
    });
  });

  it("reports blank when multiple profiles exist and no active is set", () => {
    const load: DoctorLoad = {
      project: config("", { work: profile({}) }),
      global: config("", { personal: profile({}) }),
      invalidPath: null,
      availableIds: available,
    };
    expect(resolveEffectiveActive(load)).toMatchObject({
      name: null,
      source: null,
      health: "blank",
      configuredProfiles: ["personal", "work"],
    });
  });
});

describe("buildDoctorReport", () => {
  it("classifies available and unavailable ids, marks the active, and orders profiles deterministically", () => {
    const load: DoctorLoad = {
      project: config("work", {
        work: profile({
          build: { models: [{ id: "provider/here" }], thinking: "off" },
          review: { models: [{ id: "provider/missing" }], thinking: "low" },
        }),
      }),
      global: config("", {
        shared: profile({
          "brainstorm-plan": { models: [{ id: "global/alpha" }, { id: "provider/ok" }], thinking: "off" },
        }),
      }),
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("warning");
    expect(report.configuredOccurrences).toBe(4);
    expect(report.uniqueIds).toBe(4);
    expect(report.unavailableOccurrences).toBe(1);
    expect(report.active).toMatchObject({ name: "work", source: "project", health: "ok" });
    expect(report.profiles.map((p) => `${p.scope}/${p.name}`)).toEqual([
      "project/work",
      "global/shared",
    ]);
    const work = report.profiles[0]!;
    expect(work.stages.find((s) => s.stage === "build")?.models[0]?.status).toBe("available");
    expect(work.stages.find((s) => s.stage === "review")?.models[0]?.status).toBe("unavailable");
    expect(report.text).toMatch(/WARNING: 4 configured occurrence\(s\), 4 unique id\(s\), 1 unavailable\./);
    expect(report.text).toContain("Active: work (project)");
    expect(report.text).toContain("[project] work *active*");
    expect(report.text).toContain("provider/missing [MISSING]");
    expect(report.text).toContain("global/alpha [ok]");
  });

  it("counts repeated ids as multiple occurrences but one unique id", () => {
    const load: DoctorLoad = {
      project: null,
      global: config("solo", {
        solo: profile({
          build: { models: [{ id: "provider/here" }], thinking: "off" },
          review: { models: [{ id: "provider/here" }], thinking: "off" },
        }),
      }),
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.configuredOccurrences).toBe(2);
    expect(report.uniqueIds).toBe(1);
    expect(report.unavailableOccurrences).toBe(0);
    expect(report.severity).toBe("info");
  });

  it("emits info when every configured id is available", () => {
    const load: DoctorLoad = {
      project: config("clean", { clean: profile({ build: { models: [{ id: "provider/ok" }], thinking: "off" } }) }),
      global: null,
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("info");
    expect(report.text).toMatch(/INFO: 1 configured occurrence\(s\), 1 unique id\(s\), 0 unavailable\./);
  });

  it("downgrades to warning when active is blank with multiple profiles", () => {
    const load: DoctorLoad = {
      project: config("", { work: profile({}) }),
      global: config("", { personal: profile({}) }),
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("warning");
    expect(report.active.health).toBe("blank");
    expect(report.text).toContain("Active: (none)");
    expect(report.text).toContain("blank selection, multiple profiles exist");
  });

  it("flags unknown active selection without hiding other profile availability", () => {
    const load: DoctorLoad = {
      project: config("ghost", {}),
      global: config("", { work: profile({ build: { models: [{ id: "provider/ok" }], thinking: "off" } }) }),
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("warning");
    expect(report.text).toContain("Active: ghost — UNKNOWN");
    expect(report.text).toContain("provider/ok [ok]");
    expect(report.profiles).toHaveLength(1);
  });

  it("treats absent config files as valid empty scopes", () => {
    const load: DoctorLoad = {
      project: null,
      global: null,
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("info");
    expect(report.profiles).toEqual([]);
    expect(report.text).toContain("No configured Buck model profiles.");
  });

  it("returns an error severity when the registry is unavailable", () => {
    const load: DoctorLoad = {
      project: config("work", { work: profile({ build: { models: [{ id: "x" }], thinking: "off" } }) }),
      global: null,
      invalidPath: null,
      availableIds: null,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("error");
    expect(report.text).toContain("Model registry unavailable");
  });

  it("returns an error severity when a config file is invalid", () => {
    const load: DoctorLoad = {
      project: config("work", { work: profile({}) }),
      global: null,
      invalidPath: "/tmp/bad.yml",
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("error");
    expect(report.text).toContain('buckModels config at "/tmp/bad.yml" is not valid YAML');
  });

  it("marks user-global ownership for stages defined only in the global scope", () => {
    const load: DoctorLoad = {
      project: config("", {}),
      global: config("portable", {
        portable: profile({ "brainstorm-plan": { models: [{ id: "global/alpha" }], thinking: "off" } }),
      }),
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.profiles[0]?.stages[0]?.ownedBy).toBe("user-global");
    expect(report.text).toContain("user-global");
  });

  it("produces identical text for repeated runs on the same load", () => {
    const load: DoctorLoad = {
      project: config("work", { work: profile({ build: { models: [{ id: "provider/here" }], thinking: "off" } }) }),
      global: config("", {}),
      invalidPath: null,
      availableIds: available,
    };
    const first = buildDoctorReport(load);
    const second = buildDoctorReport(load);
    expect(first.text).toBe(second.text);
  });

  it("keeps same-name scope rows separate and counts overridden global stages", () => {
    const load: DoctorLoad = {
      project: config("", {
        shared: profile({ build: { models: [{ id: "provider/project" }], thinking: "off" } }),
      }),
      global: config("shared", {
        shared: profile({
          build: { models: [{ id: "provider/global" }], thinking: "off" },
          review: { models: [{ id: "provider/review" }], thinking: "off" },
        }),
      }),
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.profiles).toHaveLength(2);
    const [projectRow, globalRow] = report.profiles;
    expect(projectRow).toMatchObject({ scope: "project", name: "shared" });
    expect(globalRow).toMatchObject({ scope: "global", name: "shared" });
    // Project row shows its configured build plus the inherited review stage.
    expect(projectRow!.stages.map((stage) => [stage.stage, stage.ownedBy])).toEqual([
      ["build", "project"],
      ["review", "user-global"],
    ]);
    // Global row keeps all of its own configured stages visible.
    expect(globalRow!.stages.map((stage) => [stage.stage, stage.ownedBy])).toEqual([
      ["build", "user-global"],
      ["review", "user-global"],
    ]);
    expect(report.configuredOccurrences).toBe(3);
    expect(report.uniqueIds).toBe(3);
    expect(report.unavailableOccurrences).toBe(3);
    expect(report.severity).toBe("warning");
    // Active marker lands on the global row that sourced `active: shared`.
    expect(report.text).toContain("[user-global] shared *active*");
    expect(report.text).not.toContain("[project] shared *active*");
  });

  it("resolves a global active selecting a project-only profile name, matching runtime routing", () => {
    const load: DoctorLoad = {
      project: config("", { work: profile({ build: { models: [{ id: "provider/here" }], thinking: "off" } }) }),
      global: config("work", {}),
      invalidPath: null,
      availableIds: available,
    };
    expect(resolveEffectiveActive(load)).toMatchObject({
      name: "work",
      source: "global",
      health: "ok",
    });
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("info");
    expect(report.text).toContain("Active: work (global)");
    expect(report.text).toContain("[project] work *active*");
  });

  it("warns for an unknown active even when no profiles exist", () => {
    const load: DoctorLoad = {
      project: config("ghost", {}),
      global: null,
      invalidPath: null,
      availableIds: available,
    };
    const report = buildDoctorReport(load);
    expect(report.severity).toBe("warning");
    expect(report.text).toContain("Active: ghost — UNKNOWN");
  });
});
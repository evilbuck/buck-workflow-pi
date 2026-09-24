import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { wire as wireTpsTracker } from "./tps-tracker.js";
import { wire as wireBprImproved } from "./b-pr-improved/index.js";
import { wire as wireBCommitImproved } from "./b-commit-improved/index.js";
import { wire as wireKamalRelease } from "./b-kamal-release/index.js";
import { wire as wirePlanArtifact } from "./plan-artifact.js";
import { wire as wireBSaveImproved } from "./b-save-improved/index.js";
import { wire as wireCodeReviewIteration } from "./code-review-iteration/index.js";
import { wireBuckLoop } from "./buck-loop/index.js";
import { wire as wireJevTool } from "./jev-tool/index.js";
import { wire as wireTokenAttribution } from "./token-attribution/index.js";
import { wireInteractiveModelSwitch } from "./interactive-model-switch.js";

export default function (pi: ExtensionAPI) {
  wireTpsTracker(pi);
  wireTokenAttribution(pi);
  wireBprImproved(pi);
  wireBCommitImproved(pi);
  wireKamalRelease(pi);
  wirePlanArtifact(pi);
  wireBSaveImproved(pi);
  wireCodeReviewIteration(pi);
  wireBuckLoop(pi);
  wireJevTool(pi);
  wireInteractiveModelSwitch(pi);
}

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workerHome = mkdtempSync(join(tmpdir(), "buck-vitest-xdg-"));
process.env.BUCK_VITEST_CONFIG_HOME = workerHome;
process.env.XDG_CONFIG_HOME = workerHome;

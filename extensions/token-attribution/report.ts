import type { AttributionDatabase, GroupRow } from "./db.js";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function money(value: number | null): string {
  return value === null ? "unavailable" : `$${value.toFixed(4)}`;
}

function table(title: string, rows: GroupRow[]): string {
  const width = Math.max("Name".length, ...rows.map((row) => row.label.length));
  return [
    title,
    `${"Name".padEnd(width)}  Tokens  Estimated cost`,
    ...rows.map((row) => `${row.label.padEnd(width)}  ${integer.format(row.total_tokens)}  ${money(row.cost_usd)}`),
  ].join("\n");
}

export function buildTokenReport(
  ledger: AttributionDatabase,
  currentProjectKey: string,
  rawArgument: string,
): string {
  const argument = rawArgument.trim();
  const branch = argument && ledger.hasBranch(currentProjectKey, argument) ? argument : undefined;

  if (argument && branch === undefined) {
    const projects = ledger.matchingProjects(argument);
    if (projects.length === 0) return "No attributed turns yet.";
    const width = Math.max("Project".length, ...projects.map((row) => row.project_key.length));
    return [
      `Projects matching: ${argument}`,
      `${"Project".padEnd(width)}  Tokens  Estimated cost`,
      ...projects.map((row) => `${row.project_key.padEnd(width)}  ${integer.format(row.total_tokens)}  ${money(row.cost_usd)}`),
    ].join("\n");
  }

  const total = ledger.total(currentProjectKey, branch);
  if (!total) return "No attributed turns yet.";

  const heading = [
    `Project: ${currentProjectKey}`,
    ...(branch ? [`Branch: ${branch}`] : []),
    `${integer.format(total.total_tokens)} tokens`,
    `Estimated cost: ${money(total.cost_usd)}`,
  ];
  const branchRows = branch ? [] : ledger.groups(currentProjectKey, "branch");
  const modelRows = ledger.groups(currentProjectKey, "model", branch);

  return [
    ...heading,
    ...(branchRows.length ? ["", table("By branch", branchRows)] : []),
    "",
    table("By provider/model", modelRows),
  ].join("\n");
}

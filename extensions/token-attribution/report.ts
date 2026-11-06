import type { AttributionDatabase, AttributionRecord, GroupRow, TotalRow } from "./db.js";

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

function total(rows: readonly AttributionRecord[]): TotalRow {
  let tokens = 0;
  let cost: number | null = null;
  for (const row of rows) {
    tokens += row.totalTokens;
    if (row.costUsd !== null) cost = (cost ?? 0) + row.costUsd;
  }
  return { total_tokens: tokens, cost_usd: cost };
}

function groups(rows: readonly AttributionRecord[], labelFor: (row: AttributionRecord) => string): GroupRow[] {
  const grouped = new Map<string, AttributionRecord[]>();
  for (const row of rows) {
    const label = labelFor(row);
    const members = grouped.get(label) ?? [];
    members.push(row);
    grouped.set(label, members);
  }
  return [...grouped].map(([label, members]) => ({ label, ...total(members) }))
    .sort((a, b) => b.total_tokens - a.total_tokens || a.label.localeCompare(b.label));
}

function renderProjectReport(projectRows: readonly AttributionRecord[], currentProjectKey: string, branch: string | undefined): string {
  const rows = branch === undefined ? projectRows : projectRows.filter((row) => row.branch === branch);
  if (rows.length === 0) return "No attributed turns yet.";
  const summed = total(rows);
  const heading = [
    `Project: ${currentProjectKey}`,
    ...(branch ? [`Branch: ${branch}`] : []),
    `${integer.format(summed.total_tokens)} tokens`,
    `Estimated cost: ${money(summed.cost_usd)}`,
  ];
  const branchRows = branch ? [] : groups(rows, (row) => row.branch ?? "(none)");
  const modelRows = groups(rows, (row) => `${row.provider}/${row.model}`);
  return [
    ...heading,
    ...(branchRows.length ? ["", table("By branch", branchRows)] : []),
    "",
    table("By provider/model", modelRows),
  ].join("\n");
}

export async function buildTokenReport(
  ledger: AttributionDatabase,
  cwd: string,
  currentProjectKey: string,
  rawArgument: string,
): Promise<string> {
  const records = await ledger.records(cwd);
  const projectRows = records.filter((row) => row.projectKey === currentProjectKey);
  const argument = rawArgument.trim();
  const branch = argument && projectRows.some((row) => row.branch === argument) ? argument : undefined;

  if (argument && branch === undefined) {
    const substring = argument.toLowerCase();
    const projects = groups(records.filter((row) => row.projectKey.toLowerCase().includes(substring)), (row) => row.projectKey)
      .map(({ label, ...row }) => ({ project_key: label, ...row }));
    if (projects.length === 0) return "No attributed turns yet.";
    const width = Math.max("Project".length, ...projects.map((row) => row.project_key.length));
    return [
      `Projects matching: ${argument}`,
      `${"Project".padEnd(width)}  Tokens  Estimated cost`,
      ...projects.map((row) => `${row.project_key.padEnd(width)}  ${integer.format(row.total_tokens)}  ${money(row.cost_usd)}`),
    ].join("\n");
  }

  return renderProjectReport(projectRows, currentProjectKey, branch);
}

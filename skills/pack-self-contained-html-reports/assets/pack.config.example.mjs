// pack.config.mjs — the only file the user edits to add a report.
// Each report becomes one .docapp inside the packed file.
//
//   key    unique short identifier (used for the switcher, hash routing, href rewriting)
//   file   sibling source HTML; its <body> is folded into the packed file
//   label  switcher button text shown at the top
//   title  document.title set when this report is active
//   tone   optional, "primary" (default) | "ref" — picks the switcher color when selected
//
// Rebuild with:
//   bun ${BUCK_WORKFLOW_ROOT:-$HOME/projects/development_tools/buck-workflow-pi}/skills/pack-self-contained-html-reports/scripts/pack.mjs --dir <this dir>
//
// To add a third report: append one object to `reports`. Keys must be unique, files must exist.
export default {
  out: "packed-reports.html",
  brand: "Reports",
  index: null,                 // optional: path to an index.html whose KB chip should be refreshed
  reports: [
    { key: "alpha", file: "alpha.html", label: "Alpha",
      title: "Alpha report" },
    { key: "beta",  file: "beta.html",  label: "Beta",
      title: "Beta report", tone: "ref" },
  ],
};
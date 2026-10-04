# Sources: review severity weighting

Access date: 2026-10-03.

## Local

### `extensions/buck-loop/machine.ts`

- `iterateWins()` is `Boolean(report?.iterateArtifact)`.
- Review exits: iterating if iterate artifact or unparseable choice; documenting if docs/howto and no iterate artifact; saving if clean and parseable.

### `extensions/buck-loop/types.ts`

- `ReviewFacts` is `pending` or `{ parseable, iterateArtifact, docsImpact, howtoImpact }`.
- `LoopState` has no ranking state. `WorkState` excludes only `idle`, `resolving`, `blocked`, `done`, `aborted`.

### `extensions/typed-output/evaluator.ts`

- Legal question types: `noul`, `choice`, `score`.
- Choice needs at least two criteria labels. Score needs an ordered array of at least two labels.

### `extensions/buck-loop/choice-ranking.ts`

- Display-only score, criteria `["Very unlikely", "Unlikely", "Plausible", "Likely", "Very likely"]`.
- Valid score is a finite number in `[0, 4]`. Failure does not select.

### `extensions/buck-loop/choice.ts`

- Route selection is a `choice` question over the legal set.
- Jev miss falls through to the profile chat model, then blocks. That path must not be reused for severity.

### `skills/b-review/SKILL.md`

- In-plan issues write `iterate-*.md`. Out-of-plan issues do not.
- Axes stay separate. A merged ranking is explicitly forbidden because a standards nit can mask a spec violation.
- Iterate artifact sections: `Critical Issues`, `Warnings`. Those labels are authored, not judged.

## External

Access date: 2026-10-03.

### FIRST CVSS v3.1

- https://www.first.org/cvss/v3-1/specification-document
- Qualitative scale: None 0.0, Low 0.1–3.9, Medium 4.0–6.9, High 7.0–8.9, Critical 9.0–10.0.
- Scope is a scored base metric, not a gate. Regression is absent. No normative fix cutoff.

### FIRST CVSS v4.0

- https://www.first.org/cvss/v4.0/specification-document
- Same qualitative bands. Environmental metrics are the consumer hook for context. Supplemental metrics do not change the score.

### OWASP Risk Rating Methodology

- https://owasp.org/www-community/OWASP_Risk_Rating_Methodology
- `Risk = Likelihood × Impact`. Factors 0–9, averaged, then a 3×3 matrix.
- Fix rule: the most severe risks first; not all risks are worth fixing.

### ISO 31000:2018

- https://www.iso.org/standard/43170.html
- Risk is the effect of uncertainty on objectives. Scope, context, and criteria frame the assessment. No numeric weights in the standard.

### Microsoft MSRC online-services bug bar

- https://www.microsoft.com/en-us/msrc/olsbugbar
- Severity is vulnerability type × data classification. Important and Critical are fixed first.

### GitHub Advisory Database and EPSS

- https://docs.github.com/code-security/security-advisories/working-with-global-security-advisories-from-the-github-advisory-database/about-the-github-advisory-database
- https://www.first.org/epss/
- Severity inherits CVSS bands. EPSS is a 0–1 exploitation probability, the closest standards-track `noul`.

### Mozilla Rapid Risk Assessment

- https://infosec.mozilla.org/guidelines/risk/likelihood_indicators
- Impact × likelihood matrix. Low likelihood caps high and maximum impact at medium risk.

### Regression literature

- Zimmermann et al., ICSE 2012, https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/zimmermann-icse-2012.pdf
- Regression and reopen history raise priority. No standard constant. Not used as a formula.

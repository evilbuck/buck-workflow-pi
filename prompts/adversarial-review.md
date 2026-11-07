---
description: Adversarial review of one GitHub pull request. Pass a PR number, #N, owner/repo#N, or full PR URL. Asks whether to post inline comments or save locally. Prove-it-fails stance. Not the constructive code-review-universal review.
---

# Adversarial Review

$ARGUMENTS

Pass one pull request reference:

- `/adversarial-review 123`
- `/adversarial-review #123`
- `/adversarial-review owner/repo#123`
- `/adversarial-review https://github.com/owner/repo/pull/123`

Load and follow the `adversarial-review` skill:

```
skills/adversarial-review/SKILL.md
```

The skill asks Post versus Local and waits. If a selector UI is available, use it for that question with those two options. Do not post until the user answers. Do not default.

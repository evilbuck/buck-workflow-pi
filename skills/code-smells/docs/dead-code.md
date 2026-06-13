# Dead Code

## Category

Dispensables

## Signs and Symptoms

A variable, parameter, field, method or class is no longer used (usually because it's obsolete).

## Reasons for the Problem

When requirements for the software have changed or corrections have been made, nobody had time to clean up the old code.

Such code could also be found in complex conditionals, when one of the branches becomes unreachable (due to error or other circumstances).

## Treatment

The quickest way to find dead code is to use a good IDE.

- Delete unused code and unneeded files.

- In the case of an unnecessary class, [Inline Class](/refactoring/inline-class) or [Collapse Hierarchy](/refactoring/collapse-hierarchy) can be applied if a subclass or superclass is used.

- To remove unneeded parameters, use [Remove Parameter](/refactoring/remove-parameter).

## Payoff

- Reduced code size.
- Simpler support.

---

Source: https://refactoring.guru/smells/dead-code

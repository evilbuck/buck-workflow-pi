# Speculative Generality

## Category

Dispensables

## Signs and Symptoms

There's an unused class, method, field or parameter.

## Reasons for the Problem

Sometimes code is created "just in case" to support anticipated future features that never get implemented. As a result, code becomes hard to understand and support.

## Treatment

- For removing unused abstract classes, try [Collapse Hierarchy](/refactoring/collapse-hierarchy).

- Unnecessary delegation of functionality to another class can be eliminated via [Inline Class](/refactoring/inline-class).

- Unused methods? Use [Inline Method](/refactoring/inline-method) to get rid of them.

- Methods with unused parameters should be given a look with the help of [Remove Parameter](/refactoring/remove-parameter).

- Unused fields can be simply deleted.

## Payoff

- Slimmer code.
- Easier support.

## When to Ignore

- If you're working on a framework, it's eminently reasonable to create functionality not used in the framework itself, as long as the functionality is needed by the framework's users.

- Before deleting elements, make sure that they aren't used in unit tests. This happens if tests need a way to get certain internal information from a class or perform special testing-related actions.

---

Source: https://refactoring.guru/smells/speculative-generality

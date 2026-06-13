# Message Chains

## Category

Couplers

## Signs and Symptoms

In code you see a series of calls resembling `$a->b()->c()->d()`.

## Reasons for the Problem

A message chain occurs when a client requests another object, that object requests yet another one, and so on. These chains mean that the client is dependent on navigation along the class structure. Any changes in these relationships require modifying the client.

## Treatment

- To delete a message chain, use [Hide Delegate](/refactoring/hide-delegate).
- Sometimes it's better to think of why the end object is being used. Perhaps it would make sense to use [Extract Method](/refactoring/extract-method) for this functionality and move it to the beginning of the chain, by using [Move Method](/refactoring/move-method).

## Payoff

- Reduces dependencies between classes of a chain.
- Reduces the amount of bloated code.

## When to Ignore

Overly aggressive delegate hiding can cause code in which it's hard to see where the functionality is actually occurring. Which is another way of saying, avoid the [Middle Man](/smells/middle-man) smell as well.

---

Source: https://refactoring.guru/smells/message-chains

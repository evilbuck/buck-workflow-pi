# Code Smells Catalog

Source: [Refactoring.Guru](https://refactoring.guru/refactoring/smells) by Alexander Shvets.

## Bloaters
Code, methods, and classes that have grown to unmanageable proportions.

- [Long Method](long-method.md) — methods with too many lines
- [Large Class](large-class.md) — classes trying to do too much
- [Primitive Obsession](primitive-obsession.md) — using primitives instead of small objects
- [Long Parameter List](long-parameter-list.md) — methods with too many parameters
- [Data Clumps](data-clumps.md) — groups of data that appear together

## Object-Orientation Abusers
Incomplete or incorrect application of OOP principles.

- [Alternative Classes with Different Interfaces](alternative-classes-with-different-interfaces.md)
- [Refused Bequest](refused-bequest.md) — subclasses that don't use inherited members
- [Switch Statements](switch-statements.md) — scattered conditional logic
- [Temporary Field](temporary-field.md) — fields only used in certain circumstances

## Change Preventers
Changes in one place force many changes elsewhere.

- [Divergent Change](divergent-change.md) — one class changed for multiple reasons
- [Parallel Inheritance Hierarchies](parallel-inheritance-hierarchies.md) — adding a class requires adding a parallel subclass
- [Shotgun Surgery](shotgun-surgery.md) — one change requires many small edits everywhere

## Dispensables
Unnecessary code that should be removed.

- [Comments](comments.md) — code that needs explanation (extract it!)
- [Duplicate Code](duplicate-code.md) — identical or similar code in multiple places
- [Data Class](data-class.md) — classes with only fields and getters/setters
- [Dead Code](dead-code.md) — unused code
- [Lazy Class](lazy-class.md) — classes that don't do enough
- [Speculative Generality](speculative-generality.md) — abstractions for "someday"

## Couplers
Excessive coupling or excessive delegation.

- [Feature Envy](feature-envy.md) — methods more interested in another class's data
- [Inappropriate Intimacy](inappropriate-intimacy.md) — classes that know too much about each other
- [Incomplete Library Class](incomplete-library-class.md) — libraries with missing features
- [Message Chains](message-chains.md) — chains of getter calls (`a.getB().getC()`)
- [Middle Man](middle-man.md) — classes that mostly delegate to another class

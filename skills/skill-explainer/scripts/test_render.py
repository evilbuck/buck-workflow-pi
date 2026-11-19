"""Characterization tests for render.py's validate().

Pins every error message validate emits, so section-splitting the function
cannot silently change what the operator sees.
"""

import unittest

import render

STEPS = [
    {
        "id": "s1",
        "label": "load",
        "actor": "script",
        "plain_english": "Load the skill file.",
    }
]


def valid_doc():
    return {
        "identity": {"name": "my-skill"},
        "steps": [dict(s) for s in STEPS],
        "transitions": [{"from": "s1", "to": "s1", "kind": "loop"}],
        "mutations": [{"kind": "create"}],
        "inputs": [{"source": "user"}],
    }


class ValidateGood(unittest.TestCase):
    def test_valid_document_has_no_problems(self):
        self.assertEqual(render.validate(valid_doc()), [])

    def test_defaults_are_accepted(self):
        doc = {"identity": {"name": "x"}, "steps": [dict(STEPS[0])]}
        self.assertEqual(render.validate(doc), [])


class ValidateIdentity(unittest.TestCase):
    def test_missing_identity_object(self):
        doc = valid_doc()
        del doc["identity"]
        self.assertIn(
            "identity: missing (need an object with at least `name`)",
            render.validate(doc),
        )

    def test_missing_identity_name(self):
        doc = valid_doc()
        doc["identity"] = {}
        self.assertIn("identity.name: missing", render.validate(doc))


class ValidateSteps(unittest.TestCase):
    def _doc_with_steps(self, steps):
        doc = valid_doc()
        doc["steps"] = steps
        return doc

    def test_missing_steps_short_circuits(self):
        doc = valid_doc()
        doc["steps"] = []
        # Early return: later sections are never checked.
        self.assertEqual(
            render.validate(doc),
            ["steps: missing or empty (need at least one step)"],
        )

    def test_non_object_step(self):
        problems = render.validate(self._doc_with_steps(["nope"]))
        self.assertIn("steps[0]: not an object", problems)

    def test_step_field_problems(self):
        step = {"id": "", "label": "", "actor": "alien"}
        problems = render.validate(self._doc_with_steps([step]))
        self.assertIn("steps[0].id: missing", problems)
        self.assertIn("steps[0].label: missing", problems)
        self.assertIn("steps[0].actor: 'alien' is not one of ['llm', 'script', 'tool', 'user']", problems)
        self.assertIn(
            "steps[0].plain_english: missing — this is the whole point of the report",
            problems,
        )

    def test_duplicate_step_ids(self):
        steps = [dict(STEPS[0]), dict(STEPS[0])]
        self.assertIn("steps: duplicate ids ['s1']", render.validate(self._doc_with_steps(steps)))


class ValidateTransitions(unittest.TestCase):
    def test_unknown_step_reference(self):
        doc = valid_doc()
        doc["transitions"] = [{"from": "s1", "to": "ghost"}]
        problems = render.validate(doc)
        self.assertIn("transitions[0].to: 'ghost' is not a step id", problems)
        self.assertNotIn("transitions[0].from: 's1' is not a step id", problems)

    def test_unknown_kind(self):
        doc = valid_doc()
        doc["transitions"] = [{"from": "s1", "to": "ghost", "kind": "teleport"}]
        self.assertIn(
            "transitions[0].kind: 'teleport' is not one of ['abort', 'branch', 'linear', 'loop']",
            render.validate(doc),
        )

    def test_kind_defaults_to_linear(self):
        doc = valid_doc()
        doc["transitions"] = [{"from": "s1", "to": "s1"}]
        self.assertEqual(render.validate(doc), [])

    def test_non_object_transition(self):
        doc = valid_doc()
        doc["transitions"] = ["nope"]
        self.assertIn("transitions[0]: not an object", render.validate(doc))


class ValidateListSections(unittest.TestCase):
    def test_mutation_kind_problem(self):
        doc = valid_doc()
        doc["mutations"] = [{"kind": "maybe"}]
        self.assertIn(
            "mutations[0].kind: 'maybe' is not one of ['create', 'delete', 'external', 'overwrite']",
            render.validate(doc),
        )

    def test_input_source_problem(self):
        doc = valid_doc()
        doc["inputs"] = [{"source": "vibes"}]
        self.assertIn(
            "inputs[0].source: 'vibes' is not one of ['env', 'file', 'tool', 'user']",
            render.validate(doc),
        )

    def test_none_entries_are_reported_not_crashed(self):
        doc = valid_doc()
        doc["mutations"] = [None]
        self.assertIn(
            "mutations[0].kind: None is not one of ['create', 'delete', 'external', 'overwrite']",
            render.validate(doc),
        )


if __name__ == "__main__":
    unittest.main()

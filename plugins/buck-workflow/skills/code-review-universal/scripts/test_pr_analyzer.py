#!/usr/bin/env python3
"""Tests for pr-analyzer.py (stdlib unittest, no extra deps)."""

import importlib.util
import os
import unittest

# The script has a hyphen in its name, so load it by path.
_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    'pr_analyzer', os.path.join(_HERE, 'pr-analyzer.py')
)
pr_analyzer = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pr_analyzer)

# Convenient aliases
FileStats = pr_analyzer.FileStats


# ═══════════════════════════════════════════════════════════════
# parse_diff — filename extraction (existing tests)
# ═══════════════════════════════════════════════════════════════

class ParseDiffFilenameTest(unittest.TestCase):
    def test_lib_prefixed_path(self):
        # "lib/" embeds a literal "b/" that the old regex swallowed.
        diff = (
            "diff --git a/lib/foo.py b/lib/foo.py\n"
            "index 1234567..89abcde 100644\n"
            "--- a/lib/foo.py\n"
            "+++ b/lib/foo.py\n"
            "@@ -1,2 +1,3 @@\n"
            " unchanged\n"
            "+added line\n"
            "-removed line\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'lib/foo.py')
        self.assertEqual(files[0].additions, 1)
        self.assertEqual(files[0].deletions, 1)

    def test_normal_path(self):
        diff = (
            "diff --git a/src/main.py b/src/main.py\n"
            "index 1111111..2222222 100644\n"
            "--- a/src/main.py\n"
            "+++ b/src/main.py\n"
            "@@ -0,0 +1 @@\n"
            "+print('hi')\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'src/main.py')

    def test_other_embedded_b_slash_prefixes(self):
        # web/ and db/ also contain a literal "b/".
        diff = (
            "diff --git a/web/x.js b/web/x.js\n"
            "+++ b/web/x.js\n"
            "+console.log(1)\n"
            "diff --git a/db/y.sql b/db/y.sql\n"
            "+++ b/db/y.sql\n"
            "+SELECT 1;\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual([f.filename for f in files], ['web/x.js', 'db/y.sql'])

    def test_rename_falls_back_to_b_side(self):
        diff = (
            "diff --git a/old/name.py b/new/name.py\n"
            "similarity index 100%\n"
            "rename from old/name.py\n"
            "rename to new/name.py\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'new/name.py')

    def test_mnemonicprefix_commit_to_worktree(self):
        # diff.mnemonicprefix=true emits c/ (commit) and w/ (worktree)
        # instead of a/ and b/ — e.g. `git diff HEAD`.
        diff = (
            "diff --git c/src/main.py w/src/main.py\n"
            "index 1111111..2222222 100644\n"
            "--- c/src/main.py\n"
            "+++ w/src/main.py\n"
            "@@ -1,2 +1,3 @@\n"
            " unchanged\n"
            "+added line\n"
            "-removed line\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'src/main.py')
        self.assertEqual(files[0].additions, 1)
        self.assertEqual(files[0].deletions, 1)

    def test_mnemonicprefix_index_to_worktree(self):
        # Plain `git diff` (worktree vs index) uses i/ and w/.
        diff = (
            "diff --git i/lib/foo.py w/lib/foo.py\n"
            "+++ w/lib/foo.py\n"
            "+x = 1\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'lib/foo.py')

    def test_mnemonicprefix_rename(self):
        # `rename to` line is the authoritative path under any prefix
        # style (it never has a prefix).
        diff = (
            "diff --git c/old/name.py w/new/name.py\n"
            "similarity index 100%\n"
            "rename from old/name.py\n"
            "rename to new/name.py\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'new/name.py')

    def test_noprefix(self):
        # diff.noprefix=true strips the prefixes entirely from the
        # diff header AND from the +++/--- lines. The header is the
        # authoritative signal that prefix-stripping is OFF.
        diff = (
            "diff --git src/x.py src/x.py\n"
            "--- src/x.py\n"
            "+++ src/x.py\n"
            "+x = 1\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'src/x.py')

    def test_noprefix_one_letter_directory(self):
        # Pathological: under noprefix, a path like `s/x.py` is a
        # real one-letter directory. Without header_prefixed tracking,
        # a naive strip would yield `x.py`. Header has no `letter/`
        # so we leave the path alone.
        diff = (
            "diff --git s/x.py s/x.py\n"
            "--- s/x.py\n"
            "+++ s/x.py\n"
            "+x = 1\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 's/x.py')

    def test_noprefix_deletion(self):
        # Under noprefix, `--- a/path` then `+++ /dev/null` is a
        # deletion. The state machine stores the old path on `---
        # and adopts it when `+++ /dev/null` arrives.
        diff = (
            "diff --git old/removed.py old/removed.py\n"
            "--- old/removed.py\n"
            "+++ /dev/null\n"
            "-gone\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'old/removed.py')
        self.assertEqual(files[0].deletions, 1)

    def test_prefixed_deletion(self):
        # Same shape under default a//b/ prefixes; ensures the
        # deferred `old_path` works with prefix-stripped paths too.
        diff = (
            "diff --git a/old/removed.py b/old/removed.py\n"
            "--- a/old/removed.py\n"
            "+++ /dev/null\n"
            "-gone\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'old/removed.py')

    def test_binary_file(self):
        # Binary entries have no `---`/`+++` lines — only the
        # `diff --git` header and a `Binary files ... differ`
        # note. The best-effort same-path fallback at the header
        # should still register the file so the triage helper can
        # report on it (with zero +/- counts, since binary diffs
        # have no line-level additions/deletions).
        diff = (
            "diff --git a/assets/logo.png b/assets/logo.png\n"
            "old mode 100644\n"
            "new mode 100755\n"
            "similarity index 100%\n"
            "Binary files a/assets/logo.png and b/assets/logo.png differ\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'assets/logo.png')
        self.assertEqual(files[0].additions, 0)
        self.assertEqual(files[0].deletions, 0)

    def test_chmod_only(self):
        # Pure mode-only change: no `---`/`+++` body, no rename,
        # just a `diff --git` header followed by `old mode` /
        # `new mode`. Same fallback as binary.
        diff = (
            "diff --git a/scripts/run.sh b/scripts/run.sh\n"
            "old mode 100644\n"
            "new mode 100755\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'scripts/run.sh')
        self.assertEqual(files[0].additions, 0)
        self.assertEqual(files[0].deletions, 0)

    def test_binary_file_mnemonicprefix(self):
        # Binary entry under diff.mnemonicprefix (this repo's config).
        # The header tokens differ (c/ vs w/) so the parser is in
        # `header_prefixed=True` mode; the same-path fallback uses
        # `[a-z]/(.+?) [a-z]/\1` to extract the path.
        diff = (
            "diff --git c/assets/banner.png w/assets/banner.png\n"
            "old mode 100644\n"
            "new mode 100755\n"
            "Binary files c/assets/banner.png and w/assets/banner.png differ\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'assets/banner.png')

    def test_chmod_only_mnemonicprefix(self):
        # Mode-only change under diff.mnemonicprefix — no `---`/`+++`
        # body, no rename. Same fallback as the binary case, with
        # the prefix-styled same-path regex.
        diff = (
            "diff --git c/scripts/run.sh w/scripts/run.sh\n"
            "old mode 100644\n"
            "new mode 100755\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'scripts/run.sh')

    def test_binary_file_noprefix(self):
        # Binary entry under diff.noprefix: header tokens are the
        # same bare path. The noprefix-form fallback
        # The noprefix-form fallback `^(.+?) \1$` extracts it.
        diff = (
            "diff --git assets/icon.svg assets/icon.svg\n"
            "Binary files assets/icon.svg and assets/icon.svg differ\n"
        )
        files = pr_analyzer.parse_diff(diff)
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0].filename, 'assets/icon.svg')


# ═══════════════════════════════════════════════════════════════
# detect_language
# ═══════════════════════════════════════════════════════════════

class DetectLanguageTest(unittest.TestCase):
    def test_common_extensions(self):
        cases = {
            'app.py': 'Python',
            'index.ts': 'TypeScript',
            'main.rs': 'Rust',
            'handler.go': 'Go',
            'App.java': 'Java',
            'Activity.kt': 'Kotlin',
            'ViewController.swift': 'Swift',
            'app.tsx': 'TypeScript/React',
            'style.css': 'CSS',
            'query.sql': 'SQL',
        }
        for filename, expected in cases.items():
            with self.subTest(filename=filename):
                self.assertEqual(pr_analyzer.detect_language(filename), expected)

    def test_unknown_extension(self):
        self.assertEqual(pr_analyzer.detect_language('data.xyz'), 'unknown')
        self.assertEqual(pr_analyzer.detect_language('Makefile'), 'unknown')

    def test_cpp_variants(self):
        for ext in ('.cpp', '.hpp', '.cc', '.cxx', '.hh', '.hxx'):
            with self.subTest(ext=ext):
                self.assertEqual(pr_analyzer.detect_language(f'file{ext}'), 'C++')


# ═══════════════════════════════════════════════════════════════
# is_test_file
# ═══════════════════════════════════════════════════════════════

class IsTestFileTest(unittest.TestCase):
    def test_python_test_prefix(self):
        self.assertTrue(pr_analyzer.is_test_file('tests/test_handler.py'))
        self.assertTrue(pr_analyzer.is_test_file('test_utils.py'))

    def test_python_test_suffix(self):
        self.assertTrue(pr_analyzer.is_test_file('handler_test.py'))

    def test_rust_test_suffix(self):
        self.assertTrue(pr_analyzer.is_test_file('src/my_module_test.rs'))
        self.assertTrue(pr_analyzer.is_test_file('parser_test.rs'))

    def test_go_test_suffix(self):
        self.assertTrue(pr_analyzer.is_test_file('handler_test.go'))
        self.assertTrue(pr_analyzer.is_test_file('pkg/auth_test.go'))

    def test_js_ts_test_and_spec(self):
        self.assertTrue(pr_analyzer.is_test_file('handler.test.ts'))
        self.assertTrue(pr_analyzer.is_test_file('utils.spec.js'))
        self.assertTrue(pr_analyzer.is_test_file('App.test.tsx'))

    def test_tests_directory(self):
        self.assertTrue(pr_analyzer.is_test_file('tests/conftest.py'))
        self.assertTrue(pr_analyzer.is_test_file('test/helpers.js'))

    def test_dunder_tests_directory(self):
        self.assertTrue(pr_analyzer.is_test_file('__tests__/Button.test.tsx'))

    def test_non_test_files_rejected(self):
        self.assertFalse(pr_analyzer.is_test_file('handler.go'))
        self.assertFalse(pr_analyzer.is_test_file('module.rs'))
        self.assertFalse(pr_analyzer.is_test_file('src/utils.py'))
        self.assertFalse(pr_analyzer.is_test_file('lib/parser.js'))
        self.assertFalse(pr_analyzer.is_test_file('contest.py'))

    def test_test_substring_not_matched(self):
        """Files containing 'test_' as substring must NOT be flagged."""
        self.assertFalse(pr_analyzer.is_test_file('latest_report.py'))
        self.assertFalse(pr_analyzer.is_test_file('contest_utils.py'))
        self.assertFalse(pr_analyzer.is_test_file('src/latest_handler.py'))


# ═══════════════════════════════════════════════════════════════
# is_config_file
# ═══════════════════════════════════════════════════════════════

class IsConfigFileTest(unittest.TestCase):
    def test_known_json_configs(self):
        self.assertTrue(pr_analyzer.is_config_file('package.json'))
        self.assertTrue(pr_analyzer.is_config_file('tsconfig.json'))
        self.assertTrue(pr_analyzer.is_config_file('.eslintrc.json'))

    def test_known_yaml_configs(self):
        self.assertTrue(pr_analyzer.is_config_file('docker-compose.yml'))
        self.assertTrue(pr_analyzer.is_config_file('.github/workflows/ci.yml'))
        self.assertTrue(pr_analyzer.is_config_file('.prettierrc.yml'))

    def test_known_toml_configs(self):
        self.assertTrue(pr_analyzer.is_config_file('Cargo.toml'))
        self.assertTrue(pr_analyzer.is_config_file('pyproject.toml'))

    def test_env_files(self):
        self.assertTrue(pr_analyzer.is_config_file('.env'))
        self.assertTrue(pr_analyzer.is_config_file('.env.local'))
        self.assertTrue(pr_analyzer.is_config_file('.env.production'))

    def test_config_in_filename(self):
        self.assertTrue(pr_analyzer.is_config_file('app.config.ts'))
        self.assertTrue(pr_analyzer.is_config_file('database_config.yml'))

    def test_data_files_rejected(self):
        """Data files must NOT be flagged as config."""
        self.assertFalse(pr_analyzer.is_config_file('data.json'))
        self.assertFalse(pr_analyzer.is_config_file('openapi.yaml'))
        self.assertFalse(pr_analyzer.is_config_file('swagger.json'))
        self.assertFalse(pr_analyzer.is_config_file('fixtures/sample.yml'))
        self.assertFalse(pr_analyzer.is_config_file('translations.json'))
        self.assertFalse(pr_analyzer.is_config_file('schema.toml'))

    def test_config_directory(self):
        self.assertTrue(pr_analyzer.is_config_file('config/settings.yaml'))
        self.assertTrue(pr_analyzer.is_config_file('config/database.yml'))
        self.assertTrue(pr_analyzer.is_config_file('src/config/settings.json'))

    def test_source_files_rejected(self):
        self.assertFalse(pr_analyzer.is_config_file('src/index.ts'))
        self.assertFalse(pr_analyzer.is_config_file('lib/utils.py'))


# ═══════════════════════════════════════════════════════════════
# calculate_complexity
# ═══════════════════════════════════════════════════════════════

class CalculateComplexityTest(unittest.TestCase):
    def test_empty_files(self):
        self.assertEqual(pr_analyzer.calculate_complexity([]), 0.0)

    def test_small_simple_change(self):
        files = [FileStats(filename='app.py', additions=5, deletions=2,
                           language='Python')]
        score = pr_analyzer.calculate_complexity(files)
        self.assertLess(score, 0.3)

    def test_large_multi_language_change(self):
        files = [
            FileStats(filename='app.py', additions=300, deletions=100, language='Python'),
            FileStats(filename='main.rs', additions=200, deletions=50, language='Rust'),
            FileStats(filename='index.ts', additions=150, deletions=80, language='TypeScript'),
            FileStats(filename='handler.go', additions=100, deletions=30, language='Go'),
            FileStats(filename='App.tsx', additions=50, deletions=20, language='TypeScript/React'),
        ]
        score = pr_analyzer.calculate_complexity(files)
        self.assertGreater(score, 0.5)

    def test_test_heavy_change_is_lower(self):
        """Changes with high test ratio should have lower complexity."""
        prod_files = [FileStats(filename='app.py', additions=100, deletions=50,
                                language='Python')]
        test_files = [
            FileStats(filename='app.py', additions=100, deletions=50,
                      language='Python'),
            FileStats(filename='tests/test_app.py', additions=100, deletions=0,
                      language='Python', is_test=True),
        ]
        score_prod = pr_analyzer.calculate_complexity(prod_files)
        score_test = pr_analyzer.calculate_complexity(test_files)
        self.assertLess(score_test, score_prod)


# ═══════════════════════════════════════════════════════════════
# identify_risk_factors
# ═══════════════════════════════════════════════════════════════

class IdentifyRiskFactorsTest(unittest.TestCase):
    def test_large_pr_flagged(self):
        files = [FileStats(filename='big.py', additions=300, deletions=200,
                           language='Python')]
        risks = pr_analyzer.identify_risk_factors(files)
        self.assertTrue(any('Large PR' in r for r in risks))

    def test_no_tests_flagged(self):
        files = [FileStats(filename='app.py', additions=40, deletions=20,
                           language='Python')]
        risks = pr_analyzer.identify_risk_factors(files)
        self.assertTrue(any(pr_analyzer.RISK_NO_TESTS in r for r in risks))

    def test_with_tests_not_flagged(self):
        files = [
            FileStats(filename='app.py', additions=40, deletions=20,
                      language='Python'),
            FileStats(filename='tests/test_app.py', additions=30, deletions=0,
                      language='Python', is_test=True),
        ]
        risks = pr_analyzer.identify_risk_factors(files)
        self.assertFalse(any(pr_analyzer.RISK_NO_TESTS in r for r in risks))

    def test_security_sensitive_file(self):
        files = [FileStats(filename='src/auth/login.py', additions=10, deletions=5,
                           language='Python')]
        risks = pr_analyzer.identify_risk_factors(files)
        self.assertTrue(any('Security-sensitive' in r for r in risks))

    def test_database_migration(self):
        files = [FileStats(filename='migrations/001_init.sql', additions=20, deletions=0,
                           language='SQL')]
        risks = pr_analyzer.identify_risk_factors(files)
        self.assertTrue(any('Database' in r for r in risks))

    def test_test_substring_files_still_flag_no_tests(self):
        """Files like latest_report.py must not suppress NO_TEST_CHANGES."""
        files = [
            FileStats(filename='latest_report.py', additions=40, deletions=20,
                      language='Python'),
            FileStats(filename='contest_utils.py', additions=30, deletions=10,
                      language='Python'),
        ]
        risks = pr_analyzer.identify_risk_factors(files)
        self.assertTrue(any(pr_analyzer.RISK_NO_TESTS in r for r in risks))


# ═══════════════════════════════════════════════════════════════
# generate_suggestions
# ═══════════════════════════════════════════════════════════════

class GenerateSuggestionsTest(unittest.TestCase):
    def test_returns_list(self):
        files = [FileStats(filename='app.py', additions=10, deletions=5,
                           language='Python')]
        result = pr_analyzer.generate_suggestions(files, 0.1, [])
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)

    def test_large_pr_split_suggestion(self):
        files = [FileStats(filename='big.py', additions=600, deletions=300,
                           language='Python')]
        result = pr_analyzer.generate_suggestions(files, 0.3, [])
        self.assertTrue(any('splitting' in s.lower() for s in result))

    def test_no_tests_suggestion(self):
        files = [FileStats(filename='app.py', additions=40, deletions=20,
                           language='Python')]
        risks = [f"{pr_analyzer.RISK_NO_TESTS}: no tests"]
        result = pr_analyzer.generate_suggestions(files, 0.2, risks)
        self.assertTrue(any('test' in s.lower() for s in result))

    def test_rust_suggestion(self):
        files = [FileStats(filename='lib.rs', additions=10, deletions=5,
                           language='Rust')]
        result = pr_analyzer.generate_suggestions(files, 0.1, [])
        self.assertTrue(any('unwrap' in s.lower() for s in result))


# ═══════════════════════════════════════════════════════════════
# analyze_pr — end-to-end integration
# ═══════════════════════════════════════════════════════════════

class AnalyzePRTest(unittest.TestCase):
    def test_end_to_end(self):
        diff = (
            "diff --git a/src/app.py b/src/app.py\n"
            "index 1111111..2222222 100644\n"
            "--- a/src/app.py\n"
            "+++ b/src/app.py\n"
            "@@ -1,3 +1,5 @@\n"
            " import os\n"
            "+import sys\n"
            "+import json\n"
            " def main():\n"
            "+    print('hello')\n"
            "+    return 0\n"
            "diff --git a/tests/test_app.py b/tests/test_app.py\n"
            "new file mode 100644\n"
            "--- /dev/null\n"
            "+++ b/tests/test_app.py\n"
            "@@ -0,0 +1,3 @@\n"
            "+from app import main\n"
            "+def test_main():\n"
            "+    assert main() == 0\n"
        )
        analysis = pr_analyzer.analyze_pr(diff)

        self.assertEqual(analysis.total_files, 2)
        self.assertEqual(analysis.total_additions, 7)  # 4 + 3
        self.assertEqual(analysis.total_deletions, 0)
        self.assertGreater(len(analysis.suggestions), 0)
        self.assertIn('XS (Extra Small)', analysis.size_category)

        # Verify test file was detected
        test_file = [f for f in analysis.files if 'test' in f.filename][0]
        self.assertTrue(test_file.is_test)

        # Verify no "NO_TEST_CHANGES" risk since tests are present
        self.assertFalse(
            any(pr_analyzer.RISK_NO_TESTS in r for r in analysis.risk_factors)
        )

    def test_empty_diff(self):
        analysis = pr_analyzer.analyze_pr("")
        self.assertEqual(analysis.total_files, 0)
        self.assertEqual(analysis.complexity_score, 0.0)


if __name__ == '__main__':
    unittest.main()

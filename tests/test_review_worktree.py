"""Exercise isolation and report validation using throwaway repositories."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("review_worktree", Path(__file__).resolve().parents[1] / "scripts/review_worktree.py")
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class WorktreeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "game"
        self.root.mkdir()
        review.git(self.root, "init", "-b", "main")
        (self.root / ".gitignore").write_text(".reviews/\n.review/\n.claude/\n")
        (self.root / "REVIEW.md").write_text("Not reviewed\n")
        (self.root / "game.js").write_text("const duration = 9;\n")
        self.commit("initial")
        (self.root / "game.js").write_text("const duration = 9000;\n")
        self.commit("milliseconds")

    def commit(self, message):
        review.git(self.root, "add", ".")
        review.git(self.root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", message)

    def tearDown(self):
        # tempfile owns this verified temporary directory, not the user's worktrees.
        self.temp.cleanup()

    def report(self, metadata, sha=None):
        Path(metadata["report"]).write_text(f"Reviewed-Commit: {sha or metadata['revision']}\nVerdict: PASS\n\n## Testy\nFixture test evidence.\n", encoding="utf-8")

    def test_snapshot_stays_fixed_and_old_pass_is_identified(self):
        meta = review.prepare(self.root)
        (self.root / "game.js").write_text("const duration = 42;\n")
        self.commit("new independent work")
        self.assertEqual((Path(meta["worktree"]) / "game.js").read_text(), "const duration = 9000;\n")
        self.report(meta)
        result = review.collect(self.root, self.root / ".reviews/latest.json")
        self.assertFalse(result["current"])
        self.assertEqual(result["verdict"], "PASS")

    def test_code_edits_in_review_are_rejected(self):
        meta = review.prepare(self.root)
        self.report(meta)
        (Path(meta["worktree"]) / "game.js").write_text("changed by reviewer")
        with self.assertRaisesRegex(ValueError, "modified code"):
            review.collect(self.root, self.root / ".reviews/latest.json")

    def test_missing_or_wrong_commit_verdict_is_rejected(self):
        meta = review.prepare(self.root)
        with self.assertRaisesRegex(ValueError, "valid review verdict"):
            review.collect(self.root, self.root / ".reviews/latest.json")
        self.report(meta, "a" * 40)
        with self.assertRaisesRegex(ValueError, "another commit"):
            review.collect(self.root, self.root / ".reviews/latest.json")

    def test_pending_work_and_existing_snapshot_are_not_overwritten(self):
        (self.root / "game.js").write_text("pending edits")
        with self.assertRaisesRegex(ValueError, "pending work"):
            review.prepare(self.root)
        self.commit("pending committed")
        meta = review.prepare(self.root)
        with self.assertRaisesRegex(ValueError, "already exists"):
            review.prepare(self.root)
        self.assertTrue(Path(meta["worktree"]).exists())


if __name__ == "__main__":
    unittest.main()

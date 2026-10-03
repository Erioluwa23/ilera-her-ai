"""Test upload lifecycle without downloading gated weights or acquiring GPUs."""
import ast
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

SOURCE = Path(__file__).with_name("app.py")
# Import only the boundary functions, excluding module startup/model downloads.
TREE = ast.parse(SOURCE.read_text())
FUNCTIONS = ast.Module(body=[n for n in TREE.body if isinstance(n, ast.FunctionDef)
                            and n.name in ("normalize_language", "cleanup_audio", "transcribe")], type_ignores=[])


class RuntimeBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.cache = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"GRADIO_TEMP_DIR": self.cache.name})
        self.environment.start()
        self.context = {"Path": Path, "tempfile": tempfile, "os": os,
                        "ALIASES": {"yo": "yoruba", "yoruba": "yoruba"},
                        "gr": type("Gradio", (), {"Error": ValueError}),
                        "subprocess": Mock(run=Mock(side_effect=RuntimeError("decode failed"))),
                        "LOCK": threading.Lock()}
        exec(compile(FUNCTIONS, str(SOURCE), "exec"), self.context)

    def tearDown(self):
        self.environment.stop()
        self.cache.cleanup()

    def test_cleanup_removes_cache_upload(self):
        upload = Path(self.cache.name) / "voice.wav"
        upload.write_bytes(b"upload")
        self.context["cleanup_audio"](str(upload))
        self.assertFalse(upload.exists())
        # Idempotent after success or a second cleanup callback.
        self.context["cleanup_audio"](str(upload))

    def test_cleanup_does_not_delete_outside_cache(self):
        with tempfile.TemporaryDirectory() as other:
            file = Path(other) / "keep.wav"
            file.write_bytes(b"other")
            self.context["cleanup_audio"](str(file))
            self.assertTrue(file.exists())

    def test_cleanup_runs_after_decoder_failure(self):
        upload = Path(self.cache.name) / "voice.wav"
        upload.write_bytes(b"invalid compressed audio")
        with self.assertRaisesRegex(ValueError, "inference could not complete"):
            self.context["transcribe"](str(upload), "yo")
        self.assertFalse(upload.exists())

    def test_invalid_language_still_cleans_upload(self):
        upload = Path(self.cache.name) / "voice.wav"
        upload.write_bytes(b"upload")
        with self.assertRaises(ValueError):
            self.context["transcribe"](str(upload), "xx")
        self.assertFalse(upload.exists())


if __name__ == "__main__":
    unittest.main()

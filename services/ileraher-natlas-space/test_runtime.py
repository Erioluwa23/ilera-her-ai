"""Test upload lifecycle without downloading gated weights or acquiring GPUs."""
import ast
import hashlib
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
                            and n.name in ("normalize_language", "cleanup_audio", "transcribe", "suspicious_repetition", "answer", "synthesize", "llm_credential", "classify_llm_failure", "verified_decoder_checkpoint")], type_ignores=[])


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

    def test_repetition_guard(self):
        self.assertTrue(self.context["suspicious_repetition"]("one two three four " * 10))
        self.assertFalse(self.context["suspicious_repetition"]("Please explain why my period has become irregular this month"))

    def test_unavailable_generation_does_not_acquire_gpu(self):
        self.context["GENERATION_STATUS"] = {"llmLoaded": False, "ttsLoaded": False, "llmError": "Needs approved access", "ttsError": "Decoder unavailable"}
        self.context["generate_answer"] = Mock()
        self.context["generate_audio"] = Mock()
        with self.assertRaisesRegex(ValueError, "approved access"):
            self.context["answer"]("Question", "{}", "yo", "System")
        with self.assertRaisesRegex(ValueError, "Decoder unavailable"):
            self.context["synthesize"]("Hello", "yo")
        self.context["generate_answer"].assert_not_called()
        self.context["generate_audio"].assert_not_called()

    def test_text_credential_can_be_separate_without_replacing_asr_access(self):
        self.context["HF_TOKEN"] = "asr-secret-fixture"
        with patch.dict(os.environ, {"NATLAS_LLM_HF_TOKEN": "llm-secret-fixture"}):
            self.assertEqual(self.context["llm_credential"](), "llm-secret-fixture")
        with patch.dict(os.environ, {"NATLAS_LLM_HF_TOKEN": ""}):
            self.assertEqual(self.context["llm_credential"](), "asr-secret-fixture")
        self.assertEqual(self.context["HF_TOKEN"], "asr-secret-fixture")

    def test_model_load_failure_is_not_misreported_as_access_denial(self):
        report = self.context["classify_llm_failure"](RuntimeError("private internal exception"), True)
        self.assertTrue(report["llmAccess"])
        self.assertEqual(report["llmFailureCategory"], "load")
        self.assertNotIn("private", str(report))
        error = RuntimeError("hf_private-value")
        error.response = type("Response", (), {"status_code": 403})()
        report = self.context["classify_llm_failure"](error, False)
        self.assertFalse(report["llmAccess"])
        self.assertEqual(report["llmFailureCategory"], "access")
        self.assertNotIn("hf_private", str(report))

    def test_decoder_uses_pinned_original_source_and_checks_hash_before_loading(self):
        file = Path(self.cache.name) / "decoder.ckpt"
        file.write_bytes(b"fixture checkpoint, never deserialized")
        download = Mock(return_value=str(file))
        self.context.update(hf_hub_download=download, hashlib=hashlib)
        digest = Mock()
        digest.hexdigest.return_value = "7450020c154f6aba033cb8651466cb79cb1b1cdd10ea64eaba68e7871cabcc5a"
        with patch.object(hashlib, "sha256", return_value=digest):
            self.assertEqual(self.context["verified_decoder_checkpoint"](), file)
        download.assert_called_once_with("novateur/WavTokenizer-large-speech-75token", "wavtokenizer_large_speech_320_24k.ckpt",
            revision="1cc9faee31025548fbae6ffe11115d7207093638", token=False)
        digest.update.assert_called_once_with(file.read_bytes())

    def test_decoder_rejects_wrong_bytes(self):
        file = Path(self.cache.name) / "decoder.ckpt"
        file.write_bytes(b"invalid checkpoint")
        self.context.update(hf_hub_download=Mock(return_value=str(file)), hashlib=hashlib)
        with self.assertRaisesRegex(ValueError, "integrity check failed"):
            self.context["verified_decoder_checkpoint"]()

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

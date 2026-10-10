import json
import os
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest
from simcall import doctor
from simcall.config import Settings
from simcall.fastagi import PROMPTS
from tests.test_calls import fixture_wav


def native_fixture(tmp_path):
    media, prompts = tmp_path / "media", tmp_path / "prompts"
    media.mkdir(); (prompts / "en-NG").mkdir(parents=True)
    (prompts / "language.wav").write_bytes(fixture_wav())
    for name in PROMPTS:
        (prompts / "en-NG" / (name + ".wav")).write_bytes(fixture_wav())
    return Settings("https://app.example", "i" * 40, "a" * 40, media_dir=media, prompts_dir=prompts)


def test_environment_parser_never_executes_shell_and_rejects_exposed_secrets(tmp_path, monkeypatch):
    path = tmp_path / "pilot.env"
    path.write_text('SIM_GATEWAY_MODEL="$(touch should-not-exist)"\nSIM_GATEWAY_IP=192.168.1.50\n')
    path.chmod(0o600)
    monkeypatch.delenv("SIM_GATEWAY_MODEL", raising=False)
    monkeypatch.delenv("SIM_GATEWAY_IP", raising=False)
    doctor.load_env_file(path)
    assert os.environ["SIM_GATEWAY_MODEL"] == "$(touch should-not-exist)"
    assert not Path("should-not-exist").exists()
    path.chmod(0o644)
    with pytest.raises(ValueError): doctor.load_env_file(path)
    path.chmod(0o600); path.write_text("SIM_GATEWAY_IP=192.168.1.60\nPATH=private\n")
    with pytest.raises(ValueError): doctor.load_env_file(path)
    assert os.environ["SIM_GATEWAY_IP"] == "192.168.1.50"


@pytest.mark.asyncio
async def test_default_checks_are_read_only_and_never_infer_compute_or_carrier_success(tmp_path, monkeypatch):
    settings = native_fixture(tmp_path)
    monkeypatch.setattr(doctor, "loopback_listeners", AsyncMock(return_value={8078, 4573}))
    monkeypatch.setattr(doctor, "gateway_ready", AsyncMock(return_value=True))
    requests = []
    async def handler(request):
        requests.append(request)
        if request.url.path == "/healthz":
            return httpx.Response(200, json={"status": "ok", "capacity": 1})
        assert request.headers["Authorization"] == "Bearer " + settings.integration_key
        return httpx.Response(200, json={"provider": "sim", "phoneNumber": "+2348012345678", "enabled": True, "publicReady": False,
            "gateway": {"ready": True}, "models": {"asrLoaded": True, "reachable": True, "speechLoaded": True, "textLoaded": False}})
    report = await doctor.diagnose(settings, gateway_model="fixture-only", gateway_ip="192.168.1.50", transport=httpx.MockTransport(handler))
    assert all(request.method == "GET" for request in requests)
    assert report["configuredNumber"] == "+2348012345678"
    assert report["readyForAcceptance"] is False
    assert report["carrierCallTested"] is False and report["speechAccuracyVerified"] is False
    assert next(item for item in report["checks"] if item["id"] == "speech_compute")["status"] == "pending"
    assert settings.integration_key not in json.dumps(report) and settings.api_key not in json.dumps(report)


@pytest.mark.asyncio
async def test_smoke_test_handles_quota_and_sends_only_fixed_content(tmp_path):
    settings = native_fixture(tmp_path)
    requests = []
    async def handler(request):
        requests.append(request)
        return httpx.Response(429, json={"error": "hf_private-upstream exception"})
    async with httpx.AsyncClient(base_url=settings.app_url, transport=httpx.MockTransport(handler), trust_env=False) as client:
        report = await doctor.speech_smoke(settings, client)
    assert [item["id"] for item in report] == ["asr_compute", "speech_compute"]
    assert all(item["status"] == "blocked" and item["httpStatus"] == 429 for item in report)
    assert b"fixed-menu.wav" in requests[0].content
    assert json.loads(requests[1].content)["text"] == "This is an IleraHer phone integration test."
    assert "hf_private" not in json.dumps(report)


@pytest.mark.asyncio
async def test_no_credentials_follow_redirects_or_appear_in_diagnostics(tmp_path, monkeypatch):
    settings = native_fixture(tmp_path)
    monkeypatch.setattr(doctor, "loopback_listeners", AsyncMock(return_value=set()))
    monkeypatch.setattr(doctor, "gateway_ready", AsyncMock(return_value=False))
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(302, headers={"Location": "https://untrusted.example"}, text="private upstream detail")
    report = await doctor.diagnose(settings, transport=httpx.MockTransport(handler))
    assert len(requests) == 2
    assert all(request.url.host in {"127.0.0.1", "app.example"} for request in requests)
    assert report["readyForAcceptance"] is False
    assert "private upstream detail" not in json.dumps(report)


def test_invalid_menu_cannot_be_counted_as_ready(tmp_path):
    settings = native_fixture(tmp_path)
    assert doctor.valid_prompt(settings.prompts_dir / "language.wav")
    (settings.prompts_dir / "language.wav").write_bytes(b"not a phone WAV")
    assert not doctor.valid_prompt(settings.prompts_dir / "language.wav")

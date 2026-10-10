import asyncio
import base64
import io
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from simcall.api import create_app
from simcall.config import Settings
from simcall.engine import CallEngine, CallFailure, validate_wav
from simcall.client import AppFailure, IleraHerClient
from simcall.fastagi import Agi, AgiFailure, Hangup, clean_media, convert_audio, handle_call, PROMPTS
import re
import httpx
import wave


def fixture_wav(seconds=1):
    # A transport/format fixture only; it is not speech and is never counted as model accuracy evidence.
    stream = io.BytesIO()
    with wave.open(stream, "wb") as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(8000)
        audio.writeframes(b"\0\0" * (8000 * seconds))
    return stream.getvalue()


class FakeApp:
    def __init__(self): self.events, self.questions = [], []
    async def authenticate(self, call_id, phone, pin, language):
        if pin != "492738": raise AppFailure(401)
        return {"callId": call_id, "grant": "g" * 43, "language": language, "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}
    async def turn(self, call_id, grant, turn_id, audio):
        self.questions.append(audio)
        return {"turnId": turn_id, "language": "en-NG", "answer": "Fixture response", "model": "curated", "audio": base64.b64encode(fixture_wav()).decode(), "contentType": "audio/wav"}
    async def event(self, event, **values): self.events.append((event, values)); return {"ok": True}
    async def close(self): pass


def settings(tmp_path): return Settings("https://app.example", "i" * 40, "a" * 40, media_dir=tmp_path / "media", prompts_dir=tmp_path / "prompts", fastagi_enabled=False, heartbeat_enabled=False)


def test_api_call_lifecycle(tmp_path):
    upstream = FakeApp()
    app = create_app(settings(tmp_path), upstream)
    headers = {"Authorization": "Bearer " + "a" * 40}
    with TestClient(app) as client:
        assert client.get("/healthz").json()["hardwareVerified"] is False
        assert client.post("/v1/calls", json={"caller": "08012345678"}).status_code == 401
        started = client.post("/v1/calls", headers=headers, json={"caller": "08012345678"})
        assert started.status_code == 201
        call_id = started.json()["callId"]
        path = "/v1/calls/" + call_id
        assert client.post("/v1/calls", headers=headers, json={"caller": "08012345678"}).status_code == 409
        assert client.post(path + "/turns", headers=headers, files={"audio": ("a.wav", fixture_wav())}).status_code == 401
        assert client.post(path + "/authenticate", headers=headers, json={"pin": "492738", "language": "en-NG", "consented": False}).status_code == 400
        assert client.post(path + "/authenticate", headers=headers, json={"pin": "492738", "language": "en-NG", "consented": True}).status_code == 200
        answer = client.post(path + "/turns", headers=headers, files={"audio": ("a.wav", fixture_wav(), "audio/wav")})
        assert answer.status_code == 200
        assert client.post(path + "/feedback", headers=headers, json={"rating": 5}).status_code == 400
        turn_id = answer.json()["turnId"]
        assert client.post(path + "/played", headers=headers, json={"turnId": turn_id}).status_code == 200
        assert client.post(path + "/feedback", headers=headers, json={"rating": 5}).status_code == 200
        assert client.post(path + "/feedback", headers=headers, json={"rating": 5}).status_code == 200
        assert len([e for e, _ in upstream.events if e == "feedback"]) == 1
        assert client.delete(path, headers=headers).status_code == 200
        assert client.post(path + "/turns", headers=headers, files={"audio": ("a.wav", fixture_wav())}).status_code == 401
    assert upstream.events[-1][0] == "end"


def test_validation_does_not_echo_pin(tmp_path):
    with TestClient(create_app(settings(tmp_path), FakeApp())) as client:
        response = client.post("/v1/calls/x/authenticate", headers={"Authorization": "Bearer " + "a" * 40}, json={"pin": "492738-private", "language": "en-NG", "consented": True})
        assert response.status_code == 400
        assert "492738" not in response.text


def test_streamed_body_limits(tmp_path):
    with TestClient(create_app(settings(tmp_path), FakeApp())) as client:
        response = client.post("/v1/calls", headers={"Authorization": "Bearer " + "a" * 40, "Content-Type": "application/json"}, content=b"x" * 9000)
        assert response.status_code == 413


@pytest.mark.asyncio
async def test_expiry_and_three_pin_attempts():
    now = [0]
    upstream = FakeApp(); engine = CallEngine(upstream, clock=lambda: now[0])
    started = await engine.start("08012345678"); call_id = started["callId"]
    for _ in range(3):
        with pytest.raises(AppFailure): await engine.authenticate(call_id, "492739", "en-NG", True)
    with pytest.raises(CallFailure): await engine.authenticate(call_id, "492738", "en-NG", True)
    now[0] = 901; await engine.reap()
    assert not engine.calls


@pytest.mark.asyncio
async def test_question_limit_and_language_binding():
    engine = CallEngine(FakeApp()); call_id = (await engine.start("08012345678"))["callId"]
    await engine.authenticate(call_id, "492738", "en-NG", True)
    for _ in range(6):
        result = await engine.turn(call_id, fixture_wav()); await engine.played(call_id, result["turnId"])
    with pytest.raises(CallFailure): await engine.turn(call_id, fixture_wav())
    await engine.end(call_id)
    assert not engine.calls


@pytest.mark.asyncio
async def test_hangup_cancels_inference_and_closes_grant():
    upstream = FakeApp(); entered = asyncio.Event()
    async def slow(*args): entered.set(); await asyncio.Event().wait()
    upstream.turn = slow
    engine = CallEngine(upstream); call_id = (await engine.start("08012345678"))["callId"]
    await engine.authenticate(call_id, "492738", "en-NG", True)
    task = asyncio.create_task(engine.turn(call_id, fixture_wav()))
    await entered.wait(); await engine.end(call_id)
    with pytest.raises(asyncio.CancelledError): await task
    assert upstream.events[-1][0] == "end"


@pytest.mark.asyncio
async def test_upstream_failure_does_not_create_a_reply():
    upstream = FakeApp(); upstream.turn = AsyncMock(side_effect=AppFailure(429))
    engine = CallEngine(upstream); call_id = (await engine.start("08012345678"))["callId"]
    await engine.authenticate(call_id, "492738", "en-NG", True)
    with pytest.raises(AppFailure): await engine.turn(call_id, fixture_wav())
    assert engine.calls[call_id].turn_id is None
    assert not engine.calls[call_id].busy


@pytest.mark.asyncio
async def test_pbx_failed_playback_is_not_acknowledged():
    reader = asyncio.StreamReader()
    reader.feed_data(b"200 result=0\n200 result=1 (FAILED)\n")
    class Writer:
        def write(self, value): pass
        async def drain(self): pass
    with pytest.raises(AgiFailure): await Agi(reader, Writer()).play("/fixed/reply")
    reader = asyncio.StreamReader(); reader.feed_data(b"200 result=-1\n")
    with pytest.raises(Hangup): await Agi(reader, Writer()).play("/fixed/reply")


@pytest.mark.asyncio
async def test_keypad_preserves_leading_zeroes():
    reader = asyncio.StreamReader(); reader.feed_data(b"200 result=001237\n")
    class Writer:
        def write(self, value): pass
        async def drain(self): pass
    assert await Agi(reader, Writer()).digits("/fixed/pin", 6) == "001237"


def test_audio_validation_and_stale_cleanup(tmp_path):
    validate_wav(fixture_wav())
    with pytest.raises(CallFailure): validate_wav(fixture_wav(31))
    stale = tmp_path / "8ba10708-187c-40ac-a844-7892aa473d09"; stale.mkdir(); (stale / "q.wav").write_bytes(fixture_wav())
    unrelated = tmp_path / "keep"; unrelated.mkdir()
    clean_media(tmp_path)
    assert not stale.exists() and unrelated.exists()


@pytest.mark.asyncio
async def test_actual_ffmpeg_phone_conversion(tmp_path):
    source, target = tmp_path / "source.wav", tmp_path / "reply.wav"
    source.write_bytes(fixture_wav())
    await convert_audio(source, target)
    validate_wav(target.read_bytes())


@pytest.mark.asyncio
async def test_remote_adapter_sends_audio_bytes_and_sanitizes_errors():
    observed = []
    async def transport(request):
        observed.append(request)
        if request.url.path.endswith("/turn"): return httpx.Response(200, json={"ok": True})
        return httpx.Response(503, json={"error": "sensitive upstream exception"})
    client = IleraHerClient("https://app.example", "i" * 40, httpx.MockTransport(transport))
    await client.turn("call", "grant", "turn", fixture_wav())
    assert b"RIFF" in observed[0].content
    assert observed[0].headers["Authorization"] == "Bearer " + "i" * 40
    with pytest.raises(AppFailure) as error: await client.authenticate("call", "08012345678", "492738", "en-NG")
    assert "sensitive" not in str(error.value)
    await client.close()


@pytest.mark.asyncio
async def test_fastagi_full_flow_repeat_followup_rating_and_cleanup(tmp_path):
    config = settings(tmp_path); config.media_dir.mkdir()
    (config.prompts_dir / "en-NG").mkdir(parents=True)
    for name in PROMPTS: (config.prompts_dir / "en-NG" / (name + ".wav")).write_bytes(fixture_wav())
    (config.prompts_dir / "language.wav").write_bytes(fixture_wav())
    upstream = FakeApp(); app = create_app(config, upstream)
    class PBX:
        def __init__(self): self.keys = iter(["1", "1", "492738", "1", "1", "2", "1", "3", "5", "9"]); self.played = []
        async def environment(self): return {"agi_callerid": "08012345678"}
        async def digits(self, path, count=1): return next(self.keys)
        async def play(self, path): self.played.append(str(path))
        async def command(self, command):
            if command.startswith("RECORD FILE"):
                path = re.search(r'"([^"]+)"', command).group(1)
                from pathlib import Path
                Path(path + ".wav").write_bytes(fixture_wav())
            return "6" if command == "CHANNEL STATUS" else "0"
    pbx = PBX()
    await handle_call(pbx, config, httpx.ASGITransport(app=app))
    assert len(upstream.questions) == 2
    assert len([p for p in pbx.played if p.endswith("/reply")]) == 3
    assert [e for e, _ in upstream.events] == ["played", "played", "feedback", "end"]
    assert not list(config.media_dir.iterdir()) and not app.state.engine.calls

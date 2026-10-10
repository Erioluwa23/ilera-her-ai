"""Run by the TypeScript adapter integration test. AI responses are explicit test doubles."""
import asyncio
import os
import httpx
from pathlib import Path
from simcall.api import create_app
from simcall.client import IleraHerClient
from simcall.config import Settings
from tests.test_calls import fixture_wav


async def main():
    settings = Settings(os.environ["SIM_TEST_APP_URL"], os.environ["SIM_TEST_KEY"], "local-test-key-" * 4, media_dir=Path(os.environ["SIM_TEST_MEDIA"]), fastagi_enabled=False, heartbeat_enabled=False)
    # Loopback test traffic does not use external proxies.
    app = create_app(settings, IleraHerClient(settings.app_url, settings.integration_key, httpx.AsyncHTTPTransport()))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://pilot", headers={"Authorization": "Bearer " + settings.api_key}) as client:
        start = await client.post("/v1/calls", json={"caller": "08012345678"}); start.raise_for_status()
        call_id = start.json()["callId"]; path = "/v1/calls/" + call_id
        auth = await client.post(path + "/authenticate", json={"pin": "492738", "language": "en-NG", "consented": True}); auth.raise_for_status()
        response = await client.post(path + "/turns", files={"audio": ("question.wav", fixture_wav(), "audio/wav")}); response.raise_for_status()
        reply = response.json()
        assert reply["language"] == "en-NG" and reply["model"] == "curated"
        assert reply["transcriptionModel"] == "NCAIR1/NigerianAccentedEnglish"
        ack = await client.post(path + "/played", json={"turnId": reply["turnId"]}); ack.raise_for_status()
        rating = await client.post(path + "/feedback", json={"rating": 5}); rating.raise_for_status()
        ended = await client.delete(path); ended.raise_for_status()
        assert not app.state.engine.calls
    await app.state.engine.app.close()
    print("PASS: SIM API -> real app adapter -> PostgreSQL -> existing answer/audio providers (AI test doubles) -> playback acknowledgement -> feedback -> cleanup")


asyncio.run(main())

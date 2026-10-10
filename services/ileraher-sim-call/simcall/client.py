import asyncio
import httpx


class AppFailure(Exception):
    def __init__(self, status: int = 503):
        self.status = status
        super().__init__("Application request could not complete")


class IleraHerClient:
    """The remote service key stays on the host; no browser session or HF token is copied."""

    def __init__(self, base_url: str, key: str, transport=None):
        self.http = httpx.AsyncClient(
            base_url=base_url, headers={"Authorization": "Bearer " + key},
            timeout=httpx.Timeout(110, connect=10), follow_redirects=False, transport=transport,
        )

    async def request(self, path: str, *, json=None, data=None, files=None):
        try:
            async with asyncio.timeout(110):
                async with self.http.stream("POST", "/api/phone/integration/" + path, json=json, data=data, files=files) as response:
                    if response.status_code != 200:
                        raise AppFailure(response.status_code)
                    parts, size = [], 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > 6 * 1024 * 1024:
                            raise AppFailure(502)
                        parts.append(chunk)
                    import json as codec
                    value = codec.loads(b"".join(parts))
                    if not isinstance(value, dict):
                        raise AppFailure(502)
                    return value
        except AppFailure:
            raise
        except (httpx.HTTPError, TimeoutError, ValueError):
            raise AppFailure() from None

    async def authenticate(self, call_id, phone, pin, language):
        return await self.request("authenticate", json={"callId": call_id, "phone": phone, "pin": pin, "language": language, "consented": True})

    async def turn(self, call_id, grant, turn_id, audio):
        return await self.request("turn", data={"callId": call_id, "grant": grant, "turnId": turn_id}, files={"audio": ("question.wav", audio, "audio/wav")})

    async def event(self, event, **values):
        return await self.request("event", json={"event": event, **values})

    async def close(self):
        await self.http.aclose()

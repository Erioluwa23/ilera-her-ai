import asyncio
import contextlib
import hmac
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt
from .config import Settings
from .client import AppFailure, IleraHerClient
from .engine import CallEngine, CallFailure, MAX_AUDIO


class BoundedBody:
    """Cap streamed bodies before multipart parsing or spool-file creation."""
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        limit = MAX_AUDIO + 8192 if scope["path"].endswith("/turns") else 8192
        parts, size = [], 0
        try:
            async with asyncio.timeout(15):
                while True:
                    item = await receive()
                    if item["type"] == "http.disconnect":
                        return
                    size += len(item.get("body", b""))
                    if size > limit:
                        return await JSONResponse({"error": "Request too large"}, 413)(scope, receive, send)
                    parts.append(item.get("body", b""))
                    if not item.get("more_body", False): break
        except TimeoutError:
            return await JSONResponse({"error": "Upload timed out"}, 408)(scope, receive, send)
        consumed = False
        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": b"".join(parts), "more_body": False}
            return await receive()
        return await self.app(scope, replay, send)


class StartCall(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    caller: str = Field(max_length=32)


class Authenticate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    pin: str = Field(pattern=r"^\d{6}$")
    language: str = Field(max_length=5)
    consented: StrictBool


class Played(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    turnId: str = Field(max_length=36)


class Feedback(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    rating: StrictInt = Field(ge=1, le=5)


def create_app(settings: Settings, upstream=None):
    app_client = upstream or IleraHerClient(settings.app_url, settings.integration_key)
    engine = CallEngine(app_client, settings.reviewed_languages)

    @asynccontextmanager
    async def lifespan(app):
        settings.media_dir.mkdir(parents=True, exist_ok=True, mode=0o770)
        # Reboots never resurrect an authenticated call or retain old voice files.
        from .fastagi import clean_media, serve_fastagi, heartbeat_loop
        clean_media(settings.media_dir)
        server = await serve_fastagi(settings) if settings.fastagi_enabled else None
        async def maintenance():
            while True:
                await engine.reap()
                await asyncio.sleep(10)
        task = asyncio.create_task(maintenance())
        heartbeat = asyncio.create_task(heartbeat_loop(settings, app_client)) if settings.heartbeat_enabled else None
        try:
            yield
        finally:
            task.cancel()
            if heartbeat: heartbeat.cancel()
            for background in [task, heartbeat]:
                if background:
                    with contextlib.suppress(asyncio.CancelledError): await background
            if server:
                server.close(); await server.wait_closed()
            for call_id in list(engine.calls): await engine.end(call_id)
            clean_media(settings.media_dir)
            await app_client.close()

    app = FastAPI(title="ÌleraHer SIM Call API", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.add_middleware(BoundedBody)
    app.state.engine = engine

    @app.middleware("http")
    async def authenticate_request(request: Request, call_next):
        # Health is process liveness only; it cannot claim that the SIM or AI is ready.
        if request.url.path != "/healthz" and not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + settings.api_key):
            return JSONResponse({"error": "Authentication required"}, 401)
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-store"
        return response

    @app.exception_handler(CallFailure)
    async def call_failure(request, error): return JSONResponse({"error": error.message}, error.status)
    @app.exception_handler(AppFailure)
    async def app_failure(request, error): return JSONResponse({"error": "ÌleraHer could not complete the request. Please try later."}, error.status if error.status in {400, 401, 409, 413, 429, 503, 504} else 502)
    # FastAPI's default validation response can echo a PIN or caller number.
    from fastapi.exceptions import RequestValidationError
    @app.exception_handler(RequestValidationError)
    async def invalid(request, error): return JSONResponse({"error": "Invalid call request"}, 400)

    @app.get("/healthz")
    async def health(): return {"status": "ok", "capacity": 1, "hardwareVerified": False}
    @app.post("/v1/calls", status_code=201)
    async def start(body: StartCall): return await engine.start(body.caller)
    @app.post("/v1/calls/{call_id}/authenticate")
    async def auth(call_id: str, body: Authenticate): return await engine.authenticate(call_id, body.pin, body.language, body.consented)
    @app.post("/v1/calls/{call_id}/turns")
    async def turn(call_id: str, request: Request):
        engine.get(call_id)
        async with request.form(max_files=1, max_fields=0, max_part_size=MAX_AUDIO) as form:
            audio = form.get("audio")
            if not hasattr(audio, "read"):
                raise CallFailure(400, "A phone WAV recording is required")
            value = await audio.read(MAX_AUDIO + 1)
            return await engine.turn(call_id, value)
    @app.post("/v1/calls/{call_id}/played")
    async def played(call_id: str, body: Played): return await engine.played(call_id, body.turnId)
    @app.post("/v1/calls/{call_id}/feedback")
    async def feedback(call_id: str, body: Feedback): return await engine.feedback(call_id, body.rating)
    @app.delete("/v1/calls/{call_id}")
    async def end(call_id: str): return await engine.end(call_id)
    return app


def from_env(): return create_app(Settings.load())

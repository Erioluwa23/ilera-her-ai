import asyncio
import base64
import io
import re
import time
import uuid
import wave
from dataclasses import dataclass, field
from datetime import datetime
from .client import AppFailure

LANGUAGES = {"en-NG", "yo", "ha", "ig"}
MAX_AUDIO = 500_000


class CallFailure(Exception):
    def __init__(self, status=400, message="Call request could not complete"):
        self.status, self.message = status, message
        super().__init__(message)


def normalize_caller(value: str) -> str:
    number = re.sub(r"[\s().-]", "", value)
    if re.fullmatch(r"0\d{10}", number):
        number = "+234" + number[1:]
    elif re.fullmatch(r"234\d{10}", number):
        number = "+" + number
    if not re.fullmatch(r"\+[1-9]\d{7,14}", number):
        raise CallFailure(400, "Registered phone number is required")
    return number


def validate_wav(audio: bytes):
    if not 44 <= len(audio) <= MAX_AUDIO:
        raise CallFailure(400, "Record up to 30 seconds of speech")
    try:
        with wave.open(io.BytesIO(audio), "rb") as sound:
            if sound.getnchannels() != 1 or sound.getsampwidth() != 2 or sound.getframerate() not in {8000, 16000} or sound.getcomptype() != "NONE":
                raise ValueError()
            count = sound.getnframes()
            if count <= 0 or count / sound.getframerate() > 30 or len(sound.readframes(count)) != count * 2:
                raise ValueError()
    except (wave.Error, EOFError, ValueError):
        raise CallFailure(400, "Invalid mono PCM phone recording") from None


@dataclass
class Call:
    id: str
    phone: str
    expires: float
    language: str | None = None
    grant: str | None = None
    auth_attempts: int = 0
    turns: int = 0
    turn_id: str | None = None
    played: bool = False
    rated: bool = False
    busy: bool = False
    ended: bool = False
    tasks: set = field(default_factory=set)


class CallEngine:
    def __init__(self, app, languages=("en-NG",), clock=time.monotonic):
        self.app, self.languages, self.clock = app, set(languages), clock
        self.calls: dict[str, Call] = {}
        self.lock = asyncio.Lock()

    async def start(self, phone: str):
        phone = normalize_caller(phone)
        async with self.lock:
            for call_id, call in list(self.calls.items()):
                if call.expires <= self.clock():
                    await self.end(call_id)
            if self.calls:
                raise CallFailure(409, "The SIM line is busy")
            call = Call(str(uuid.uuid4()), phone, self.clock() + 900)
            self.calls[call.id] = call
            return {"callId": call.id, "languages": sorted(self.languages), "maxTurns": 6}

    def get(self, call_id, authenticated=True):
        call = self.calls.get(call_id)
        if not call or call.ended or call.expires <= self.clock():
            raise CallFailure(401, "Call has ended")
        if authenticated and not call.grant:
            raise CallFailure(401, "Enter your calling PIN first")
        return call

    async def authenticate(self, call_id, pin, language, consented):
        call = self.get(call_id, False)
        if call.grant or call.busy:
            raise CallFailure(409, "Call authentication is already in progress or complete")
        if consented is not True or language not in self.languages or not re.fullmatch(r"\d{6}", pin):
            raise CallFailure(400, "Choose a supported language and consent before entering your PIN")
        if call.auth_attempts >= 3:
            raise CallFailure(401, "Call authentication attempt limit reached")
        call.auth_attempts += 1
        call.busy = True
        task = asyncio.current_task()
        call.tasks.add(task)
        try:
            result = await self.app.authenticate(call.id, call.phone, pin, language)
            grant = result.get("grant", "")
            if not isinstance(grant, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", grant) or result.get("callId") != call.id or result.get("language") != language:
                raise CallFailure(502, "Invalid application authentication response")
            expiry = datetime.fromisoformat(result["expiresAt"].replace("Z", "+00:00")).timestamp()
            remaining = expiry - time.time()
            if remaining <= 0 or remaining > 901:
                raise CallFailure(502, "Invalid application call expiry")
            call.expires = min(call.expires, self.clock() + remaining)
            if call.ended:
                await self.app.event("end", callId=call.id, grant=grant)
                raise CallFailure(401, "Call has ended")
            call.grant, call.language = grant, language
            return {"ok": True, "language": language}
        finally:
            call.tasks.discard(task)
            call.busy = False

    async def turn(self, call_id, audio: bytes):
        call = self.get(call_id)
        if call.busy or (call.turn_id and not call.played):
            raise CallFailure(409, "Finish playing the previous reply first")
        if call.turns >= 6:
            raise CallFailure(409, "Call question limit reached")
        validate_wav(audio)
        call.busy = True
        turn_id = str(uuid.uuid4())
        task = asyncio.current_task()
        call.tasks.add(task)
        try:
            result = await self.app.turn(call.id, call.grant, turn_id, audio)
            if call.ended:
                raise CallFailure(401, "Call has ended")
            if result.get("turnId") != turn_id or result.get("language") != call.language or result.get("contentType") not in {"audio/wav", "audio/x-wav", "audio/mpeg"}:
                raise CallFailure(502, "Invalid application reply")
            try:
                decoded = base64.b64decode(result.get("audio", ""), validate=True)
            except (ValueError, TypeError):
                raise CallFailure(502, "Invalid application audio") from None
            if not decoded or len(decoded) > 4 * 1024 * 1024:
                raise CallFailure(502, "Invalid application audio size")
            call.turns += 1
            call.turn_id, call.played = turn_id, False
            return result
        finally:
            call.tasks.discard(task)
            call.busy = False

    async def played(self, call_id, turn_id):
        call = self.get(call_id)
        if turn_id != call.turn_id:
            raise CallFailure(409, "Reply does not belong to this call")
        await self.app.event("played", callId=call.id, grant=call.grant, turnId=turn_id)
        call.played = True
        return {"ok": True}

    async def feedback(self, call_id, rating):
        call = self.get(call_id)
        if not call.played or type(rating) is not int or rating not in range(1, 6):
            raise CallFailure(400, "Rate a completed reply from 1 to 5")
        if not call.rated:
            await self.app.event("feedback", callId=call.id, grant=call.grant, rating=rating)
            call.rated = True
        return {"ok": True}

    async def end(self, call_id):
        call = self.calls.pop(call_id, None)
        if call:
            call.ended = True
            current = asyncio.current_task()
            for task in call.tasks.copy():
                if task is not current:
                    task.cancel()
            if call.grant:
                try:
                    async with asyncio.timeout(5):
                        await self.app.event("end", callId=call.id, grant=call.grant)
                except (AppFailure, TimeoutError):
                    pass  # The application grant/context expires even if the connection is lost.
            call.grant, call.phone = None, ""
        return {"ok": True}

    async def reap(self):
        for call_id, call in list(self.calls.items()):
            if call.expires <= self.clock():
                await self.end(call_id)

import asyncio
import base64
import contextlib
import json
import re
import shutil
import uuid
from pathlib import Path
import httpx

PROMPTS = ("consent", "pin", "auth-failed", "record", "send", "waiting", "menu", "rating", "rated", "error", "goodbye")
LANGUAGE_DIGITS = {"1": "en-NG", "2": "yo", "3": "ha", "4": "ig"}


class Hangup(Exception): pass
class AgiFailure(Exception): pass


class Agi:
    def __init__(self, reader, writer): self.reader, self.writer, self.result_data = reader, writer, None
    async def environment(self):
        env, size = {}, 0
        while True:
            line = await asyncio.wait_for(self.reader.readline(), 10)
            size += len(line)
            if not line or size > 8192: raise Hangup()
            if line in {b"\n", b"\r\n"}: return env
            key, _, value = line.decode("utf-8", errors="replace").strip().partition(": ")
            env[key] = value
    async def command(self, command):
        if "\n" in command or "\r" in command: raise AgiFailure()
        self.writer.write((command + "\n").encode()); await self.writer.drain()
        line = await asyncio.wait_for(self.reader.readline(), 120)
        if not line or line.startswith(b"HANGUP"): raise Hangup()
        match = re.match(rb"200 result=(-?\d+)(?: \(([^)]*)\))?", line)
        if not match: raise AgiFailure()
        result = match.group(1).decode()
        self.result_data = match.group(2).decode() if match.group(2) else None
        if result == "-1": raise Hangup()
        return result
    async def digits(self, path, count=1):
        return await self.command(f'GET DATA "{path}" 10000 {count}')
    async def play(self, path):
        result = await self.command(f'STREAM FILE "{path}" ""')
        status = await self.command('GET VARIABLE PLAYBACKSTATUS')
        if result != "0" or status != "1" or self.result_data != "SUCCESS": raise AgiFailure()


def clean_media(root: Path):
    # Only our generated UUID directories; never remove unrelated host files/symlinks.
    if not root.exists(): return
    for entry in root.iterdir():
        if entry.is_dir() and not entry.is_symlink() and re.fullmatch(r"[a-f0-9-]{36}", entry.name):
            shutil.rmtree(entry)


def available_languages(settings):
    return [l for l in settings.reviewed_languages if all((settings.prompts_dir / l / (p + ".wav")).is_file() for p in PROMPTS) and (settings.prompts_dir / "language.wav").is_file()]


async def convert_audio(source: Path, target: Path):
    process = await asyncio.create_subprocess_exec("ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "8000", "-c:a", "pcm_s16le", "-t", "180", str(target), stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    try:
        if await asyncio.wait_for(process.wait(), 15) != 0: raise AgiFailure()
    except BaseException:
        if process.returncode is None: process.kill(); await process.wait()
        raise
    if not target.exists() or target.stat().st_size < 44: raise AgiFailure()


async def handle_call(agi, settings, api_transport=None):
    env = await agi.environment()
    call_id, folder, language = None, None, "en-NG"
    api = httpx.AsyncClient(base_url="http://127.0.0.1:8078", headers={"Authorization": "Bearer " + settings.api_key}, timeout=115, follow_redirects=False, trust_env=False, transport=api_transport)
    def prompt(name): return settings.prompts_dir / language / name
    async def request(method, path, **kwargs):
        response = await api.request(method, path, **kwargs)
        if response.status_code not in {200, 201}: raise AgiFailure()
        return response.json()
    async def waiting(operation):
        await agi.command("SET MUSIC on")
        task = asyncio.create_task(operation)
        try:
            while not task.done():
                done, _ = await asyncio.wait({task}, timeout=2)
                if not done and await agi.command("CHANNEL STATUS") != "6": raise Hangup()
            return await task
        finally:
            if not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError): await task
            with contextlib.suppress(Hangup, AgiFailure): await agi.command("SET MUSIC off")
    try:
        if not available_languages(settings): raise AgiFailure()
        await agi.command("ANSWER")
        start = await request("POST", "/v1/calls", json={"caller": env.get("agi_callerid", "")})
        call_id = start["callId"]
        if not re.fullmatch(r"[a-f0-9-]{36}", call_id): raise AgiFailure()
        folder = settings.media_dir / call_id; folder.mkdir(mode=0o770)
        selected = await agi.digits(settings.prompts_dir / "language")
        language = LANGUAGE_DIGITS.get(selected, "")
        if language not in available_languages(settings): raise AgiFailure()
        if await agi.digits(prompt("consent")) != "1": return
        authenticated = False
        for _ in range(3):
            pin = await agi.digits(prompt("pin"), 6)
            response = await api.post(f"/v1/calls/{call_id}/authenticate", json={"pin": pin, "language": language, "consented": True})
            if response.status_code == 200: authenticated = True; break
            await agi.play(prompt("auth-failed"))
            if response.status_code not in {400, 401}: break
        if not authenticated: return
        last_reply = None
        questions, recordings = 0, 0
        while questions < 6 and recordings < 12:
            await agi.play(prompt("record"))
            recording = folder / "question"
            await agi.command(f'RECORD FILE "{recording}" wav "#" 30000 0 BEEP s=3')
            recordings += 1
            choice = await agi.digits(prompt("send"))
            if choice == "2": continue
            if choice != "1": return
            audio = recording.with_suffix(".wav")
            if not audio.exists() or audio.stat().st_size > 500_000: raise AgiFailure()
            await agi.play(prompt("waiting"))
            result = await waiting(request("POST", f"/v1/calls/{call_id}/turns", files={"audio": ("question.wav", audio.read_bytes(), "audio/wav")}))
            audio.unlink(missing_ok=True)
            questions += 1
            raw, reply = folder / "reply-input", folder / "reply.wav"
            raw.write_bytes(base64.b64decode(result["audio"], validate=True))
            await convert_audio(raw, reply); raw.unlink(missing_ok=True)
            await agi.play(reply.with_suffix(""))
            await request("POST", f"/v1/calls/{call_id}/played", json={"turnId": result["turnId"]})
            last_reply = reply
            # Repeat and rating stay within this answered question; they never re-run AI inference.
            while True:
                choice = await agi.digits(prompt("menu"))
                if choice == "1": await agi.play(last_reply.with_suffix("")); continue
                if choice == "2": break
                if choice == "3":
                    rating = await agi.digits(prompt("rating"))
                    if rating in {"1", "2", "3", "4", "5"}:
                        await request("POST", f"/v1/calls/{call_id}/feedback", json={"rating": int(rating)})
                        await agi.play(prompt("rated"))
                    continue
                return
    except Hangup:
        pass
    except (AgiFailure, httpx.HTTPError, ValueError, KeyError, OSError, TimeoutError):
        # Offline prompts are independent of upstream AI quota; never log PIN/audio/transcripts.
        if (settings.prompts_dir / language / "error.wav").is_file():
            with contextlib.suppress(Hangup, AgiFailure, TimeoutError): await agi.play(prompt("error"))
    finally:
        if call_id:
            with contextlib.suppress(httpx.HTTPError, AgiFailure, TimeoutError):
                await request("DELETE", f"/v1/calls/{call_id}")
        if folder and folder.exists(): shutil.rmtree(folder)
        await api.aclose()
        if (settings.prompts_dir / language / "goodbye.wav").is_file():
            with contextlib.suppress(Hangup, AgiFailure, TimeoutError): await agi.play(prompt("goodbye"))
        with contextlib.suppress(Hangup, AgiFailure, TimeoutError): await agi.command("HANGUP")


async def serve_fastagi(settings):
    async def connected(reader, writer):
        try: await handle_call(Agi(reader, writer), settings)
        finally: writer.close(); await writer.wait_closed()
    return await asyncio.start_server(connected, "127.0.0.1", 4573, limit=8192)


async def gateway_ready():
    try:
        process = await asyncio.create_subprocess_exec("asterisk", "-rx", "pjsip show contacts", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        try: output, _ = await asyncio.wait_for(process.communicate(), 5)
        except TimeoutError:
            process.kill(); await process.wait(); return False
        return process.returncode == 0 and re.search(rb"sim-gateway/\S+\s+\S+\s+Avail\s", output) is not None
    except OSError: return False


async def heartbeat_loop(settings, app_client):
    while True:
        try:
            await app_client.event("heartbeat", gatewayReady=await gateway_ready(), languages=available_languages(settings))
        except Exception:
            pass
        await asyncio.sleep(30)

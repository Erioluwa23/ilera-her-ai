"""Read-only native-host checks; optional fixed, non-medical speech smoke test."""
import argparse
import asyncio
import io
import ipaddress
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import time
import wave

import httpx
from .config import Settings
from .fastagi import PROMPTS, available_languages, gateway_ready

ENV_KEYS = {
    "ILERAHER_APP_URL", "PHONE_INTEGRATION_KEY", "SIM_API_KEY", "SIM_MEDIA_DIR",
    "SIM_PROMPTS_DIR", "SIM_REVIEWED_LANGUAGES", "SIM_FASTAGI_ENABLED",
    "SIM_HEARTBEAT_ENABLED", "SIM_GATEWAY_IP", "SIM_GATEWAY_MODEL",
}


def load_env_file(path: Path):
    """Read a protected simple EnvironmentFile; never source or expand shell code."""
    info = path.stat()
    if path.is_symlink() or not stat.S_ISREG(info.st_mode) or info.st_size > 65536 or info.st_uid not in {0, os.getuid()} or info.st_mode & 0o027:
        raise ValueError("Use a root/current-user-owned environment file with mode 0640 or stricter")
    values = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, raw = line.partition("=")
        key = key.strip()
        if not separator or key not in ENV_KEYS:
            raise ValueError("Environment file contains an unsupported setting")
        parts = shlex.split(raw, comments=False)
        if len(parts) > 1:
            raise ValueError("Quote values containing spaces in the environment file")
        values[key] = parts[0] if parts else ""
    # Parse the entire file successfully before changing any process settings.
    os.environ.update(values)


def valid_prompt(path: Path):
    try:
        if path.stat().st_size > 3 * 1024 * 1024:
            return False
        with wave.open(str(path), "rb") as sound:
            count = sound.getnframes()
            return (sound.getnchannels(), sound.getsampwidth(), sound.getframerate(), sound.getcomptype()) == (1, 2, 8000, "NONE") and 0 < count <= 180 * 8000 and len(sound.readframes(count)) == count * 2
    except (OSError, EOFError, ValueError, wave.Error):
        return False


async def loopback_listeners():
    try:
        process = await asyncio.create_subprocess_exec("ss", "-H", "-ltn", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        try:
            output, _ = await asyncio.wait_for(process.communicate(), 5)
        except TimeoutError:
            process.kill(); await process.wait(); return set()
        listeners, exposed = set(), set()
        for line in output.decode(errors="replace").splitlines():
            fields = line.split()
            if len(fields) < 4:
                continue
            host, separator, port = fields[3].rpartition(":")
            if separator and port in {"8078", "4573"}:
                (listeners if host in {"127.0.0.1", "[::1]", "::1"} else exposed).add(int(port))
        return listeners - exposed if process.returncode == 0 else set()
    except OSError:
        return set()


async def bounded_response(client, method, path, *, limit=65536, **kwargs):
    async with client.stream(method, path, **kwargs) as response:
        parts, size = [], 0
        async for chunk in response.aiter_bytes():
            size += len(chunk)
            if size > limit:
                raise ValueError("Diagnostic response exceeded its limit")
            parts.append(chunk)
        return response.status_code, response.headers, b"".join(parts)


async def speech_smoke(settings, client):
    """Only the installed English menu goes to ASR; never accept a user recording."""
    recording = settings.prompts_dir / "en-NG" / "record.wav"
    results = []
    if not valid_prompt(recording) or recording.stat().st_size > 500000:
        return [{"id": "asr_compute", "status": "blocked", "detail": "Prepare the fixed English record menu before the smoke test."}]
    operations = [
        ("asr_compute", "/api/transcribe", {"data": {"language": "en-NG"}, "files": {"audio": ("fixed-menu.wav", recording.read_bytes(), "audio/wav")}}),
        ("speech_compute", "/api/voice/audio", {"json": {"text": "This is an IleraHer phone integration test.", "language": "en-NG"}}),
    ]
    for name, path, payload in operations:
        started = time.monotonic()
        try:
            async with asyncio.timeout(45):
                status, headers, body = await bounded_response(client, "POST", path, limit=4 * 1024 * 1024, **payload)
            valid = False
            if status == 200 and name == "asr_compute":
                data = json.loads(body)
                valid = isinstance(data, dict) and isinstance(data.get("text"), str) and bool(data["text"].strip()) and data.get("model") == "NCAIR1/NigerianAccentedEnglish" and data.get("provider") == "ileraher_zerogpu_asr"
            elif status == 200:
                if headers.get("content-type", "").split(";")[0] in {"audio/wav", "audio/x-wav"}:
                    with wave.open(io.BytesIO(body), "rb") as sound:
                        count = sound.getnframes()
                        valid = sound.getnchannels() in {1, 2} and count > 0 and len(sound.readframes(count)) == count * sound.getnchannels() * sound.getsampwidth()
            detail = "Fixed test completed; pronunciation and accuracy still need review." if valid else "Quota exhausted." if status == 429 else "Fixed test failed; check runtime access and capacity."
            results.append({"id": name, "status": "pass" if valid else "blocked", "httpStatus": status, "latencyMs": round((time.monotonic() - started) * 1000), "detail": detail})
        except (httpx.HTTPError, TimeoutError, ValueError, EOFError, wave.Error):
            results.append({"id": name, "status": "blocked", "detail": "Fixed test timed out or returned an invalid response."})
    return results


async def diagnose(settings, *, gateway_model="", gateway_ip="", smoke=False, transport=None):
    checks = []
    def check(name, passed, detail):
        checks.append({"id": name, "status": "pass" if passed else "blocked", "detail": detail})
    check("gateway_model", bool(gateway_model.strip()), "Provide the actual voice-capable SIM-to-SIP gateway model; a data-only router cannot carry calls.")
    try:
        address = ipaddress.ip_address(gateway_ip)
        private = address.version == 4 and address.is_private and not address.is_loopback and not address.is_unspecified
    except ValueError:
        private = False
    check("gateway_address", private, "Use the gateway's LAN/private-VPN IPv4 address.")
    check("ffmpeg", shutil.which("ffmpeg") is not None, "FFmpeg must be installed on the call host.")
    check("media_permissions", settings.media_dir.is_dir() and os.access(settings.media_dir, os.R_OK | os.W_OK | os.X_OK), "Run as the service user; its media directory must be readable and writable.")
    installed = available_languages(settings)
    prompts = bool(settings.reviewed_languages) and set(installed) == set(settings.reviewed_languages) and valid_prompt(settings.prompts_dir / "language.wav") and all(valid_prompt(settings.prompts_dir / language / (name + ".wav")) for language in installed for name in PROMPTS)
    check("reviewed_prompts", prompts, "Every enabled language needs its reviewed menus in mono 8 kHz PCM WAV.")
    check("service_options", settings.fastagi_enabled and settings.heartbeat_enabled, "Native calling requires FastAGI and gateway heartbeats enabled.")
    listeners, peer = await asyncio.gather(loopback_listeners(), gateway_ready())
    check("loopback_ports", {8078, 4573} <= listeners, "API 8078 and FastAGI 4573 must listen only on loopback.")
    check("gateway_contact", peer, "Asterisk must report the sim-gateway contact as Avail; this does not verify the SIM's carrier route.")
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8078", timeout=5, follow_redirects=False, trust_env=False, transport=transport) as local:
        try:
            status, _, body = await bounded_response(local, "GET", "/healthz")
            health = json.loads(body)
            live = status == 200 and isinstance(health, dict) and health.get("status") == "ok" and health.get("capacity") == 1
        except (httpx.HTTPError, ValueError):
            live = False
        check("local_api", live, "The native call API must answer its loopback liveness check.")
    number, public_ready = None, False
    async with httpx.AsyncClient(base_url=settings.app_url, timeout=httpx.Timeout(45, connect=10), follow_redirects=False, trust_env=transport is None, transport=transport) as remote:
        try:
            status, _, body = await bounded_response(remote, "GET", "/api/phone/integration/readiness", headers={"Authorization": "Bearer " + settings.integration_key})
            data = json.loads(body)
            if status != 200 or not isinstance(data, dict) or data.get("provider") != "sim":
                raise ValueError()
            number = data.get("phoneNumber") if isinstance(data.get("phoneNumber"), str) and re.fullmatch(r"\+[1-9]\d{7,14}", data["phoneNumber"]) else None
            gateway, models = data.get("gateway", {}), data.get("models", {})
            if not isinstance(gateway, dict) or not isinstance(models, dict):
                raise ValueError()
            check("app_integration", True, "The host and app integration secrets match.")
            check("dedicated_number", bool(number), "The app needs the dedicated SIM number in E.164 form.")
            check("pilot_enabled", data.get("enabled") is True, "Enable controlled operator acceptance in the app before testing a call.")
            check("app_heartbeat", gateway.get("ready") is True, "The app needs a recent available gateway heartbeat.")
            check("asr_loaded", models.get("asrLoaded") is True and models.get("reachable") is True, "The existing official ASR runtime must load successfully.")
            check("speech_loaded", models.get("speechLoaded") is True or models.get("speechMode") == "configured-endpoint", "The existing speech output must be loaded or its endpoint configured; smoke-test it separately.")
            checks.append({"id": "text_generation", "status": "pass" if models.get("textLoaded") is True else "pending", "detail": "N-ATLaS generation is loaded." if models.get("textLoaded") is True else "N-ATLaS generation is unavailable; curated answers remain the labelled fallback."})
            public_ready = data.get("publicReady") is True
        except (httpx.HTTPError, ValueError):
            check("app_integration", False, "Check the deployed readiness route, app URL and securely matched integration secret.")
        if smoke:
            checks.extend(await speech_smoke(settings, remote))
        else:
            checks.append({"id": "speech_compute", "status": "pending", "detail": "Not tested. Use --speech-smoke for fixed non-medical requests; this consumes provider quota."})
    return {"checks": checks, "configuredNumber": number, "publicReady": public_ready,
        "readyForAcceptance": smoke and not any(item["status"] == "blocked" for item in checks),
        "carrierCallTested": False, "speechAccuracyVerified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, help="Protected /etc/ileraher-sim-call.env file; never pass secrets as arguments")
    parser.add_argument("--speech-smoke", action="store_true", help="Consumes quota using only a fixed English menu and a non-medical test phrase")
    args = parser.parse_args()
    try:
        if args.env_file:
            load_env_file(args.env_file)
        report = asyncio.run(diagnose(Settings.load(), gateway_model=os.getenv("SIM_GATEWAY_MODEL", ""), gateway_ip=os.getenv("SIM_GATEWAY_IP", ""), smoke=args.speech_smoke))
    except Exception:
        # No raw exceptions, environment values, credentials or transcripts.
        print(json.dumps({"error": "Setup check could not start. Check the protected environment file, secrets, dependencies and service-user permissions."}))
        return 2
    print(json.dumps(report, indent=2))
    return 2 if any(item["status"] == "blocked" for item in report["checks"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    app_url: str
    integration_key: str
    api_key: str
    media_dir: Path = Path("/var/lib/ileraher/media")
    prompts_dir: Path = Path("/opt/ileraher/prompts")
    reviewed_languages: tuple[str, ...] = ("en-NG",)
    fastagi_enabled: bool = True
    heartbeat_enabled: bool = True
    max_calls: int = 1

    def __post_init__(self):
        url = urlsplit(self.app_url)
        local = url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost"}
        if (url.scheme != "https" and not local) or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in {"", "/"}:
            raise ValueError("ILERAHER_APP_URL must be an HTTPS origin (loopback HTTP is allowed for local tests)")
        if min(len(self.integration_key), len(self.api_key)) < 32:
            raise ValueError("Configure two server secrets of at least 32 characters")
        if self.api_key == self.integration_key:
            raise ValueError("Use different local and application API secrets")
        if self.max_calls != 1:
            raise ValueError("The single SIM pilot supports one active call")
        if not set(self.reviewed_languages) <= {"en-NG", "yo", "ha", "ig"}:
            raise ValueError("Unsupported prompt language")

    @classmethod
    def load(cls):
        return cls(
            app_url=os.environ["ILERAHER_APP_URL"].rstrip("/"),
            integration_key=os.environ["PHONE_INTEGRATION_KEY"],
            api_key=os.environ["SIM_API_KEY"],
            media_dir=Path(os.getenv("SIM_MEDIA_DIR", "/var/lib/ileraher/media")),
            prompts_dir=Path(os.getenv("SIM_PROMPTS_DIR", "/opt/ileraher/prompts")),
            reviewed_languages=tuple(x.strip() for x in os.getenv("SIM_REVIEWED_LANGUAGES", "en-NG").split(",") if x.strip()),
            fastagi_enabled=os.getenv("SIM_FASTAGI_ENABLED", "true") == "true",
            heartbeat_enabled=os.getenv("SIM_HEARTBEAT_ENABLED", "true") == "true",
        )

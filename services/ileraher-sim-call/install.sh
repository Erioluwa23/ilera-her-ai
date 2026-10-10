#!/usr/bin/env bash
set -euo pipefail
# Dedicated Ubuntu 24.04+ host. Supply non-secret SIM_GATEWAY_IP; edit secrets securely below.
task_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(id -u)" != 0 ]]; then printf '%s\n' 'Run this installer with sudo on the dedicated call host.' >&2; exit 1; fi
if [[ -z "${SIM_GATEWAY_IP:-}" ]]; then printf '%s\n' 'Set SIM_GATEWAY_IP to the gateway LAN/VPN IPv4 address.' >&2; exit 1; fi
python3 -c 'import ipaddress,os; value=ipaddress.ip_address(os.environ["SIM_GATEWAY_IP"]); assert value.version==4 and value.is_private and not value.is_unspecified and not value.is_loopback'
apt-get update
apt-get install --no-install-recommends -y asterisk python3-venv ffmpeg espeak-ng
if ! id ileraher >/dev/null 2>&1; then useradd --system --gid asterisk --home-dir /opt/ileraher --shell /usr/sbin/nologin ileraher; fi
install -d -o ileraher -g asterisk -m 2770 /var/lib/ileraher/media
install -d -o root -g asterisk -m 0750 /opt/ileraher/service /opt/ileraher/prompts /etc/asterisk/ileraher-sim
cp -R "$task_root/simcall" /opt/ileraher/service/
chown -R root:asterisk /opt/ileraher/service
chmod -R g+rX,o-rwx /opt/ileraher/service
python3 -m venv /opt/ileraher/venv
/opt/ileraher/venv/bin/pip install -r "$task_root/requirements.txt"
python3 "$task_root/prepare_prompts.py" --output /opt/ileraher/prompts --languages en-NG
chown -R root:asterisk /opt/ileraher/prompts
chmod -R g+rX,o-rwx /opt/ileraher/prompts
python3 - "$task_root" <<'PY'
import os,sys
from pathlib import Path
source=Path(sys.argv[1])/"asterisk"
for name in ["pjsip","extensions"]:
    content=(source/(name+".conf.example")).read_text().replace("192.168.1.50",os.environ["SIM_GATEWAY_IP"])
    destination=Path("/etc/asterisk/ileraher-sim")/(name+".conf")
    destination.write_text(content)
    config=Path("/etc/asterisk")/(name+".conf")
    original=config.read_text() if config.exists() else ""
    include=f"#include ileraher-sim/{name}.conf"
    if include not in original:
        config.write_text(original+"\n"+include+"\n")
PY
chown root:asterisk /etc/asterisk/ileraher-sim/*.conf
chmod 0640 /etc/asterisk/ileraher-sim/*.conf
install -m 0644 "$task_root/ileraher-sim-call.service" /etc/systemd/system/
if [[ ! -e /etc/ileraher-sim-call.env ]]; then install -o root -g asterisk -m 0640 "$task_root/.env.example" /etc/ileraher-sim-call.env; fi
systemctl daemon-reload
printf '%s\n' 'Installed. Before starting: configure the two secrets in /etc/ileraher-sim-call.env, restrict SIP/RTP to the gateway, review prompts, then follow README.md acceptance checks. The installer does not enable live calls.'

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY simcall ./simcall
RUN groupadd -g 1000 asterisk && useradd -u 1000 -g asterisk -m ileraher && mkdir -p /var/lib/ileraher/media && chown ileraher:asterisk /var/lib/ileraher/media
USER ileraher
# API-only container mode. Native systemd deployment also supplies Asterisk/FastAGI.
ENV SIM_FASTAGI_ENABLED=false SIM_HEARTBEAT_ENABLED=false
EXPOSE 8078
CMD ["uvicorn", "simcall.api:from_env", "--factory", "--host", "0.0.0.0", "--port", "8078", "--workers", "1", "--no-access-log"]

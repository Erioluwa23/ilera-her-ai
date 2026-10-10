"""Prepare offline phone prompts. English uses eSpeak; other languages use reviewed recordings."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--languages", default="en-NG")
parser.add_argument("--recordings", type=Path, help="Native-speaker-reviewed WAV recordings at <language>/<name>.wav")
args = parser.parse_args()
texts = json.loads(Path(__file__).with_name("prompts.json").read_text())
languages = args.languages.split(",")
if not set(languages) <= texts.keys(): parser.error("Unsupported language")
args.output.mkdir(parents=True, exist_ok=True)
for language in languages:
    folder = args.output / language; folder.mkdir(exist_ok=True)
    for name, text in texts[language].items():
        target = folder / (name + ".wav")
        original = args.recordings / language / (name + ".wav") if args.recordings else None
        if original and original.is_file():
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(original), "-ac", "1", "-ar", "8000", "-c:a", "pcm_s16le", str(target)], check=True)
        elif language == "en-NG":
            temporary = folder / (name + "-source.wav")
            subprocess.run(["espeak-ng", "-v", "en", "-s", "145", "-w", str(temporary), text], check=True)
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(temporary), "-ac", "1", "-ar", "8000", "-c:a", "pcm_s16le", str(target)], check=True)
            temporary.unlink()
        else:
            parser.error(f"Supply reviewed {language}/{name}.wav; no substitute language voice is used")
choices = {"en-NG": "Press 1 for Nigerian English.", "yo": "Press 2 for Yoruba.", "ha": "Press 3 for Hausa.", "ig": "Press 4 for Igbo."}
menu = "Welcome to IleraHer. " + " ".join(choices[l] for l in languages)
temporary = args.output / "language-source.wav"
subprocess.run(["espeak-ng", "-v", "en", "-s", "140", "-w", str(temporary), menu], check=True)
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(temporary), "-ac", "1", "-ar", "8000", "-c:a", "pcm_s16le", str(args.output / "language.wav")], check=True)
temporary.unlink()
print("Prepared offline prompts for:", ", ".join(languages))

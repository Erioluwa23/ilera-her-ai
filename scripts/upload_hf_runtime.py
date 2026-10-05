"""Upload the reviewed runtime to the existing, free ZeroGPU Space."""
import json
import os
from pathlib import Path
import sys
import urllib.request

from huggingface_hub import CommitOperationAdd, HfApi

SPACE = "Kolade1/ileraHer-natlas-runtime"
FILES = ("app.py", "requirements.txt", "packages.txt", "README.md")


def main():
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        raise RuntimeError("Add the HF_SPACE_WRITE_TOKEN GitHub Actions secret.")
    api = HfApi(token=token)
    if api.whoami().get("name") != "Kolade1":
        raise RuntimeError("The upload credential must belong to Kolade1.")
    with urllib.request.urlopen(
        "https://huggingface.co/api/spaces/" + SPACE, timeout=30
    ) as response:
        metadata = json.load(response)
    runtime = metadata.get("runtime", {})
    hardware = runtime.get("hardware", {})
    if metadata.get("sdk") != "gradio" or hardware.get("requested") != "zero-a10g":
        raise RuntimeError("The existing Space must use Gradio with ZeroGPU requested.")
    root = Path(__file__).resolve().parents[1] / "services/ileraher-natlas-space"
    operations = [
        CommitOperationAdd(path_in_repo=name, path_or_fileobj=str(root / name))
        for name in FILES
    ]
    # One atomic commit; reject concurrent changes rather than overwriting them.
    result = api.create_commit(
        repo_id=SPACE,
        repo_type="space",
        operations=operations,
        parent_commit=metadata["sha"],
        commit_message="Deploy IleraHer official NCAIR ASR runtime",
    )
    print("Uploaded four runtime files to", SPACE)
    print("Space commit:", result.oid)
    print("Build, model access and four-language inference still require verification.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Do not log credentials or raw upstream exceptions.
        print("Upload failed. Check token scope, Space access and concurrent changes.", file=sys.stderr)
        sys.exit(1)

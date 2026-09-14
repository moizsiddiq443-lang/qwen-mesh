"""daily-digest.py - assemble a daily digest from the oxmoiz/rasi-state
metrics (queue-stats.json counts), append it to $GITHUB_STEP_SUMMARY, and
POST a short version to the Discord webhook when DISCORD_WEBHOOK_URL is set
(skip silently when unset). Token from env HF_TOKEN; never logged."""

import json
import os
import urllib.request

from huggingface_hub import hf_hub_download

REPO_ID = "oxmoiz/rasi-state"
REPO_TYPE = "dataset"


def main() -> None:
    token = (os.environ.get("HF_TOKEN") or "").strip() or None
    stats_path = hf_hub_download(repo_id=REPO_ID, filename="queue-stats.json",
                                 repo_type=REPO_TYPE, token=token)
    with open(stats_path, encoding="utf-8") as f:
        stats = json.load(f)
    counts = stats.get("counts", {})
    generated = stats.get("generated_at", "unknown")

    lines = [
        "## RASI daily digest",
        "",
        "State repo: oxmoiz/rasi-state (stats generated: " + generated + ")",
        "",
        "| queue | lines |",
        "|---|---|",
    ]
    for name in sorted(counts):
        lines.append("| " + name + " | " + str(counts[name]) + " |")
    total = sum(int(v) for v in counts.values() if str(v).isdigit())
    lines += ["| **total** | **" + str(total) + "** |", ""]
    digest = "\n".join(lines)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(digest + "\n")
    else:
        print(digest)

    webhook = (os.environ.get("DISCORD_WEBHOOK_URL") or "").strip()
    if not webhook:
        print("DISCORD_WEBHOOK_URL unset - skipping discord post")
        return
    short = digest.split("State repo: ")[0] + "RASI daily digest: " + \
        str(total) + " total queued/processed lines across " + \
        str(len(counts)) + " queues (stats " + generated + ")"
    body = json.dumps({"content": short[:2000]}).encode()
    req = urllib.request.Request(webhook, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        print("discord post:", r.status)


if __name__ == "__main__":
    main()
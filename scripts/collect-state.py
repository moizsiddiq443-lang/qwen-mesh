"""collect-state.py - pull the oxmoiz/rasi-state dataset into a timestamped
snapshot dir (snapshots/<UTC-Z>/) and prune to the last 48 snapshots.
Runs in GitHub Actions; token comes from env HF_TOKEN (never logged)."""

import os
import shutil
import time

from huggingface_hub import snapshot_download

REPO_ID = "oxmoiz/rasi-state"
REPO_TYPE = "dataset"
KEEP_SNAPSHOTS = 48


def main() -> None:
    token = (os.environ.get("HF_TOKEN") or "").strip() or None
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    snap_dir = os.path.join("snapshots", stamp)
    os.makedirs(snap_dir, exist_ok=True)
    snapshot_download(repo_id=REPO_ID, repo_type=REPO_TYPE,
                      local_dir=snap_dir, token=token)
    # strip hub metadata so only real payload files are committed
    cache_dir = os.path.join(snap_dir, ".cache")
    if os.path.isdir(cache_dir):
        shutil.rmtree(cache_dir, ignore_errors=True)

    root = "snapshots"
    snaps = sorted(d for d in os.listdir(root)
                   if os.path.isdir(os.path.join(root, d)))
    removed = 0
    for old in snaps[:-KEEP_SNAPSHOTS]:
        shutil.rmtree(os.path.join(root, old), ignore_errors=True)
        removed += 1
    kept = len(snaps) - removed
    print("snapshot:", snap_dir)
    print("kept:", kept, "removed:", removed)


if __name__ == "__main__":
    main()
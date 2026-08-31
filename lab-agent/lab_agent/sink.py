# Local/LAN side of the bridge: atomically drop a job into the hot folder the
# CAM/slicer watches, and scan the DONE/ERROR folders it moves finished jobs to.

from __future__ import annotations

import os
from typing import List


def safe_name(key: str) -> str:
    # Reject anything that isn't a plain filename, so an S3 key can't path-traverse
    # out of the hot folder.
    base = os.path.basename(key.replace("\\", "/"))
    if not base or base in (".", "..") or "/" in base or "\\" in base:
        raise ValueError(f"Unsafe object name derived from key: {key}")
    return base


def drop_file(directory: str, file_name: str, data: bytes, part_suffix: str) -> str:
    os.makedirs(directory, exist_ok=True)
    final_path = os.path.join(directory, file_name)
    part_path = os.path.join(directory, f"{file_name}{part_suffix}")
    with open(part_path, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(part_path, final_path)  # atomic within the same dir/share
    return final_path


def list_files(directory: str) -> List[str]:
    try:
        return [e.name for e in os.scandir(directory) if e.is_file()]
    except FileNotFoundError:
        return []


def remove_file(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass

#!/usr/bin/env python3
"""Package a compiled release, keeping published versioned images immutable."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

RAW = "https://raw.githubusercontent.com/LeMec87/sen65-air-monitor/main/dist/"
APP_PARTITION_SIZE = 1835008


def version_from_config(root):
    yaml = (root / "firmware/sen65-air-monitor.yaml").read_text()
    match = re.search(r'^  fw_version: "([0-9]+\.[0-9]+\.[0-9]+)"$', yaml, re.M)
    if not match or any(len(x) > 1 and x.startswith("0") or int(x) > 65535
                        for x in match[1].split(".")):
        raise ValueError("fw_version must be a canonical major.minor.patch release")
    return match[1]


def package(root, build_path):
    version = version_from_config(root)
    defines = (build_path / "src/esphome/core/defines.h").read_text()
    if f'#define ESPHOME_PROJECT_VERSION "{version}"' not in defines:
        raise ValueError("Build version does not match YAML; compile again before packaging")
    images = build_path / ".pioenvs/sen65-air-monitor"
    dist = root / "dist"
    copies = []
    for kind in ("ota", "factory"):
        source = images / f"firmware.{kind}.bin"
        target = dist / f"sen65-air-monitor-v{version}-{kind}.bin"
        data = source.read_bytes()
        if not data or (kind == "ota" and len(data) > APP_PARTITION_SIZE):
            raise ValueError(f"Empty image or OTA image exceeds application partition: {source}")
        if target.exists() and target.read_bytes() != data:
            raise ValueError(f"Refusing to replace existing release image: {target}; bump fw_version")
        copies.append((source, target))
    dist.mkdir(parents=True, exist_ok=True)
    for source, target in copies:
        if not target.exists():
            shutil.copyfile(source, target)
    ota = dist / f"sen65-air-monitor-v{version}-ota.bin"
    manifest = {
        "name": "SEN65 Air Monitor",
        "version": version,
        "builds": [{
            "chipFamily": "ESP32-C3",
            "ota": {
                "path": RAW + ota.name,
                "md5": hashlib.md5(ota.read_bytes()).hexdigest(),
                "release_url": "https://github.com/LeMec87/sen65-air-monitor/blob/main/CHANGELOG.md",
                "summary": "See the release notes before installing. Installation restarts the board and clears RAM-only graph history.",
            },
        }],
    }
    (dist / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    sums = "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n"
                   for p in sorted(dist.glob("sen65-air-monitor-v*-*.bin")))
    (dist / "SHA256SUMS").write_text(sums)
    print(f"Packaged v{version}: {ota.stat().st_size} OTA bytes; manifest and SHA256SUMS generated")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--build-path", type=Path, default=Path("/tmp/sen65-air-monitor-build"))
    args = parser.parse_args()
    package(args.project_root.resolve(), args.build_path.resolve())

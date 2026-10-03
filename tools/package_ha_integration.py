"""Package the HA integration deterministically, without changing firmware releases."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def package(root: Path, output: Path):
    component = root / "custom_components/sen65_air_monitor"
    version = json.loads((component / "manifest.json").read_text())["version"]
    for name in ("index.html", "style.css", "transport.js", "app.js", "history.js", "home-assistant.js"):
        if (component / "frontend" / name).read_bytes() != (root / "firmware/components/air_monitor_web_ui/web" / name).read_bytes():
            raise ValueError("Run tools/sync_ha_frontend.py before packaging.")
    content = io.BytesIO()
    with zipfile.ZipFile(content, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(component.rglob("*")):
            if not file.is_file() or "__pycache__" in file.parts or file.suffix == ".pyc":
                continue
            info = zipfile.ZipInfo(str(file.relative_to(root)), date_time=(2026,1,1,0,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, file.read_bytes())
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"sen65-air-monitor-ha-v{version}.zip"
    data = content.getvalue()
    if target.exists() and target.read_bytes() != data:
        raise ValueError("Refusing to replace a different versioned HA package. Bump manifest.json first.")
    target.write_bytes(data)
    checksum = hashlib.sha256(data).hexdigest()
    target.with_suffix(".zip.sha256").write_text(f"{checksum}  {target.name}\n")
    return target

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/home-assistant")
    args = parser.parse_args()
    print(package(ROOT, args.output))

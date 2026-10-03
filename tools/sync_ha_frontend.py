"""Mechanically sync the one shared dashboard into the HA installable package."""
import argparse
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "firmware/components/air_monitor_web_ui/web"
TARGET = ROOT / "custom_components/sen65_air_monitor/frontend"
FILES = ("index.html", "style.css", "transport.js", "app.js", "history.js", "home-assistant.js")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale = []
    for name in FILES:
        source, target = SOURCE / name, TARGET / name
        if args.check:
            if not target.exists() or source.read_bytes() != target.read_bytes():
                stale.append(name)
        else:
            TARGET.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    component = TARGET.parent
    source, target = component / "strings.json", component / "translations/en.json"
    if args.check:
        if not target.exists() or source.read_bytes() != target.read_bytes():
            stale.append("translations/en.json")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    if stale:
        parser.exit(1, "HA assets are out of date: " + ", ".join(stale) + "\nRun python3 tools/sync_ha_frontend.py\n")
    print("Shared dashboard and HA package assets match.")

if __name__ == "__main__":
    main()

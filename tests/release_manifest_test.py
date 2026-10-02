"""Verify the actual published manifest and every packaged image checksum."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_release", ROOT / "tools/prepare_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_manifest(self):
        manifest = json.loads((ROOT / "dist/manifest.json").read_text())
        version = release.version_from_config(ROOT)
        self.assertEqual(manifest["name"], "SEN65 Air Monitor")
        self.assertEqual(manifest["version"], version)
        self.assertEqual(len(manifest["builds"]), 1)
        build = manifest["builds"][0]
        self.assertEqual(build["chipFamily"], "ESP32-C3")
        filename = f"sen65-air-monitor-v{version}-ota.bin"
        data = (ROOT / "dist" / filename).read_bytes()
        self.assertEqual(build["ota"]["path"], release.RAW + filename)
        self.assertEqual(build["ota"]["md5"], hashlib.md5(data).hexdigest())
        self.assertLessEqual(len(data), release.APP_PARTITION_SIZE)
        self.assertGreater(len(data), 65536)
        self.assertTrue((ROOT / "dist" / f"sen65-air-monitor-v{version}-factory.bin").is_file())

    def test_all_sha256_checksums(self):
        names = set()
        for line in (ROOT / "dist/SHA256SUMS").read_text().splitlines():
            checksum, filename = line.split("  ")
            self.assertEqual(Path(filename).name, filename)
            self.assertNotIn(filename, names)
            names.add(filename)
            self.assertEqual(hashlib.sha256((ROOT / "dist" / filename).read_bytes()).hexdigest(), checksum)
        self.assertEqual(names, {p.name for p in (ROOT / "dist").glob("*.bin")})

    def test_packaging_refuses_stale_build_and_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="sen65-release-test-") as temp:
            root = Path(temp)
            (root / "firmware").mkdir()
            (root / "firmware/sen65-air-monitor.yaml").write_text('substitutions:\n  fw_version: "1.2.3"\n')
            build = root / "build"
            header = build / "src/esphome/core/defines.h"
            header.parent.mkdir(parents=True)
            header.write_text('#define ESPHOME_PROJECT_VERSION "1.2.2"\n')
            with self.assertRaisesRegex(ValueError, "Build version"):
                release.package(root, build)
            header.write_text('#define ESPHOME_PROJECT_VERSION "1.2.3"\n')
            images = build / ".pioenvs/sen65-air-monitor"
            images.mkdir(parents=True)
            (images / "firmware.ota.bin").write_bytes(b"OTA")
            (images / "firmware.factory.bin").write_bytes(b"FACTORY")
            release.package(root, build)
            original = (root / "dist/manifest.json").read_bytes()
            (images / "firmware.ota.bin").write_bytes(b"DIFFERENT")
            with self.assertRaisesRegex(ValueError, "Refusing to replace"):
                release.package(root, build)
            self.assertEqual((root / "dist/manifest.json").read_bytes(), original)


if __name__ == "__main__":
    unittest.main()

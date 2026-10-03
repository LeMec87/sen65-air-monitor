"""Check the installable HA package and the shared frontend source of truth."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package_ha", ROOT / "tools/package_ha_integration.py")
package_ha = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package_ha)

class PackageTests(unittest.TestCase):
    def test_shared_sources_match(self):
        subprocess.run([sys.executable, str(ROOT / "tools/sync_ha_frontend.py"), "--check"], check=True)
        root = ROOT / "custom_components/sen65_air_monitor"
        self.assertEqual((root / "strings.json").read_bytes(), (root / "translations/en.json").read_bytes())
        manifest = json.loads((root / "manifest.json").read_text())
        self.assertTrue(manifest["config_flow"])
        self.assertEqual(manifest["domain"], "sen65_air_monitor")

    def test_deterministic_clean_package(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            target = package_ha.package(ROOT, output)
            first = target.read_bytes()
            self.assertEqual(package_ha.package(ROOT, output).read_bytes(), first)
            checksum = target.with_suffix(".zip.sha256").read_text().split()[0]
            self.assertEqual(hashlib.sha256(first).hexdigest(), checksum)
            with zipfile.ZipFile(target) as archive:
                names = archive.namelist()
                self.assertTrue(all(name.startswith("custom_components/sen65_air_monitor/") for name in names))
                self.assertFalse(any("__pycache__" in name or name.endswith(".pyc") for name in names))
                self.assertIn("custom_components/sen65_air_monitor/frontend/panel.js", names)
                self.assertIn("custom_components/sen65_air_monitor/frontend/transport.js", names)

if __name__ == "__main__":
    unittest.main()

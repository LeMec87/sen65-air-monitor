"""Test the actual build generator without importing ESPHome or editing sources."""
import ast
import gzip
import os
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "firmware/components/air_monitor_web_ui"

class WebBundleTests(unittest.TestCase):
    def test_deterministic_gzip_bundle(self):
        tree = ast.parse((COMPONENT / "__init__.py").read_text())
        generator = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_generate_html_header")
        with tempfile.TemporaryDirectory() as temp:
            namespace = {"os": os, "gzip": gzip, "_WEB_DIR": str(COMPONENT / "web"), "_BASE_DIR": temp}
            exec(compile(ast.Module(body=[generator], type_ignores=[]), "generator", "exec"), namespace)
            namespace["_generate_html_header"]()
            output = Path(temp) / "air_monitor_web_ui_html.h"
            first = output.read_bytes()
            namespace["_generate_html_header"]()
            self.assertEqual(first, output.read_bytes())
            data = bytes(int(n, 16) for n in re.findall(rb"0x([0-9a-f]{2})", first))
            html = gzip.decompress(data).decode()
            self.assertNotIn('<script src="', html)
            self.assertNotIn('href="style.css"', html)
            for script in ("transport.js", "app.js", "history.js", "home-assistant.js"):
                self.assertIn((COMPONENT / "web" / script).read_text(), html)
            self.assertLess(len(data), 35000)
            source = (COMPONENT / "air_monitor_web_ui.h").read_text()
            self.assertIn('addHeader("Content-Encoding", "gzip")', source)
            self.assertIn('sizeof(INDEX_HTML_GZIP)', source)

    def test_shared_ring_and_nonblocking_discovery(self):
        epaper = (ROOT / "firmware/components/air_monitor_epaper/air_monitor_epaper.h").read_text()
        self.assertEqual(epaper.count('g_history_sample_ms[g_history_head] = now;'), 2)
        self.assertIn('g_history[metric][(oldest + i) % HISTORY_POINTS]', epaper)
        discovery = (COMPONENT / "home_assistant_discovery.h").read_text()
        self.assertIn('mdns_query_async_get_results(search_, 0,', discovery)
        self.assertIn('mdns_query_async_delete(search_)', discovery)
        self.assertIn('mdns_query_results_free(results)', discovery)
        self.assertNotIn('mdns_init(', discovery)
        self.assertIn('"_home-assistant", "_tcp"', discovery)
        self.assertIn('Snapshot snapshot() const', discovery)
        self.assertIn('esphome::LockGuard lock(mutex_)', discovery)
        self.assertEqual(epaper.count('esphome::LockGuard lock(g_history_mutex)'), 2)

if __name__ == "__main__":
    unittest.main()

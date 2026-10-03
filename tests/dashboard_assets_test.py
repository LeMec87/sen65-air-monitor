"""Check the embedded dashboard's DOM/API wiring and approved palette."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "firmware/components/air_monitor_web_ui/web"


class DashboardParser(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.elements = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.html = (WEB / "index.html").read_text()
        self.js = "\n".join((WEB / name).read_text() for name in ("app.js", "history.js", "home-assistant.js"))
        self.css = (WEB / "style.css").read_text()
        self.elements = DashboardParser(self.html).elements
        self.ids = Counter(attrs["id"] for _, attrs in self.elements if "id" in attrs)

    def test_unique_ids_and_script_targets(self):
        self.assertTrue(self.ids)
        self.assertTrue(all(count == 1 for count in self.ids.values()))
        targets = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", self.js))
        self.assertLessEqual(targets, set(self.ids))

    def test_labels_and_navigation(self):
        for tag, attrs in self.elements:
            if tag == "label" and "for" in attrs:
                self.assertIn(attrs["for"], self.ids)
            if "aria-controls" in attrs:
                self.assertIn(attrs["aria-controls"], self.ids)
        buttons = [attrs for tag, attrs in self.elements if tag == "button" and "data-tab" in attrs]
        self.assertEqual({b["data-tab"] for b in buttons}, {"env", "history", "weather", "ha", "fw"})
        self.assertEqual(sum(b.get("aria-pressed") == "true" for b in buttons), 1)
        self.assertTrue(all(b.get("aria-label") for b in buttons))
        self.assertIn("Skip to content", self.html)

    def test_palette_and_fallbacks(self):
        css = self.css.lower()
        for color in ("#c31725", "#2585d9", "#51b666", "#f28f16", "#f26513"):
            self.assertIn(color, css)
        for old_color in ("#330136", "#5e1742", "#962e40", "#c9463d", "#ff5e35"):
            self.assertNotIn(old_color, css)
        self.assertIn("color-scheme: dark", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("@supports not", css)
        self.assertIn("system-ui", css)

    def test_mobile_navigation_is_one_evenly_aligned_row(self):
        tablet = re.search(r"@media \(max-width: 760px\) \{(.*?)\n\}", self.css, re.S)[1]
        narrow = re.search(r"@media \(max-width: 420px\) \{(.*?)\n\}", self.css, re.S)[1]
        self.assertIn("repeat(5, minmax(0, 1fr))", tablet)
        self.assertIn("gap: 4px", tablet)
        self.assertIn("padding: 6px", tablet)
        self.assertIn("min-width: 0", tablet)
        self.assertIn("min-height: 56px", tablet)
        self.assertIn("justify-content: center", tablet)
        self.assertIn(".tab-btn .nav-dot { position: absolute", tablet)
        self.assertIn(".tab-btn svg { width: 26px; height: 26px; }", tablet)
        self.assertNotIn("grid-column:", tablet)
        self.assertIn(".nav-label-mobile { display: none; }", self.css)
        self.assertIn(".tab-btn > span:not(.nav-dot) { display: none; }", tablet)
        buttons = {attrs["id"]: attrs for tag, attrs in self.elements if tag == "button" and "data-tab" in attrs}
        self.assertEqual(buttons["nav-env"]["aria-label"], "Overview (Environment)")
        self.assertEqual(buttons["nav-ha"]["aria-label"], "Home Assistant (HA)")
        self.assertNotIn("@media (max-width: 600px)", self.css)
        self.assertNotIn(".tab-buttons", narrow)  # Keep the compact stacked-icon layout.
        self.assertNotIn(".tab-btn {", narrow)

    def test_ha_setup_is_simple_with_optional_advanced_details(self):
        self.assertIn('class="ha-setup"', self.html)
        details = next(attrs for tag, attrs in self.elements if tag == "details" and attrs.get("class") == "ha-advanced")
        self.assertNotIn("open", details)
        self.assertIn("Install the HA integration", self.html)
        self.assertIn("domain=sen65_air_monitor", self.html)
        self.assertIn("Firmware alone cannot install the HA integration", self.html)
        self.assertIn('id="ha-https-warning"', self.html)


if __name__ == "__main__":
    unittest.main()

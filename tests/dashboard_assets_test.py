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
        self.js = (WEB / "app.js").read_text()
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
        self.assertEqual({b["data-tab"] for b in buttons}, {"env", "weather", "fw"})
        self.assertEqual(sum(b.get("aria-pressed") == "true" for b in buttons), 1)
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


if __name__ == "__main__":
    unittest.main()

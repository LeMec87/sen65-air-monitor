"""Compile and test the firmware's real history-scale helpers without a board."""
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import unittest
import os

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "firmware/components/air_monitor_epaper/air_monitor_epaper.h"


def function(source, name):
    match = re.search(r"    inline [^\n]+\b" + name + r"\s*\(", source)
    if match is None:
        raise AssertionError(f"Missing firmware helper: {name}")
    opening = source.index("{", match.end())
    depth, end = 1, opening + 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}")
        end += 1
    return source[match.start():end]


class HistoryAxesTests(unittest.TestCase):
    def test_actual_scale_helpers(self):
        source = SOURCE.read_text()
        state = source[source.index("    enum HistoryMetric"):source.index("    // --- Config ---")]
        helpers = "\n".join(function(source, name) for name in (
            "history_value", "history_bounds", "history_plot_bounds", "format_history_axis_tick"))
        harness = """
#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <cstddef>
static bool g_use_f = false;
""" + state + helpers + """
void fill(HistoryMetric metric, float value) {
  for (size_t i=0; i<HISTORY_POINTS; ++i) g_history[metric][i]=value;
}
int main() {
  g_history_count=HISTORY_POINTS;
  float lo,hi;
  for (auto metric: {HISTORY_PM1,HISTORY_PM25,HISTORY_PM4,HISTORY_PM10,HISTORY_VOC,HISTORY_NOX,HISTORY_RH}) {
    fill(metric,0);
    history_plot_bounds(metric,lo,hi);
    assert(lo==0 && hi>0 && std::isfinite(hi));
    fill(metric,1);
    history_plot_bounds(metric,lo,hi);
    assert(lo>=0 && lo<=1 && hi>=1 && hi>lo);
  }
  fill(HISTORY_TEMP,-10);
  history_plot_bounds(HISTORY_TEMP,lo,hi);
  assert(lo<=-10 && hi>=-10 && hi>lo);
  fill(HISTORY_TEMP,28);
  g_use_f=true;
  history_plot_bounds(HISTORY_TEMP,lo,hi);
  assert(history_value(HISTORY_TEMP,0)>82 && history_value(HISTORY_TEMP,0)<83);
  assert(lo<=82.4f && hi>=82.4f && lo>80 && hi<85);
  g_use_f=false;
  for (float value: {0.0f,1.0f,1000.0f}) {
    fill(HISTORY_PM1,value);
    history_plot_bounds(HISTORY_PM1,lo,hi);
    char a[20],b[20],c[20];
    float step=(hi-lo)/2;
    format_history_axis_tick(a,sizeof(a),lo,step);
    format_history_axis_tick(b,sizeof(b),(lo+hi)/2,step);
    format_history_axis_tick(c,sizeof(c),hi,step);
    assert(std::strcmp(a,b)!=0 && std::strcmp(b,c)!=0);
  }
  char label[20];
  format_history_axis_tick(label,sizeof(label),27.5f,22.5f);
  assert(std::strcmp(label,"27.5")==0);
  format_history_axis_tick(label,sizeof(label),-0.000001f,0.1f);
  assert(std::strcmp(label,"0")==0);
  format_history_axis_tick(label,sizeof(label),NAN,NAN);
  assert(std::strcmp(label,"--")==0);
}
"""
        harness = "#include <initializer_list>\n" + harness
        compiler = shlex.split(os.environ.get("CXX", "c++"))
        flags = ["-std=c++17"]
        if sys.platform == "darwin":
            sdk = Path(subprocess.check_output(["xcrun", "--show-sdk-path"], text=True).strip())
            headers = sdk / "usr/include/c++/v1"
            if headers.is_dir():
                flags += ["-isystem", str(headers)]
        with tempfile.TemporaryDirectory(prefix="sen65-axis-test-") as temp:
            cpp, binary = Path(temp) / "axes.cpp", Path(temp) / "axes-test"
            cpp.write_text(harness)
            subprocess.run(compiler + flags + [str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_all_graphs_use_thick_lines_and_axis_titles(self):
        source = SOURCE.read_text()
        for name, count in (("render_particles", 4), ("render_gases", 2), ("render_climate", 2)):
            body = function(source, name)
            self.assertEqual(len(re.findall(r", [0-3], 3\}", body)), count)
        chart = function(source, "draw_combined_history_chart")
        self.assertIn('"TIME"', chart)
        self.assertIn("draw_history_axis_labels", chart)
        self.assertIn('"VOC INDEX", "NOX INDEX"', source)
        self.assertIn('"HUM %"', source)
        self.assertIn(r'"\xB5g/m\xB3"', source)


if __name__ == "__main__":
    unittest.main()

"""Exercise the real sampling/ring functions, not a second implementation."""
from pathlib import Path
import os
import shlex
import subprocess
import sys
import tempfile
import unittest
from history_axes_test import function, SOURCE

ROOT = Path(__file__).resolve().parents[1]

class RingTests(unittest.TestCase):
    def test_sampling_averages_and_ring_order(self):
        source = SOURCE.read_text()
        state = source[source.index('    enum HistoryMetric'):source.index('    // --- Config ---')]
        harness = r'''
#include <cassert>
#include <cstdint>
#include <cstddef>
#include <mutex>
#include <string>
#include "firmware/components/air_monitor_web_ui/history_api.h"
namespace esphome { using Mutex=std::mutex; using LockGuard=std::lock_guard<Mutex>; }
static esphome::Mutex g_history_mutex;
static bool ready=true;
static float g_pm1,g_pm25,g_pm4,g_pm10,g_voc,g_nox,g_temp,g_rh;
static uint32_t now_ms=0;
static uint32_t millis(){return now_ms;}
static bool all_metrics_ready(){return ready;}
static constexpr unsigned long HISTORY_SAMPLE_MS=300000;
''' + state + function(source,'sample_history') + function(source,'history_json') + r'''
void reading(float v){g_pm1=g_pm25=g_pm4=g_pm10=g_voc=g_nox=g_temp=g_rh=v;}
int main(){
  reading(1); ready=false; sample_history(0); assert(g_history_count==0);
  ready=true; sample_history(0); assert(g_history_count==1);
  reading(2); sample_history(1000); assert(g_history_count==1);
  reading(4); sample_history(300000); assert(g_history_count==2);
  for(unsigned m=0;m<HISTORY_METRIC_COUNT;++m)assert(g_history[m][1]==3);
  assert(g_history_sample_ms[1]==300000);
  assert(g_history_accumulator_count==0);
  g_history_count=g_history_head=0;
  reading(0); sample_history(0);
  for(unsigned i=1;i<=289;++i){reading(i);sample_history(i*300000);}
  now_ms=289*300000;
  assert(g_history_count==288 && g_history_head==2);
  auto result=history_json("climate");
  assert(result.find("\"points\":[[600000,2.00,2.00]")!=std::string::npos);
  assert(result.find("[86700000,289.00,289.00]]}")!=std::string::npos);
}
'''
        flags = ['-std=c++17','-I',str(ROOT)]
        if sys.platform == 'darwin':
            sdk = Path(subprocess.check_output(['xcrun','--show-sdk-path'],text=True).strip())
            flags += ['-isystem',str(sdk/'usr/include/c++/v1')]
        with tempfile.TemporaryDirectory(prefix='sen65-ring-test-') as temp:
            cpp,binary=Path(temp)/'ring.cpp',Path(temp)/'ring-test'
            cpp.write_text(harness)
            subprocess.run(shlex.split(os.environ.get('CXX','c++'))+flags+[str(cpp),'-o',str(binary)],check=True)
            subprocess.run([str(binary)],check=True)

if __name__=='__main__':
    unittest.main()

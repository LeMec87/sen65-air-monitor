#pragma once
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>

namespace air_monitor::history {
struct Group { const char *keys; unsigned first; unsigned count; };
inline Group group(const std::string &name) {
  if (name == "particles") return {"\"pm1\",\"pm25\",\"pm4\",\"pm10\"", 0, 4};
  if (name == "gases") return {"\"voc\",\"nox\"", 4, 2};
  if (name == "climate") return {"\"temp\",\"rh\"", 6, 2};
  return {nullptr, 0, 0};
}
// Serialize a single group from the existing ring; no duplicate history buffer.
template<class TimeReader, class ValueReader>
std::string json(const std::string &name, uint32_t now, unsigned count,
                 TimeReader time_at, ValueReader value_at) {
  const auto fields = group(name);
  if (!fields.keys) return "{}";
  std::string out;
  out.reserve(256 + count * (fields.count * 9 + 14));
  char number[32];
  snprintf(number, sizeof(number), "%lu", static_cast<unsigned long>(now));
  out = "{\"window_seconds\":86400,\"sample_interval_seconds\":300,\"temperature_unit\":\"C\",\"uptime_ms\":";
  out += number;
  out += ",\"metrics\":["; out += fields.keys; out += "],\"points\":[";
  bool comma = false;
  for (unsigned i = 0; i < count; ++i) {
    const uint32_t stamp = time_at(i);
    if (static_cast<uint32_t>(now - stamp) > 86400000UL) continue;
    if (comma) out += ',';
    comma = true;
    snprintf(number, sizeof(number), "%lu", static_cast<unsigned long>(stamp));
    out += '['; out += number;
    for (unsigned j = 0; j < fields.count; ++j) {
      const float value = value_at(fields.first + j, i);
      out += ',';
      if (std::isfinite(value)) {
        snprintf(number, sizeof(number), "%.2f", value);
        out += number;
      } else out += "null";
    }
    out += ']';
  }
  out += "]}";
  return out;
}
}

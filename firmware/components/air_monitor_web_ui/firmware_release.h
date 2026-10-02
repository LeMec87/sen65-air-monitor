#pragma once

#include <cstdint>
#include <string>

namespace air_monitor::release {

inline bool parse_version(const std::string &text, uint32_t (&parts)[3]) {
  size_t pos = 0;
  for (int i = 0; i < 3; ++i) {
    if (pos == text.size() || text[pos] < '0' || text[pos] > '9') return false;
    uint32_t value = 0;
    const size_t start = pos;
    while (pos < text.size() && text[pos] >= '0' && text[pos] <= '9') {
      value = value * 10 + (text[pos++] - '0');
      if (value > 65535) return false;
    }
    if (pos - start > 1 && text[start] == '0') return false;
    parts[i] = value;
    if (i < 2 && (pos == text.size() || text[pos++] != '.')) return false;
  }
  return pos == text.size();
}

inline bool is_newer(const std::string &candidate, const std::string &current) {
  uint32_t next[3], installed[3];
  if (!parse_version(candidate, next) || !parse_version(current, installed)) return false;
  for (int i = 0; i < 3; ++i) {
    if (next[i] != installed[i]) return next[i] > installed[i];
  }
  return false;
}

inline bool valid_download(const std::string &version, const std::string &url, const std::string &md5) {
  uint32_t parts[3];
  if (!parse_version(version, parts) || md5.size() != 32) return false;
  for (char c : md5) {
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
  }
  const std::string expected = "https://raw.githubusercontent.com/LeMec87/sen65-air-monitor/main/dist/"
                               "sen65-air-monitor-v" + version + "-ota.bin";
  return url == expected;
}

}  // namespace air_monitor::release

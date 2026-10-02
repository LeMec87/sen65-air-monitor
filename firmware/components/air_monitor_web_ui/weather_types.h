#pragma once

#include <cmath>
#include <cstdlib>
#include <cstring>
#include <string>

namespace air_monitor::weather {

enum Kind {
  UNKNOWN = -1, SUN = 0, CLOUD = 1, LIGHT_RAIN = 2, MOON = 3,
  PARTLY_CLOUDY = 4, HEAVY_RAIN = 5, THUNDERSTORM = 6
};

inline Kind from_wmo(int code, bool day) {
  switch (code) {
    case 0: case 1: return day ? SUN : MOON;
    case 2: return PARTLY_CLOUDY;
    case 3: case 45: case 48:
    case 71: case 73: case 75: case 77: case 85: case 86: return CLOUD;
    case 51: case 53: case 55: case 56: case 57:
    case 61: case 63: case 66: case 80: case 81: return LIGHT_RAIN;
    case 65: case 67: case 82: return HEAVY_RAIN;
    case 95: case 96: case 97: case 99: return THUNDERSTORM;
    default: return UNKNOWN;
  }
}

inline const char *label(int kind) {
  switch (kind) {
    case SUN: return "Sunny";
    case CLOUD: return "Cloudy";
    case LIGHT_RAIN: return "Light rain";
    case MOON: return "Clear night";
    case PARTLY_CLOUDY: return "Partly cloudy";
    case HEAVY_RAIN: return "Heavy rain";
    case THUNDERSTORM: return "Thunderstorm";
    default: return "Waiting for weather";
  }
}

inline bool valid_coordinates(float lat, float lon) {
  return std::isfinite(lat) && std::isfinite(lon) &&
         lat >= -90.0f && lat <= 90.0f && lon >= -180.0f && lon <= 180.0f;
}

inline bool parse_coordinate(const std::string &text, float &result) {
  if (text.empty() || text.size() > 24) return false;
  char *end = nullptr;
  result = std::strtof(text.c_str(), &end);
  return end != text.c_str() && *end == '\0' && std::isfinite(result);
}

inline bool valid_name(const std::string &name) {
  if (name.empty() || name.size() >= 128) return false;
  bool visible = false;
  for (unsigned char c : name) {
    if (c < 32 || c == 127) return false;
    if (c != ' ') visible = true;
  }
  return visible;
}

// Versioned POD storage, persisted only when a setting changes (not on refresh).
struct Settings {
  unsigned int version{1};
  unsigned int manual{0};
  float latitude{0};
  float longitude{0};
  char name[128]{};
};

inline bool valid_settings(const Settings &s) {
  if (s.version != 1 || s.manual > 1 || s.name[127] != '\0') return false;
  return !s.manual || (valid_coordinates(s.latitude, s.longitude) && valid_name(s.name));
}

}  // namespace air_monitor::weather

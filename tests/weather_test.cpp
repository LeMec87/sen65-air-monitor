#include "../firmware/components/air_monitor_web_ui/weather_types.h"
#include <cassert>
#include <iostream>
#include <limits>

int main() {
  using namespace air_monitor::weather;
  for (int code : {0, 1}) {
    assert(from_wmo(code, true) == SUN);
    assert(from_wmo(code, false) == MOON);
  }
  assert(from_wmo(2, true) == PARTLY_CLOUDY);
  assert(from_wmo(2, false) == PARTLY_CLOUDY);
  for (int code : {3, 45, 48, 71, 73, 75, 77, 85, 86}) assert(from_wmo(code, true) == CLOUD);
  for (int code : {51, 53, 55, 56, 57, 61, 63, 66, 80, 81}) {
    assert(from_wmo(code, true) == LIGHT_RAIN);
    assert(from_wmo(code, false) == LIGHT_RAIN);
  }
  for (int code : {65, 67, 82}) assert(from_wmo(code, false) == HEAVY_RAIN);
  for (int code : {95, 96, 97, 99}) assert(from_wmo(code, true) == THUNDERSTORM);
  for (int code : {-1, 4, 68, 100, 999}) assert(from_wmo(code, true) == UNKNOWN);
  assert(valid_coordinates(-90, 180));
  assert(!valid_coordinates(90.1f, 0));
  assert(!valid_coordinates(0, -180.1f));
  assert(!valid_coordinates(NAN, 0));
  assert(!valid_coordinates(0, std::numeric_limits<float>::infinity()));
  float parsed;
  for (const char *text : {"", "NaN", "inf", "1abc", "--1", "1e999"}) assert(!parse_coordinate(text, parsed));
  assert(parse_coordinate("-33.123", parsed) && parsed < -33);
  assert(valid_name("Ho Chi Minh City, Vietnam"));
  assert(valid_name("City \"quoted\" \\ test"));
  assert(!valid_name(""));
  assert(!valid_name("   "));
  assert(!valid_name("City\n"));
  assert(!valid_name(std::string(128, 'x')));
  Settings settings;
  assert(valid_settings(settings));
  settings.manual = 1;
  assert(!valid_settings(settings));
  std::strcpy(settings.name, "Berlin, Germany");
  settings.latitude = 52.52f; settings.longitude = 13.41f;
  assert(valid_settings(settings));
  settings.version = 99;
  assert(!valid_settings(settings));
  std::cout << "Weather mapping, coordinate validation, and settings tests passed.\n";
}

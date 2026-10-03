#pragma once

#include "esphome/core/component.h"
#include "esphome/core/log.h"
#include "esphome/core/defines.h"
#include "esphome/components/select/select.h"
#include "esphome/components/web_server_base/web_server_base.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/update/update_entity.h"
#include "esphome/core/preferences.h"
#include "esphome/components/json/json_util.h"
#include "weather_types.h"
#include "firmware_release.h"
#include "esphome/components/network/util.h"

#include <string>
#include <cmath>
#include <functional>


namespace air_monitor
{

  using esphome::sensor::Sensor;
  using esphome::select::Select;
  using esphome::update::UpdateEntity;

  static const char *const TAG = "air_monitor_web_ui";

  // Full HTML/JS UI.
  // - Main tab: Environment (live metrics)
  // - Second tab: Firmware & Updates (one-click managed update via http_request)
  #include "air_monitor_web_ui_html.h"

  class AirMonitorWebUI : public esphome::Component, public AsyncWebHandler
  {
  public:
    void set_co2(Sensor *s) { co2_ = s; }
    void set_pm25(Sensor *s) { pm25_ = s; }
    void set_temp(Sensor *s) { temp_ = s; }
    void set_rh(Sensor *s) { rh_ = s; }
    void set_pm1(Sensor *s) { pm1_ = s; }
    void set_pm4(Sensor *s) { pm4_ = s; }
    void set_pm10(Sensor *s) { pm10_ = s; }
    void set_voc(Sensor *s) { voc_ = s; }
    void set_nox(Sensor *s) { nox_ = s; }

    void set_fw_update(UpdateEntity *u) {
      fw_update_ = u;
      u->add_on_state_callback([this]() { fw_checking_ = false; fw_update_error_.clear(); });
    }
    void set_fw_update_component(esphome::Component *c) { fw_update_component_ = c; }
    void set_temp_unit_switch(Select *s) { temp_unit_select_ = s; }
    void set_on_check_update(std::function<void()> f) { on_check_update_ = f; }
    void set_on_weather_refresh(std::function<void()> f) { on_weather_refresh_ = f; }
    float weather_latitude() const { return weather_settings_.manual ? weather_settings_.latitude : auto_lat_; }
    float weather_longitude() const { return weather_settings_.manual ? weather_settings_.longitude : auto_lon_; }
    int weather_kind() const { return weather_kind_; }
    bool weather_has_location() const {
      return weather::valid_coordinates(weather_latitude(), weather_longitude());
    }
    void weather_error(const char *message) { weather_error_ = message; }
    void weather_fetch_started() { weather_error_.clear(); weather_fetching_ = true; }
    void weather_fetch_finished() { weather_fetching_ = false; }
    void set_auto_weather_location(float lat, float lon, const std::string &name) {
      if (weather_settings_.manual || !weather::valid_coordinates(lat, lon)) return;
      auto_lat_ = lat;
      auto_lon_ = lon;
      auto_name_ = name.substr(0, 127);
    }
    bool publish_weather(int code, int is_day) {
      const int kind = weather::from_wmo(code, is_day == 1);
      if (kind == weather::UNKNOWN || (is_day != 0 && is_day != 1)) return false;
      weather_kind_ = kind;
      weather_code_ = code;
      weather_received_ms_ = esphome::millis();
      weather_received_ = true;
      weather_error_.clear();
      ESP_LOGI(TAG, "Weather: %s (WMO %d)", weather::label(kind), code);
      return true;
    }

    void setup() override
    {
      weather_pref_ = esphome::global_preferences->make_preference<weather::Settings>(0x57455801);
      weather::Settings stored;
      if (weather_pref_.load(&stored) && weather::valid_settings(stored)) weather_settings_ = stored;
      auto *ws = esphome::web_server_base::global_web_server_base;
      if (ws == nullptr)
      {
        ESP_LOGW(TAG, "web_server_base not initialized; UI will not be available");
        return;
      }
      ws->add_handler(this);
      ESP_LOGI(TAG, "Air Monitor UI handler registered");
    }

    void dump_config() override
    {
      ESP_LOGCONFIG(TAG, "SEN65 Air Monitor web UI");
#ifdef ESPHOME_PROJECT_VERSION
      ESP_LOGCONFIG(TAG, "  Firmware version: %s", ESPHOME_PROJECT_VERSION);
#else
      ESP_LOGCONFIG(TAG, "  Firmware version: unknown");
#endif
      ESP_LOGCONFIG(TAG, "  http_request update wired: %s", fw_update_ != nullptr ? "YES" : "NO");
    }

    void loop() override {
      if (!fw_checking_) return;
      if (fw_update_component_ != nullptr && fw_update_component_->status_has_error()) {
        fw_checking_ = false;
        fw_update_error_ = "Update check failed. Check internet access and try again.";
      } else if (esphome::millis() - fw_check_started_ms_ > 30000) {
        fw_checking_ = false;
        fw_update_error_ = "Update check timed out. Please try again.";
      }
    }

    bool verified_firmware_update_available() const {
#ifdef ESPHOME_PROJECT_VERSION
      return fw_update_ != nullptr &&
          fw_update_->state == esphome::update::UPDATE_STATE_AVAILABLE &&
          fw_update_error_.empty() &&
          (fw_update_component_ == nullptr || !fw_update_component_->status_has_error()) &&
          release::is_newer(fw_update_->update_info.latest_version, ESPHOME_PROJECT_VERSION) &&
          release::valid_download(fw_update_->update_info.latest_version,
                                  fw_update_->update_info.firmware_url, fw_update_->update_info.md5);
#else
      return false;
#endif
    }

    // AsyncWebHandler interface
    bool canHandle(AsyncWebServerRequest *request) const override
    {
      auto url = request->url();
      if ((url == "/" || url == "/index.html") && !request->hasArg("save"))
        return true;
      if (url.rfind("/api/", 0) == 0)
        return true;
      return false;
    }

    void handleRequest(AsyncWebServerRequest *request) override
    {
      auto url = request->url();
      if (url == "/" || url == "/index.html")
      {
        handle_root_(request);
      }
      else if (url == "/api/state")
      {
        handle_state_(request);
      }
      else if (url == "/api/perform_update")
      {
        handle_perform_update_(request);
      }
      else if (url == "/api/check_update")
      {
        handle_check_update_(request);
      }
      else if (url == "/api/temp_unit")
      {
        handle_temp_unit_(request);
      }
      else if (url == "/api/weather")
      {
        handle_weather_(request);
      }
      else if (url == "/api/weather/refresh")
      {
        if (request->method() != HTTP_POST) {
          request->send(400, "application/json", "{\"error\":\"method_not_allowed\"}");
        } else if (weather_fetching_ || (weather_refresh_requested_ &&
                   esphome::millis() - weather_refresh_requested_ms_ < 30000)) {
          request->send(409, "application/json", "{\"error\":\"Please wait before refreshing again.\"}");
        } else {
          request_weather_refresh_();
          // ESPHome's ESP32 HTTP status mapper does not support 202.
          request->send(200, "application/json", "{\"ok\":true}");
        }
      }
      else
      {
        request->send(404, "text/plain", "Not found");
      }
    }

    bool isRequestHandlerTrivial() const override { return false; }

  private:
    Sensor *co2_{nullptr};
    Sensor *pm25_{nullptr};
    Sensor *temp_{nullptr};
    Sensor *rh_{nullptr};
    Sensor *pm1_{nullptr};
    Sensor *pm4_{nullptr};
    Sensor *pm10_{nullptr};
    Sensor *voc_{nullptr};
    Sensor *nox_{nullptr};

    UpdateEntity *fw_update_{nullptr};
    esphome::Component *fw_update_component_{nullptr};
    bool fw_checking_{false};
    uint32_t fw_check_started_ms_{0};
    std::string fw_update_error_;
    Select *temp_unit_select_{nullptr};
    std::function<void()> on_check_update_{nullptr};
    std::function<void()> on_weather_refresh_{nullptr};
    weather::Settings weather_settings_;
    esphome::ESPPreferenceObject weather_pref_;
    float auto_lat_{NAN}, auto_lon_{NAN};
    std::string auto_name_;
    int weather_kind_{weather::UNKNOWN}, weather_code_{-1};
    uint32_t weather_received_ms_{0}, weather_refresh_requested_ms_{0};
    bool weather_received_{false}, weather_refresh_requested_{false}, weather_fetching_{false};
    std::string weather_error_;

    void request_weather_refresh_() {
      weather_refresh_requested_ = true;
      weather_refresh_requested_ms_ = esphome::millis();
      defer("weather_refresh", [this]() { if (on_weather_refresh_) on_weather_refresh_(); });
    }

    void handle_weather_(AsyncWebServerRequest *request) {
      if (request->method() == HTTP_GET) {
        const auto body = esphome::json::build_json([this](JsonObject root) {
          root["mode"] = weather_settings_.manual ? "manual" : "auto";
          root["location"] = weather_settings_.manual ? std::string(weather_settings_.name) : auto_name_;
          if (weather_has_location()) {
            root["latitude"] = weather_latitude();
            root["longitude"] = weather_longitude();
          } else {
            root["latitude"] = nullptr; root["longitude"] = nullptr;
          }
          root["kind"] = weather_kind_;
          root["condition"] = weather::label(weather_kind_);
          root["weather_code"] = weather_code_;
          root["fetching"] = weather_fetching_;
          root["error"] = weather_error_;
          if (weather_received_) root["age_seconds"] = (esphome::millis() - weather_received_ms_) / 1000;
          else root["age_seconds"] = nullptr;
          root["stale"] = weather_received_ && (esphome::millis() - weather_received_ms_ > 20 * 60 * 1000);
        });
        request->send(200, "application/json", body.c_str());
        return;
      }
      if (request->method() != HTTP_POST) {
        request->send(400, "application/json", "{\"error\":\"method_not_allowed\"}");
        return;
      }
      if (!request->hasParam("mode")) {
        request->send(400, "application/json", "{\"error\":\"Choose a location mode.\"}");
        return;
      }
      const std::string mode = request->getParam("mode")->value();
      weather::Settings next;
      if (mode == "manual") {
        if (!request->hasParam("latitude") || !request->hasParam("longitude") ||
            !request->hasParam("name")) {
          request->send(400, "application/json", "{\"error\":\"Choose a city from the search results.\"}");
          return;
        }
        const std::string name = request->getParam("name")->value();
        if (!weather::parse_coordinate(request->getParam("latitude")->value(), next.latitude) ||
            !weather::parse_coordinate(request->getParam("longitude")->value(), next.longitude) ||
            !weather::valid_coordinates(next.latitude, next.longitude) || !weather::valid_name(name)) {
          request->send(400, "application/json", "{\"error\":\"Invalid location or coordinates.\"}");
          return;
        }
        next.manual = 1;
        std::memcpy(next.name, name.c_str(), name.size() + 1);
      } else if (mode != "auto") {
        request->send(400, "application/json", "{\"error\":\"Invalid location mode.\"}");
        return;
      }
      if (weather_settings_.manual != next.manual || weather_settings_.latitude != next.latitude ||
          weather_settings_.longitude != next.longitude || std::strcmp(weather_settings_.name, next.name) != 0) {
        if (!weather_pref_.save(&next) || !esphome::global_preferences->sync()) {
          request->send(500, "application/json", "{\"error\":\"Could not save the location. Please try again.\"}");
          return;
        }
        weather_settings_ = next;
        auto_lat_ = auto_lon_ = NAN;
        auto_name_.clear();
        // Never display the previous city's weather after a location change.
        weather_kind_ = weather::UNKNOWN;
        weather_code_ = -1;
        weather_received_ = false;
        weather_error_.clear();
      }
      request_weather_refresh_();
      request->send(200, "application/json", "{\"ok\":true}");
    }

    static bool has_value_(Sensor *s)
    {
      return s != nullptr && std::isfinite(s->state);
    }

    // Append a sensor value as a JSON number or null.
    // Returns the number of characters actually written (clamped to remaining).
    static int append_sensor_(char *buf, int remaining, const char *key, Sensor *s, const char *fmt)
    {
      if (remaining <= 0)
        return 0;
      int n;
      if (has_value_(s))
      {
        char tmp[32];
        snprintf(tmp, sizeof(tmp), fmt, s->state);
        n = snprintf(buf, remaining, "\"%s\":%s", key, tmp);
      }
      else
      {
        n = snprintf(buf, remaining, "\"%s\":null", key);
      }
      return n < remaining ? n : remaining - 1;
    }

    // Escape a string for safe JSON insertion (handles " and \).
    static void json_escape_(char *dst, size_t dst_size, const char *src)
    {
      size_t di = 0;
      for (const char *s = src; *s && di + 1 < dst_size; ++s)
      {
        if ((*s == '"' || *s == '\\') && di + 2 < dst_size)
        {
          dst[di++] = '\\';
        }
        dst[di++] = *s;
      }
      dst[di] = '\0';
    }

    void handle_root_(AsyncWebServerRequest *request)
    {
      request->send(200, "text/html", INDEX_HTML);
    }

    void handle_state_(AsyncWebServerRequest *request)
    {
      const char *ver =
#ifdef ESPHOME_PROJECT_VERSION
          ESPHOME_PROJECT_VERSION;
#else
          "unknown";
#endif

      const bool use_f = temp_unit_select_ == nullptr || temp_unit_select_->current_option() != "Celsius";

      std::string error = fw_update_error_;
      if (fw_update_component_ != nullptr && fw_update_component_->status_has_error() && error.empty())
        error = "Firmware check or installation failed. Check internet access and try again.";
      const bool valid = fw_update_ != nullptr && release::valid_download(
          fw_update_->update_info.latest_version, fw_update_->update_info.firmware_url, fw_update_->update_info.md5);
      const bool newer = fw_update_ != nullptr && release::is_newer(fw_update_->update_info.latest_version, ver);
      const char *state = "unknown";
      float progress = 0;
      if (fw_update_ != nullptr) {
        if (fw_update_->state == esphome::update::UPDATE_STATE_INSTALLING) state = "installing";
        else if (!fw_update_->update_info.latest_version.empty()) {
          if (!valid && error.empty()) error = "Published firmware metadata is invalid. Installation is disabled.";
          state = newer && valid ? "available" : "no_update";
        }
        if (fw_update_->update_info.has_progress) progress = fw_update_->update_info.progress;
      }
      if (!error.empty()) state = "error";
      const auto body = esphome::json::build_json([&](JsonObject root) {
        struct { const char *key; Sensor *sensor; } sensors[] = {
          {"co2", co2_}, {"temp", temp_}, {"rh", rh_}, {"pm1", pm1_}, {"pm25", pm25_},
          {"pm4", pm4_}, {"pm10", pm10_}, {"voc", voc_}, {"nox", nox_}
        };
        for (auto &entry : sensors) {
          if (has_value_(entry.sensor)) root[entry.key] = entry.sensor->state;
          else root[entry.key] = nullptr;
        }
        root["fw_version"] = ver;
        root["temp_unit"] = use_f ? "F" : "C";
        root["update_configured"] = fw_update_ != nullptr;
        root["update_checking"] = fw_checking_;
        root["update_error"] = error;
        root["has_update"] = !fw_checking_ && verified_firmware_update_available();
        root["latest_version"] = fw_update_ == nullptr ? "" : fw_update_->update_info.latest_version.c_str();
        root["update_state"] = state;
        root["update_progress"] = progress;
      });
      request->send(200, "application/json", body.c_str());
    }


    void handle_perform_update_(AsyncWebServerRequest *request)
    {
      if (request->method() != HTTP_POST)
      {
        request->send(400, "application/json",
                      "{\"ok\":false,\"error\":\"method_not_allowed\"}");
        return;
      }
      if (fw_update_ == nullptr)
      {
        ESP_LOGW(TAG, "Update requested but http_request update component is not wired");
        request->send(500, "application/json",
                      "{\"ok\":false,\"error\":\"update_not_configured\"}");
        return;
      }

#ifdef ESPHOME_PROJECT_VERSION
      const std::string current = ESPHOME_PROJECT_VERSION;
#else
      const std::string current = "unknown";
#endif
      const auto &info = fw_update_->update_info;
      if (fw_checking_ || fw_update_->state != esphome::update::UPDATE_STATE_AVAILABLE ||
          !fw_update_error_.empty() || (fw_update_component_ && fw_update_component_->status_has_error()) ||
          !release::is_newer(info.latest_version, current) ||
          !release::valid_download(info.latest_version, info.firmware_url, info.md5)) {
        request->send(409, "application/json", "{\"ok\":false,\"error\":\"No verified newer firmware is available. Check for updates first.\"}");
        return;
      }
      ESP_LOGI(TAG, "Starting GitHub firmware update via web UI");
      // false = do not force if it thinks there is no update; UI already checks versions
      fw_update_->perform(false);
      request->send(200, "application/json", "{\"ok\":true}");
    }

    void handle_check_update_(AsyncWebServerRequest *request)
    {
      if (request->method() != HTTP_POST)
      {
        request->send(400, "application/json",
                      "{\"ok\":false,\"error\":\"method_not_allowed\"}");
        return;
      }
      if (fw_update_ == nullptr)
      {
        ESP_LOGW(TAG, "Check update requested but http_request update component is not wired");
        request->send(500, "application/json",
                      "{\"ok\":false,\"error\":\"update_not_configured\"}");
        return;
      }

      if (!esphome::network::is_connected()) {
        request->send(409, "application/json", "{\"ok\":false,\"error\":\"Wi-Fi is not connected.\"}");
        return;
      }
      if (fw_checking_ || fw_update_->state == esphome::update::UPDATE_STATE_INSTALLING) {
        request->send(409, "application/json", "{\"ok\":false,\"error\":\"A firmware check or installation is already running.\"}");
        return;
      }
      fw_update_error_.clear();
      if (fw_update_component_) fw_update_component_->status_clear_error();
      fw_checking_ = true;
      fw_check_started_ms_ = esphome::millis();
      ESP_LOGI(TAG, "Triggering GitHub firmware update check via web UI");
      if (on_check_update_)
      {
        defer("firmware_check", [this]() { on_check_update_(); });
      }
      request->send(200, "application/json", "{\"ok\":true}");
    }

    void handle_temp_unit_(AsyncWebServerRequest *request)
    {
      if (request->method() != HTTP_POST)
      {
        request->send(400, "application/json",
                      "{\"ok\":false,\"error\":\"method_not_allowed\"}");
        return;
      }
      if (temp_unit_select_ == nullptr)
      {
        ESP_LOGW(TAG, "Temperature unit change requested but select is not wired");
        request->send(500, "application/json",
                      "{\"ok\":false,\"error\":\"temp_unit_not_configured\"}");
        return;
      }

      if (!request->hasParam("unit"))
      {
        request->send(400, "application/json",
                      "{\"ok\":false,\"error\":\"missing_unit\"}");
        return;
      }

      const std::string unit = request->getParam("unit")->value();
      if (unit == "C")
      {
        temp_unit_select_->make_call().set_option("Celsius").perform();
        request->send(200, "application/json",
                      "{\"ok\":true,\"temp_unit\":\"C\"}");
      }
      else if (unit == "F")
      {
        temp_unit_select_->make_call().set_option("Fahrenheit").perform();
        request->send(200, "application/json",
                      "{\"ok\":true,\"temp_unit\":\"F\"}");
      }
      else
      {
        request->send(400, "application/json",
                      "{\"ok\":false,\"error\":\"invalid_unit\"}");
      }
    }
  };

} // namespace air_monitor

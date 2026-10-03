#pragma once
#include "home_assistant_helpers.h"
#include "esphome/components/api/api_server.h"
#include "esphome/components/network/util.h"
#include "esphome/core/helpers.h"
#include <mdns.h>
#include <esp_netif.h>
#include <vector>
#include <cstring>

namespace air_monitor {
class HomeAssistantDiscovery {
 public:
  struct Instance { std::string name; std::string url; };
  struct Snapshot {
    std::vector<Instance> instances;
    bool scanning, checked, connected;
    std::string error;
  };
  // HTTP handlers run on another task. Never expose references to the
  // main-loop-owned vector or traverse API connections from an HTTP handler.
  Snapshot snapshot() const {
    esphome::LockGuard lock(mutex_);
    return {instances_, search_ != nullptr || requested_, checked_, connected_, error_};
  }
  bool request_scan() {
    esphome::LockGuard lock(mutex_);
    const uint32_t now = esphome::millis();
    if (!esphome::network::is_connected() || search_ != nullptr || requested_ ||
        (started_ && now - last_scan_ < 10000)) return false;
    requested_ = true;
    return true;
  }
  bool api_connected_on_main_task_() const {
    auto *api = esphome::api::global_api_server;
    if (!api) return false;
    for (const auto &client : api->active_clients())
      if (client->is_connection_setup() && !client->is_marked_for_removal() &&
          home_assistant::is_client(client->get_name())) return true;
    return false;
  }
  void loop() {
    esphome::LockGuard lock(mutex_);
    connected_ = api_connected_on_main_task_();
    const uint32_t now = esphome::millis();
    if (search_) {
      mdns_result_t *results = nullptr;
      // A zero-timeout poll never blocks the sensor/display loop.
      if (!mdns_query_async_get_results(search_, 0, &results, nullptr)) return;
      mdns_query_async_delete(search_); search_ = nullptr;
      instances_.clear();
      if (esphome::network::is_connected()) {
        for (auto *item = results; item && instances_.size() < 4; item = item->next) {
          std::string ip, url, name = item->instance_name ? item->instance_name : "Home Assistant";
          std::string hostname = item->hostname ? item->hostname : "";
          if (!hostname.empty()) hostname += ".local";
          for (auto *address = item->addr; address; address = address->next) {
            if (address->addr.type != ESP_IPADDR_TYPE_V4) continue;
            char text[16];
            esp_ip4addr_ntoa(&address->addr.u_addr.ip4, text, sizeof(text));
            ip = text;
            break;
          }
          for (size_t i = 0; i < item->txt_count; ++i) {
            const auto &entry = item->txt[i];
            if (entry.key && entry.value && std::strcmp(entry.key, "internal_url") == 0)
              url.assign(entry.value, item->txt_value_len[i]);
          }
          const auto safe_url = home_assistant::local_url(url, ip, hostname, item->port);
          if (ip.empty()) continue;
          bool duplicate = false;
          for (const auto &known : instances_)
            if (known.url == safe_url && known.name == name.substr(0, 80)) duplicate = true;
          if (!duplicate) instances_.push_back({name.substr(0, 80), safe_url});
        }
      }
      if (results) mdns_query_results_free(results);
      checked_ = true;
    }
    if (!esphome::network::is_connected()) {
      instances_.clear(); requested_ = false;
      checked_ = false; started_ = false;
      return;
    }
    if (!requested_ && started_ && now - last_scan_ < 60000) return;
    requested_ = false; started_ = true; last_scan_ = now;
    error_.clear();
    search_ = mdns_query_async_new(nullptr, "_home-assistant", "_tcp", MDNS_TYPE_PTR, 3000, 8, nullptr);
    if (!search_) error_ = "Discovery could not start. Retry once Wi-Fi is ready.";
  }
 private:
  mdns_search_once_t *search_{nullptr};
  std::vector<Instance> instances_;
  uint32_t last_scan_{0};
  bool checked_{false}, requested_{false}, started_{false};
  std::string error_;
  bool connected_{false};
  mutable esphome::Mutex mutex_;
};
}

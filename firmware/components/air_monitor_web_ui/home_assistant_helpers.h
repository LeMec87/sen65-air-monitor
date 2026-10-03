#pragma once
#include <cstdint>
#include <string>

namespace air_monitor::home_assistant {
inline bool is_client(const char *name) {
  const std::string client = name ? name : "";
  return client == "Home Assistant" || client.rfind("Home Assistant ", 0) == 0;
}
// mDNS is untrusted input. Never turn an advertised credential, external URL
// or non-web protocol into a setup link. Limit links to the advertised LAN IP
// or its .local hostname, retaining HTTPS where explicitly advertised.
inline std::string local_url(const std::string &advertised, const std::string &ip,
                             const std::string &hostname, uint16_t port) {
  if (ip.empty() || port == 0) return "";
  std::string scheme = "http://", host = ip;
  if (!advertised.empty()) {
    const auto split = advertised.find("://");
    if (split == std::string::npos) return "";
    scheme = advertised.substr(0, split + 3);
    if (scheme != "http://" && scheme != "https://") return "";
    std::string authority = advertised.substr(split + 3);
    if (!authority.empty() && authority.back() == '/') authority.pop_back();
    const std::string suffix = ":" + std::to_string(port);
    if (authority.size() > suffix.size() &&
        authority.compare(authority.size() - suffix.size(), suffix.size(), suffix) == 0)
      authority.resize(authority.size() - suffix.size());
    if (authority != ip && authority != hostname) return "";
    host = authority;
  }
  return scheme + host + ":" + std::to_string(port);
}
}

#include "../firmware/components/air_monitor_web_ui/firmware_release.h"
#include <cassert>
#include <iostream>
int main() {
  using namespace air_monitor::release;
  assert(is_newer("0.3.1", "0.2.2"));
  assert(is_newer("0.3.1", "0.3.0"));
  assert(is_newer("1.0.0", "0.99.99"));
  assert(is_newer("0.10.0", "0.9.99"));
  assert(!is_newer("0.3.1", "0.3.1"));
  assert(!is_newer("0.3.0", "0.3.1"));
  for (const char *invalid : {"", "unknown", "0.3", "0.3.1beta", "0.03.1", "9999999.1.1", "0.3.1.0", "-1.0.0"})
    assert(!is_newer(invalid, "0.2.2"));
  const std::string url = "https://raw.githubusercontent.com/LeMec87/sen65-air-monitor/main/dist/sen65-air-monitor-v0.3.1-ota.bin";
  const std::string md5 = "0123456789abcdef0123456789ABCDEF";
  assert(valid_download("0.3.1", url, md5));
  assert(!valid_download("0.3.0", url, md5));
  assert(!valid_download("0.3.1", "http" + url.substr(5), md5));
  assert(!valid_download("0.3.1", url + "?redirect=other", md5));
  assert(!valid_download("0.3.1", url, "bad"));
  assert(!valid_download("0.3.1", url, std::string(32, 'z')));
  std::cout << "Version ordering, downgrade prevention, URL and checksum validation passed.\n";
}

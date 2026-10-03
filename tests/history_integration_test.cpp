#include <cassert>
#include <cmath>
#include <iostream>
#include "../firmware/components/air_monitor_web_ui/history_api.h"
#include "../firmware/components/air_monitor_web_ui/home_assistant_helpers.h"
int main() {
  using namespace air_monitor;
  auto time=[](unsigned i){return 1000U+i*300000U;};
  auto reading=[](unsigned metric,unsigned i){return metric==7?NAN:float(metric*10+i);};
  assert(history::json("invalid",1000,0,time,reading)=="{}");
  auto empty=history::json("particles",1000,0,time,reading);
  assert(empty.find("\"points\":[]")!=std::string::npos);
  auto climate=history::json("climate",301000,2,time,reading);
  assert(climate.find("\"metrics\":[\"temp\",\"rh\"]")!=std::string::npos);
  assert(climate.find("[1000,60.00,null]")!=std::string::npos); // raw C, not Fahrenheit
  assert(climate.find("[301000,61.00,null]")!=std::string::npos);
  assert(history::json("gases",1000,1,time,reading).find("[1000,40.00,50.00]")!=std::string::npos);
  auto full=history::json("particles",86101000,288,time,reading);
  assert(full.find("[86101000,287.00,297.00,307.00,317.00]")!=std::string::npos);
  assert(full.size()<20000);
  assert(history::json("particles",90000000,1,time,reading).find("\"points\":[]")!=std::string::npos);
  auto wrap=history::json("climate",1000,1,[](unsigned){return UINT32_MAX-15;},reading);
  assert(wrap.find("[4294967280,60.00,null]")!=std::string::npos);
  assert(home_assistant::is_client("Home Assistant 2026.10.0"));
  assert(home_assistant::is_client("Home Assistant"));
  assert(!home_assistant::is_client("Home AssistantImpostor"));
  assert(!home_assistant::is_client("ESPHome logs"));
  assert(!home_assistant::is_client(nullptr));
  const auto ip="192.0.2.10", host="ha-example.local"; // documentation-only IP
  assert(home_assistant::local_url("",ip,host,8123)=="http://192.0.2.10:8123");
  assert(home_assistant::local_url("https://ha-example.local:8123/",ip,host,8123)=="https://ha-example.local:8123");
  for(const auto *unsafe:{"javascript://ha-example.local","http://user:secret@ha-example.local:8123","http://external.example:8123","http://ha-example.local:8124","http://ha-example.local/path","http://ha-example.local:8123?x=1"})
    assert(home_assistant::local_url(unsafe,ip,host,8123).empty());
  assert(home_assistant::local_url("", "",host,8123).empty());
  assert(home_assistant::local_url("",ip,host,0).empty());
  std::cout<<"History and discovery helper tests passed.\n";
}
